const router = require('express').Router();
const db     = require('../db/database');
const auth   = require('../middleware/auth');
const multer = require('multer');
const path   = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// GET /api/tournaments - list with filter/research
router.get('/', (req, res) => {
    const { search, game, mode } = req.query;
    let query = 'SELECT * FROM tournaments WHERE 1=1';
    const params = [];

    if (search) { query += ' AND name LIKE ?'; params.push(`%${search}%`); }
    if (game)   { query += ' AND game = ?';    params.push(game); }
    if (mode)   { query += ' AND mode = ?';    params.push(mode); }

    query += ' ORDER BY created_at DESC';
    res.json(db.prepare(query).all(...params));
});

// GET /api/tournaments/:id - details + participants
router.get('/:id', (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const registrations = db.prepare(`
    SELECT r.*, u.username, u.avatar_url, t.name as team_name, t.logo_url as team_logo
    FROM registrations r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN teams t ON r.team_id = t.id
    WHERE r.tournament_id = ?
  `).all(req.params.id);

    res.json({ ...tournament, registrations });
});

// POST /api/tournaments - create a tournament (auth required)
router.post('/', auth, upload.single('logo'), (req, res) => {
    const { name, game, description, date, format, max_participants, mode } = req.body;
    const logo_url = req.file ? `/uploads/${req.file.filename}` : null;

    const result = db.prepare(`
    INSERT INTO tournaments (name, game, logo_url, description, date, format, max_participants, mode, manager_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, game, logo_url, description, date, format, max_participants, mode, req.user.id);

    res.status(201).json({ id: result.lastInsertRowid });
});

router.post('/:id/register', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournoi introuvable' });
    if (tournament.status !== 'open')
        return res.status(400).json({ error: 'Ce tournoi n\'est plus ouvert aux inscriptions' });

    const count = db.prepare(
        'SELECT COUNT(*) as c FROM registrations WHERE tournament_id = ?'
    ).get(req.params.id).c;
    if (count >= tournament.max_participants)
        return res.status(400).json({ error: 'Tournoi complet' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (tournament.mode === 'teams') {
        // Vérifie que l'utilisateur a une équipe
        if (!user.team_id)
            return res.status(400).json({ error: 'Tu n\'as pas d\'équipe' });

        // Vérifie que l'utilisateur est bien le manager de son équipe
        const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(user.team_id);
        if (team.manager_id !== req.user.id)
            return res.status(403).json({ error: 'Seul le manager peut inscrire l\'équipe' });

        // Vérifie que l'équipe n'est pas déjà inscrite
        const existing = db.prepare(
            'SELECT * FROM registrations WHERE tournament_id = ? AND team_id = ?'
        ).get(req.params.id, user.team_id);
        if (existing)
            return res.status(409).json({ error: 'Ton équipe est déjà inscrite' });

        db.prepare(
            'INSERT INTO registrations (tournament_id, team_id) VALUES (?, ?)'
        ).run(req.params.id, user.team_id);

    } else {
        // Mode joueurs — vérifie que le joueur n'est pas déjà inscrit
        const existing = db.prepare(
            'SELECT * FROM registrations WHERE tournament_id = ? AND user_id = ?'
        ).get(req.params.id, req.user.id);
        if (existing)
            return res.status(409).json({ error: 'Tu es déjà inscrit' });

        db.prepare(
            'INSERT INTO registrations (tournament_id, user_id) VALUES (?, ?)'
        ).run(req.params.id, req.user.id);
    }

    res.json({ success: true });
});
// PATCH /api/tournaments/:id - modify a tournament (manager only)
router.patch('/:id', auth, upload.single('logo'), (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournoi introuvable' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Non autorisé' });
    if (tournament.status !== 'open')
        return res.status(400).json({ error: 'Impossible de modifier un tournoi déjà démarré' });

    const { name, game, description, date, format, max_participants, mode } = req.body;
    const logo_url = req.file ? `/uploads/${req.file.filename}` : tournament.logo_url;

    db.prepare(`
    UPDATE tournaments
    SET name = ?, game = ?, description = ?, date = ?, format = ?, max_participants = ?, mode = ?, logo_url = ?
    WHERE id = ?
  `).run(
        name || tournament.name,
        game || tournament.game,
        description ?? tournament.description,
        date || tournament.date,
        format || tournament.format,
        max_participants || tournament.max_participants,
        mode || tournament.mode,
        logo_url,
        req.params.id
    );

    res.json({ success: true });
});

// DELETE /api/tournaments/:id - delete a tournament (manager only)
router.delete('/:id', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournoi introuvable' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Non autorisé' });

    db.prepare('DELETE FROM registrations WHERE tournament_id = ?').run(req.params.id);
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(req.params.id);
    db.prepare('DELETE FROM tournaments WHERE id = ?').run(req.params.id);

    res.json({ success: true });
});

// DELETE /api/tournaments/:id/unregister - cancel the registration
router.delete('/:id/unregister', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Unfound tournament' });
    if (tournament.status !== 'open')
        return res.status(400).json({ error: 'Impossible de se désinscrire d\'un tournoi déjà démarré' });

    if (tournament.mode === 'players') {
        db.prepare('DELETE FROM registrations WHERE tournament_id = ? AND user_id = ?')
            .run(req.params.id, req.user.id);
    } else {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        if (!user.team_id) return res.status(400).json({ error: 'Tu n\'as pas d\'équipe' });
        const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(user.team_id);
        if (team.manager_id !== req.user.id)
            return res.status(403).json({ error: 'Seul le manager peut désinscrire l\'équipe' });
        db.prepare('DELETE FROM registrations WHERE tournament_id = ? AND team_id = ?')
            .run(req.params.id, user.team_id);
    }

    res.json({ success: true });
});

const { generateSingleElimination } = require('../utils/bracketGenerator');

// GET /api/tournaments/:id/bracket — récupère le bracket
router.get('/:id/bracket', (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournoi introuvable' });

    const matches = db.prepare(`
    SELECT * FROM matches WHERE tournament_id = ? ORDER BY round, position
  `).all(req.params.id);

    res.json({ matches, format: tournament.format, mode: tournament.mode });
});

// POST /api/tournaments/:id/bracket/generate — génère ou regénère le bracket
router.post('/:id/bracket/generate', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournoi introuvable' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Non autorisé' });
    if (tournament.status !== 'open')
        return res.status(400).json({ error: 'Tournoi déjà démarré' });

    // Récupère les participants
    const registrations = db.prepare(
        'SELECT * FROM registrations WHERE tournament_id = ?'
    ).all(req.params.id);

    const participants = registrations.map(r =>
        tournament.mode === 'players' ? r.user_id : r.team_id
    );

    // Supprime l'ancien bracket
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(req.params.id);

    // Génère le nouveau
    const { matches } = generateSingleElimination(participants, tournament.max_participants);

    const insert = db.prepare(`
    INSERT INTO matches (tournament_id, round, position, participant_a, participant_b, winner, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    const insertMany = db.transaction((matches) => {
        for (const m of matches) {
            insert.run(tournament.id, m.round, m.position, m.participant_a, m.participant_b, m.winner, m.status);
        }
    });

    insertMany(matches);
    res.json({ success: true });
});

// PATCH /api/tournaments/:id/bracket/swap — déplace un participant dans le bracket
router.patch('/:id/bracket/swap', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournoi introuvable' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Non autorisé' });

    const { matchId, slot, targetMatchId, targetSlot } = req.body;
    // slot et targetSlot valent 'a' ou 'b'

    const matchA = db.prepare('SELECT * FROM matches WHERE id = ? AND tournament_id = ?')
        .get(matchId, req.params.id);
    const matchB = db.prepare('SELECT * FROM matches WHERE id = ? AND tournament_id = ?')
        .get(targetMatchId, req.params.id);

    if (!matchA || !matchB) return res.status(404).json({ error: 'Match introuvable' });
    if (matchA.round !== 1 || matchB.round !== 1)
        return res.status(400).json({ error: 'On ne peut déplacer que les participants du round 1' });

    const valA = matchA[`participant_${slot}`];
    const valB = matchB[`participant_${targetSlot}`];

    db.prepare(`UPDATE matches SET participant_${slot} = ? WHERE id = ?`).run(valB, matchId);
    db.prepare(`UPDATE matches SET participant_${targetSlot} = ? WHERE id = ?`).run(valA, targetMatchId);

    res.json({ success: true });
});

// DELETE /api/tournaments/:id/participants/:participantId — kick un participant
router.delete('/:id/participants/:participantId', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournoi introuvable' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Non autorisé' });

    const pid = Number(req.params.participantId);

    // Supprime la registration
    if (tournament.mode === 'players') {
        db.prepare('DELETE FROM registrations WHERE tournament_id = ? AND user_id = ?')
            .run(req.params.id, pid);
    } else {
        db.prepare('DELETE FROM registrations WHERE tournament_id = ? AND team_id = ?')
            .run(req.params.id, pid);
    }

    // Retire du bracket (round 1 uniquement)
    const matchA = db.prepare(
        'SELECT * FROM matches WHERE tournament_id = ? AND round = 1 AND participant_a = ?'
    ).get(req.params.id, pid);
    if (matchA) db.prepare('UPDATE matches SET participant_a = NULL WHERE id = ?').run(matchA.id);

    const matchB = db.prepare(
        'SELECT * FROM matches WHERE tournament_id = ? AND round = 1 AND participant_b = ?'
    ).get(req.params.id, pid);
    if (matchB) db.prepare('UPDATE matches SET participant_b = NULL WHERE id = ?').run(matchB.id);

    res.json({ success: true });
});

// server/src/routes/tournaments.js
// (additions — garde tout ce qui existe déjà)

const { generateRoundRobin, computeStandings } = require('../utils/roundRobinGenerator');

// =================================================================
// HELPERS
// =================================================================

/**
 * Renvoie les IDs des participants d'un tournoi (user_id ou team_id selon le mode).
 */
function getParticipantIds(tournament) {
    const rows = db.prepare(
        'SELECT user_id, team_id FROM registrations WHERE tournament_id = ?'
    ).all(tournament.id);
    return tournament.mode === 'teams'
        ? rows.map(r => r.team_id).filter(Boolean)
        : rows.map(r => r.user_id).filter(Boolean);
}

/**
 * Avancement single elimination :
 * round R, position P → round R+1, position ceil(P/2).
 * Slot 'a' si P impair, slot 'b' si P pair (positions 1-indexées, alignées sur le générateur).
 */
function advanceSingleElim(tournamentId, match, winnerId) {
    const nextRound = match.round + 1;
    const nextPosition = Math.ceil(match.position / 2);
    const slot = match.position % 2 === 1 ? 'a' : 'b';

    const next = db.prepare(`
        SELECT * FROM matches
        WHERE tournament_id = ? AND round = ? AND position = ?
    `).get(tournamentId, nextRound, nextPosition);

    if (!next) return; // finale

    db.prepare(`UPDATE matches SET participant_${slot} = ? WHERE id = ?`)
        .run(winnerId, next.id);

    // Le slot rempli peut compléter une BYE en aval (cas max_participants > inscrits)
    propagateByes(tournamentId);
}

/**
 * Vérifie si, en partant du match donné, un match en aval (round suivant et au-delà)
 * a déjà été joué (status = 'finished').
 */
function hasDownstreamPlayed(tournamentId, match) {
    let round = match.round + 1;
    let position = Math.ceil(match.position / 2);

    while (true) {
        const next = db.prepare(`
            SELECT * FROM matches WHERE tournament_id = ? AND round = ? AND position = ?
        `).get(tournamentId, round, position);
        if (!next) return false;
        if (next.status === 'finished') return true;
        round += 1;
        position = Math.ceil(position / 2);
    }
}

/**
 * Vide le slot en aval qui contenait l'ancien gagnant.
 * Appelé quand on modifie un score et que le gagnant change.
 */
function clearDownstreamSlot(tournamentId, match) {
    const nextRound = match.round + 1;
    const nextPosition = Math.ceil(match.position / 2);
    const slot = match.position % 2 === 1 ? 'a' : 'b';

    const next = db.prepare(`
        SELECT * FROM matches WHERE tournament_id = ? AND round = ? AND position = ?
    `).get(tournamentId, nextRound, nextPosition);
    if (!next) return;

    db.prepare(`UPDATE matches SET participant_${slot} = NULL WHERE id = ?`).run(next.id);
}

/**
 * Propage les BYE de manière itérative.
 * Une "vraie" BYE = match avec un seul participant ET dont le slot manquant ne sera jamais rempli
 * (pas d'upstream pending qui pourrait le combler).
 * On boucle jusqu'à stabilité car remplir un slot peut déclencher une nouvelle BYE en aval.
 */
function propagateByes(tournamentId) {
    let changed = true;
    while (changed) {
        changed = false;
        const all = db.prepare(
            'SELECT * FROM matches WHERE tournament_id = ? ORDER BY round, position'
        ).all(tournamentId);
        const maxRound = Math.max(...all.map(m => m.round));

        for (const m of all) {
            if (m.status === 'finished') continue;

            const hasA = m.participant_a != null;
            const hasB = m.participant_b != null;
            if (hasA && hasB) continue;   // match complet
            if (!hasA && !hasB) continue; // match mort, rien à faire

            const present = hasA ? m.participant_a : m.participant_b;
            const missingSlot = hasA ? 'b' : 'a';

            // Vérifie si le slot manquant peut encore être rempli par un match en amont
            let upstreamPending = false;
            if (m.round > 1) {
                const upstreamPos = missingSlot === 'a' ? 2 * m.position - 1 : 2 * m.position;
                const up = all.find(x => x.round === m.round - 1 && x.position === upstreamPos);
                if (up && up.status !== 'finished' &&
                    (up.participant_a != null || up.participant_b != null)) {
                    upstreamPending = true;
                }
            }
            if (upstreamPending) continue;

            // Vraie BYE : on clôture le match et on propage
            db.prepare(
                `UPDATE matches SET winner = ?, loser = NULL, status = 'finished' WHERE id = ?`
            ).run(present, m.id);

            if (m.round < maxRound) {
                const nextPos = Math.ceil(m.position / 2);
                const nextSlot = m.position % 2 === 1 ? 'a' : 'b';
                const next = all.find(x => x.round === m.round + 1 && x.position === nextPos);
                if (next) {
                    db.prepare(`UPDATE matches SET participant_${nextSlot} = ? WHERE id = ?`)
                        .run(present, next.id);
                }
            }
            changed = true;
        }
    }
}

/**
 * Marque le tournoi comme 'finished' si tous les matchs sont joués.
 */
function checkTournamentFinished(tournamentId, format) {
    const remaining = db.prepare(`
        SELECT COUNT(*) AS c FROM matches
        WHERE tournament_id = ? AND status != 'finished'
    `).get(tournamentId).c;

    if (remaining === 0) {
        db.prepare(`UPDATE tournaments SET status = 'finished' WHERE id = ?`).run(tournamentId);
    }
}

// =================================================================
// ROUTES
// =================================================================

// POST /api/tournaments/:id/start — démarre le tournoi
router.post('/:id/start', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournoi introuvable' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Non autorisé' });
    if (tournament.status !== 'open')
        return res.status(400).json({ error: 'Tournoi déjà démarré' });

    const participants = getParticipantIds(tournament);
    if (participants.length < 2)
        return res.status(400).json({ error: 'Au moins 2 participants sont requis' });

    try {
        const tx = db.transaction(() => {
            if (tournament.format === 'round_robin') {
                // Pas de seeding préalable pour le round robin : on génère au démarrage
                db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(tournament.id);

                const schedule = generateRoundRobin(participants);
                const insert = db.prepare(`
                    INSERT INTO matches
                        (tournament_id, round, position, participant_a, participant_b, status, bracket)
                    VALUES (?, ?, ?, ?, ?, 'pending', 'main')
                `);
                for (const m of schedule) {
                    insert.run(tournament.id, m.round, m.position, m.participant_a, m.participant_b);
                }

            } else if (tournament.format === 'single_elimination') {
                // Le bracket a déjà été généré et seedé par le manager (drag & drop).
                // Vérification : au moins un match round 1 doit exister.
                const r1Count = db.prepare(
                    'SELECT COUNT(*) AS c FROM matches WHERE tournament_id = ? AND round = 1'
                ).get(tournament.id).c;
                if (r1Count === 0) {
                    throw new Error('Le bracket n\'a pas été généré');
                }
                // Propage les BYE (slots vides au round 1) vers les rounds suivants
                propagateByes(tournament.id);

            } else if (tournament.format === 'double_elimination') {
                // Pas géré côté avancement pour l'instant — on accepte juste le démarrage
                // pour ne pas bloquer l'UI. Le scoring viendra avec l'implémentation double élim.
                const count = db.prepare(
                    'SELECT COUNT(*) AS c FROM matches WHERE tournament_id = ?'
                ).get(tournament.id).c;
                if (count === 0) {
                    throw new Error('Le bracket n\'a pas été généré');
                }
            }

            db.prepare(`UPDATE tournaments SET status = 'ongoing' WHERE id = ?`).run(tournament.id);
        });
        tx();
        res.json({ success: true });
    } catch (err) {
        console.error('Start tournament failed:', err);
        res.status(400).json({ error: err.message || 'Erreur au démarrage du tournoi' });
    }
});

// PUT /api/tournaments/:id/matches/:matchId — saisie du résultat d'un match
// PUT /api/tournaments/:id/matches/:matchId — saisie/modification du score
router.put('/:id/matches/:matchId', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournoi introuvable' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Non autorisé' });
    if (tournament.status !== 'ongoing')
        return res.status(400).json({ error: 'Le tournoi n\'est pas en cours' });

    const match = db.prepare(
        'SELECT * FROM matches WHERE id = ? AND tournament_id = ?'
    ).get(req.params.matchId, req.params.id);
    if (!match) return res.status(404).json({ error: 'Match introuvable' });
    if (match.participant_a == null || match.participant_b == null)
        return res.status(400).json({ error: 'Match incomplet : un participant est manquant' });

    const { score_a, score_b } = req.body;
    const sa = Number(score_a);
    const sb = Number(score_b);
    if (!Number.isInteger(sa) || !Number.isInteger(sb) || sa < 0 || sb < 0)
        return res.status(400).json({ error: 'Scores invalides' });
    if (sa === sb)
        return res.status(400).json({ error: 'Un match ne peut pas se terminer sur une égalité' });

    const winner = sa > sb ? match.participant_a : match.participant_b;
    const loser  = sa > sb ? match.participant_b : match.participant_a;

    // En single elim : si on MODIFIE un score déjà saisi, et que le gagnant change,
    // on bloque si des matchs en aval sont déjà joués (l'ancien gagnant est peut-être déjà en train de jouer)
    if (tournament.format === 'single_elimination' && match.status === 'finished') {
        const winnerChanged = match.winner !== winner;
        if (winnerChanged) {
            const downstreamPlayed = hasDownstreamPlayed(tournament.id, match);
            if (downstreamPlayed) {
                return res.status(409).json({
                    error: 'Impossible de changer le gagnant : des matchs en aval ont déjà été joués'
                });
            }
        }
    }

    try {
        const tx = db.transaction(() => {
            db.prepare(`
                UPDATE matches
                SET score_a = ?, score_b = ?, winner = ?, loser = ?, status = 'finished'
                WHERE id = ?
            `).run(sa, sb, winner, loser, match.id);

            if (tournament.format === 'single_elimination') {
                // Si le gagnant a changé, on doit nettoyer le slot dans le match aval avant d'avancer
                if (match.status === 'finished' && match.winner !== winner) {
                    clearDownstreamSlot(tournament.id, match);
                }
                advanceSingleElim(tournament.id, match, winner);
            }
            // round_robin : pas d'avancement, le classement est recalculé à la lecture
        });
        tx();
        res.json({ success: true });
    } catch (err) {
        console.error('Set match score failed:', err);
        res.status(500).json({ error: 'Erreur à l\'enregistrement du score' });
    }
});

// GET /api/tournaments/:id/standings — classement round-robin
router.get('/:id/standings', (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournoi introuvable' });
    if (tournament.format !== 'round_robin')
        return res.status(400).json({ error: 'Classement disponible uniquement en round robin' });

    const participants = getParticipantIds(tournament);
    const matches = db.prepare(
        'SELECT * FROM matches WHERE tournament_id = ?'
    ).all(tournament.id);

    res.json(computeStandings(matches, participants));
});

// POST /api/tournaments/:id/finish — clôture manuelle du tournoi
router.post('/:id/finish', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournoi introuvable' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Non autorisé' });
    if (tournament.status !== 'ongoing')
        return res.status(400).json({ error: 'Le tournoi n\'est pas en cours' });

    db.prepare(`UPDATE tournaments SET status = 'finished' WHERE id = ?`).run(tournament.id);
    res.json({ success: true });
});

module.exports = router;