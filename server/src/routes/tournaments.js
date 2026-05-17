const router = require('express').Router();
const db     = require('../db/database');
const auth   = require('../middleware/auth');
const { uploadSingle, saveImage, deleteUpload } = require('../middleware/upload');

// GET /api/tournaments - list with filter/research
router.get('/', (req, res) => {
    const { search, game, mode, status } = req.query;
    let query = 'SELECT * FROM tournaments WHERE 1=1';
    const params = [];

    if (search) { query += ' AND name LIKE ?';   params.push(`%${search}%`); }
    if (game)   { query += ' AND game = ?';       params.push(game); }
    if (mode)   { query += ' AND mode = ?';       params.push(mode); }
    if (status) { query += ' AND status = ?';     params.push(status); }

    query += ' ORDER BY CASE WHEN status = \'finished\' THEN 1 ELSE 0 END, CASE WHEN status != \'finished\' THEN date END ASC, CASE WHEN status = \'finished\' THEN date END DESC';
    res.json(db.prepare(query).all(...params));
});

// GET /api/tournaments/games - distinct games present in the DB
router.get('/games', (req, res) => {
    const rows = db.prepare('SELECT DISTINCT game FROM tournaments ORDER BY game ASC').all();
    res.json(rows.map(r => r.game));
});

// GET /api/tournaments/:id - details + participants
router.get('/:id', (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const registrations = db.prepare(`
    SELECT r.*, u.username, u.avatar_url, u.discord_username, t.name as team_name, t.logo_url as team_logo
    FROM registrations r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN teams t ON r.team_id = t.id
    WHERE r.tournament_id = ?
  `).all(req.params.id);

    res.json({ ...tournament, registrations });
});

// POST /api/tournaments - create a tournament (auth required)
router.post('/', auth, uploadSingle('logo'), async (req, res) => {
    const { name, game, description, date, format, max_participants, mode } = req.body;
    if (name && name.length > 100)
        return res.status(400).json({ error: "Field 'name' must not exceed 100 characters" });
    if (description && description.length > 500)
        return res.status(400).json({ error: "Field 'description' must not exceed 500 characters" });
    if (game && game.length > 50)
        return res.status(400).json({ error: "Field 'game' must not exceed 50 characters" });
    if (date && date < new Date().toISOString().split('T')[0])
        return res.status(400).json({ error: 'Tournament date cannot be in the past' });
    if (format === 'round_robin' && Number(max_participants) > 8)
        return res.status(400).json({ error: 'Round Robin tournaments are limited to 8 participants' });
    const logo_url = req.file ? await saveImage(req.file.buffer) : null;

    const result = db.prepare(`
    INSERT INTO tournaments (name, game, logo_url, description, date, format, max_participants, mode, manager_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, game, logo_url, description, date, format, max_participants, mode, req.user.id);

    res.status(201).json({ id: result.lastInsertRowid });
});

router.post('/:id/register', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.status !== 'open')
        return res.status(400).json({ error: 'This tournament is no longer open for registration' });

    const count = db.prepare(
        'SELECT COUNT(*) as c FROM registrations WHERE tournament_id = ?'
    ).get(req.params.id).c;
    if (count >= tournament.max_participants)
        return res.status(400).json({ error: 'Tournament is full' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (tournament.mode === 'teams') {
        // Vérifie que l'utilisateur a une équipe
        if (!user.team_id)
            return res.status(400).json({ error: 'You don\'t have a team' });

        // Vérifie que l'utilisateur est bien le manager de son équipe
        const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(user.team_id);
        if (team.manager_id !== req.user.id)
            return res.status(403).json({ error: 'Only the team manager can register the team' });

        // Vérifie que l'équipe n'est pas déjà inscrite
        const existing = db.prepare(
            'SELECT * FROM registrations WHERE tournament_id = ? AND team_id = ?'
        ).get(req.params.id, user.team_id);
        if (existing)
            return res.status(409).json({ error: 'Your team is already registered' });

        db.prepare(
            'INSERT INTO registrations (tournament_id, team_id) VALUES (?, ?)'
        ).run(req.params.id, user.team_id);

    } else {
        // Mode joueurs — vérifie que le joueur n'est pas déjà inscrit
        const existing = db.prepare(
            'SELECT * FROM registrations WHERE tournament_id = ? AND user_id = ?'
        ).get(req.params.id, req.user.id);
        if (existing)
            return res.status(409).json({ error: 'You\'re already registered' });

        db.prepare(
            'INSERT INTO registrations (tournament_id, user_id) VALUES (?, ?)'
        ).run(req.params.id, req.user.id);
    }

    // Invalide le bracket : il ne reflète plus la liste des inscrits
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(req.params.id);

    res.json({ success: true });
});
// PATCH /api/tournaments/:id - modify a tournament (manager only)
router.patch('/:id', auth, uploadSingle('logo'), async (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });
    if (tournament.status !== 'open')
        return res.status(400).json({ error: 'Cannot edit a tournament that has already started' });

    const { name, game, description, date, format, max_participants, mode } = req.body;
    if (name && name.length > 100)
        return res.status(400).json({ error: "Field 'name' must not exceed 100 characters" });
    if (description && description.length > 500)
        return res.status(400).json({ error: "Field 'description' must not exceed 500 characters" });
    if (game && game.length > 50)
        return res.status(400).json({ error: "Field 'game' must not exceed 50 characters" });
    if (date && date < new Date().toISOString().split('T')[0])
        return res.status(400).json({ error: 'Tournament date cannot be in the past' });
    const effectiveFormat      = format      || tournament.format;
    const effectiveMaxParticip = max_participants || tournament.max_participants;
    if (effectiveFormat === 'round_robin' && Number(effectiveMaxParticip) > 8)
        return res.status(400).json({ error: 'Round Robin tournaments are limited to 8 participants' });
    if (req.file && tournament.logo_url) deleteUpload(tournament.logo_url);
    const logo_url = req.file ? await saveImage(req.file.buffer) : tournament.logo_url;

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
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });
    if (tournament.status === 'ongoing')
        return res.status(400).json({ error: 'Cannot delete a tournament that is currently ongoing' });

    deleteUpload(tournament.logo_url);
    db.prepare('DELETE FROM registrations WHERE tournament_id = ?').run(req.params.id);
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(req.params.id);
    db.prepare('DELETE FROM tournaments WHERE id = ?').run(req.params.id);

    res.json({ success: true });
});

// DELETE /api/tournaments/:id/unregister - cancel the registration
router.delete('/:id/unregister', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.status !== 'open')
        return res.status(400).json({ error: 'Cannot unregister from a tournament that has already started' });

    if (tournament.mode === 'players') {
        db.prepare('DELETE FROM registrations WHERE tournament_id = ? AND user_id = ?')
            .run(req.params.id, req.user.id);
    } else {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        if (!user.team_id) return res.status(400).json({ error: 'You don\'t have a team' });
        const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(user.team_id);
        if (team.manager_id !== req.user.id)
            return res.status(403).json({ error: 'Only the team manager can unregister the team' });
        db.prepare('DELETE FROM registrations WHERE tournament_id = ? AND team_id = ?')
            .run(req.params.id, user.team_id);
    }

    // Invalide le bracket : il ne reflète plus la liste des inscrits
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(req.params.id);

    res.json({ success: true });
});

const {
    generateSingleElimination,
    generateDoubleElimination,
    getLoserBracketTarget,
    getLoserBracketNext
} = require('../utils/bracketGenerator');

// GET /api/tournaments/:id/bracket — récupère le bracket
router.get('/:id/bracket', (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const matches = db.prepare(`
    SELECT * FROM matches WHERE tournament_id = ? ORDER BY round, position
  `).all(req.params.id);

    res.json({ matches, format: tournament.format, mode: tournament.mode });
});

// POST /api/tournaments/:id/bracket/generate — génère ou regénère le bracket
router.post('/:id/bracket/generate', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });
    if (tournament.status !== 'open')
        return res.status(400).json({ error: 'Tournament already started' });

    const registrations = db.prepare(
        'SELECT * FROM registrations WHERE tournament_id = ?'
    ).all(req.params.id);

    const participants = registrations.map(r =>
        tournament.mode === 'players' ? r.user_id : r.team_id
    );

    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(req.params.id);

    let matches;
    if (tournament.format === 'single_elimination') {
        ({ matches } = generateSingleElimination(participants, tournament.max_participants));
    } else if (tournament.format === 'double_elimination') {
        ({ matches } = generateDoubleElimination(participants, tournament.max_participants));
    } else {
        return res.status(400).json({ error: 'This format does not require a pre-generated bracket' });
    }

    const insert = db.prepare(`
        INSERT INTO matches
        (tournament_id, round, position, bracket, participant_a, participant_b, winner, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((matches) => {
        for (const m of matches) {
            insert.run(
                tournament.id, m.round, m.position, m.bracket,
                m.participant_a, m.participant_b, m.winner, m.status
            );
        }
    });

    insertMany(matches);
    res.json({ success: true });
});

// PATCH /api/tournaments/:id/bracket/swap — déplace un participant dans le bracket
router.patch('/:id/bracket/swap', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });
    if (tournament.status !== 'open')
        return res.status(400).json({ error: 'Cannot swap participants in a tournament that has already started' });

    const { matchId, slot, targetMatchId, targetSlot } = req.body;

    if (!['a', 'b'].includes(slot) || !['a', 'b'].includes(targetSlot))
        return res.status(400).json({ error: "Invalid slot: must be 'a' or 'b'" });

    const matchA = db.prepare('SELECT * FROM matches WHERE id = ? AND tournament_id = ?')
        .get(matchId, req.params.id);
    const matchB = db.prepare('SELECT * FROM matches WHERE id = ? AND tournament_id = ?')
        .get(targetMatchId, req.params.id);

    if (!matchA || !matchB) return res.status(404).json({ error: 'Match not found' });
    if (matchA.round !== 1 || matchB.round !== 1)
        return res.status(400).json({ error: 'Only round 1 participants can be moved' });

    const valA = matchA[`participant_${slot}`];
    const valB = matchB[`participant_${targetSlot}`];

    db.prepare(`UPDATE matches SET participant_${slot} = ? WHERE id = ?`).run(valB, matchId);
    db.prepare(`UPDATE matches SET participant_${targetSlot} = ? WHERE id = ?`).run(valA, targetMatchId);

    res.json({ success: true });
});

// DELETE /api/tournaments/:id/participants/:participantId — kick un participant
router.delete('/:id/participants/:participantId', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });
    if (tournament.status !== 'open')
        return res.status(400).json({ error: 'Cannot remove a participant from a tournament that has already started' });

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
 * Avancement double élim.
 * Selon le bracket du match terminé, fait avancer gagnant et perdant.
 */
function advanceDoubleElim(tournamentId, match, winner, loser, maxParticipants) {
    // On a besoin de la taille, recalcule simplement :
    let size = 1;
    while (size < maxParticipants) size *= 2;
    const wbRounds = Math.log2(size);
    const lbRounds = 2 * (wbRounds - 1);

    if (match.bracket === 'winners') {
        // 1. Gagnant : monte dans WB
        const nextWbRound = match.round + 1;
        if (nextWbRound > wbRounds) {
            // C'était la finale WB → gagnant va en grand_final slot a
            const gf = db.prepare(`
                SELECT * FROM matches WHERE tournament_id = ?
                AND bracket = 'grand_final' AND round = 1 AND position = 1
            `).get(tournamentId);
            if (gf) {
                db.prepare('UPDATE matches SET participant_a = ? WHERE id = ?').run(winner, gf.id);
            }
        } else {
            const nextWbPosition = Math.ceil(match.position / 2);
            const slot = match.position % 2 === 1 ? 'a' : 'b';
            const next = db.prepare(`
                SELECT * FROM matches WHERE tournament_id = ?
                AND bracket = 'winners' AND round = ? AND position = ?
            `).get(tournamentId, nextWbRound, nextWbPosition);
            if (next) {
                db.prepare(`UPDATE matches SET participant_${slot} = ? WHERE id = ?`).run(winner, next.id);
            }
        }

        // 2. Perdant : descend dans LB
        if (loser != null) {
            const target = getLoserBracketTarget(match.round, match.position, size);
            const lbMatch = db.prepare(`
                SELECT * FROM matches WHERE tournament_id = ?
                AND bracket = 'losers' AND round = ? AND position = ?
            `).get(tournamentId, target.round, target.position);
            if (lbMatch) {
                db.prepare(`UPDATE matches SET participant_${target.slot} = ? WHERE id = ?`)
                    .run(loser, lbMatch.id);
            }
        }

    } else if (match.bracket === 'losers') {
        // Gagnant LB monte
        const next = getLoserBracketNext(match.round, match.position, size, lbRounds);
        if (next === null) {
            // Finale LB → grand_final slot b
            const gf = db.prepare(`
                SELECT * FROM matches WHERE tournament_id = ?
                AND bracket = 'grand_final' AND round = 1 AND position = 1
            `).get(tournamentId);
            if (gf) {
                db.prepare('UPDATE matches SET participant_b = ? WHERE id = ?').run(winner, gf.id);
            }
        } else {
            const nextLb = db.prepare(`
                SELECT * FROM matches WHERE tournament_id = ?
                AND bracket = 'losers' AND round = ? AND position = ?
            `).get(tournamentId, next.round, next.position);
            if (nextLb) {
                db.prepare(`UPDATE matches SET participant_${next.slot} = ? WHERE id = ?`)
                    .run(winner, nextLb.id);
            }
        }
        // Perdant LB : éliminé, rien à faire
    }
    // match.bracket === 'grand_final' : tournoi terminé, rien à propager
    // (la fin est manuelle via le bouton "Terminer le tournoi")

    // Propagation des BYE en cascade après chaque avancement
    propagateByesDouble(tournamentId, maxParticipants);
}

/**
 * Propage les BYE en double élim, en cascade et de manière itérative.
 *
 * Cas BYE possibles :
 *   - WB round R : un seul participant présent → qualifie en WB R+1 ET ne génère pas de perdant pour le LB
 *     → le slot LB qui attendait ce perdant doit aussi être traité comme BYE (l'autre participant qualifie)
 *   - LB round R : un seul participant présent → qualifie en LB R+1
 *   - Grand final : un seul participant présent → c'est qu'on n'a pas géré quelque chose, ne devrait pas arriver
 */
function propagateByesDouble(tournamentId, maxParticipants) {
    let size = 1;
    while (size < maxParticipants) size *= 2;
    const wbRounds = Math.log2(size);
    const lbRounds = 2 * (wbRounds - 1);

    let changed = true;
    let safety = 100;
    while (changed && safety-- > 0) {
        changed = false;
        const all = db.prepare(
            'SELECT * FROM matches WHERE tournament_id = ? ORDER BY bracket, round, position'
        ).all(tournamentId);

        for (const m of all) {
            if (m.status === 'finished') continue;
            const hasA = m.participant_a != null;
            const hasB = m.participant_b != null;
            if (hasA && hasB) continue;

            // Cas 1 : un seul participant présent — BYE classique
            if (hasA || hasB) {
                const present = hasA ? m.participant_a : m.participant_b;
                if (canSlotStillBeFilled(m, hasA ? 'b' : 'a', all, size, wbRounds, lbRounds)) continue;

                db.prepare(
                    `UPDATE matches SET winner = ?, loser = NULL, status = 'finished' WHERE id = ?`
                ).run(present, m.id);
                propagateByeWinner(m, present, size, wbRounds, lbRounds);
                changed = true;
                continue;
            }

            // Cas 2 : match complètement vide.
            // On ne le clôture QUE si :
            //   - aucun slot ne peut plus être rempli
            //   - ET aucun des deux participants n'est déjà présent (déjà garanti ici car !hasA && !hasB)
            // On vérifie d'abord si les matchs amont possibles existent et sont déjà finished sans avoir propagé.
            const canFillA = canSlotStillBeFilled(m, 'a', all, size, wbRounds, lbRounds);
            const canFillB = canSlotStillBeFilled(m, 'b', all, size, wbRounds, lbRounds);
            if (!canFillA && !canFillB) {
                db.prepare(
                    `UPDATE matches SET winner = NULL, loser = NULL, status = 'finished' WHERE id = ?`
                ).run(m.id);
                changed = true;
            }
        }
    }
}

/**
 * Détermine si le slot manquant d'un match peut encore être rempli par un match amont.
 */
function canSlotStillBeFilled(match, missingSlot, allMatches, size, wbRounds, lbRounds) {
    const { bracket, round, position } = match;

    if (bracket === 'winners') {
        if (round === 1) return false;
        const upstreamPos = missingSlot === 'a' ? 2 * position - 1 : 2 * position;
        const up = allMatches.find(x =>
            x.bracket === 'winners' && x.round === round - 1 && x.position === upstreamPos
        );
        return !!up && up.status !== 'finished';

    } else if (bracket === 'losers') {
        const isMajor = round % 2 === 0;

        if (round === 1) {
            const wbPos = missingSlot === 'a' ? 2 * position - 1 : 2 * position;
            const wbMatch = allMatches.find(x =>
                x.bracket === 'winners' && x.round === 1 && x.position === wbPos
            );
            return !!wbMatch && wbMatch.status !== 'finished';
        }

        if (isMajor) {
            if (missingSlot === 'a') {
                const wbRound = round / 2 + 1;
                const wbMatchesInRound = size / Math.pow(2, wbRound);
                const wbPos = wbMatchesInRound - position + 1;
                const wbMatch = allMatches.find(x =>
                    x.bracket === 'winners' && x.round === wbRound && x.position === wbPos
                );
                return !!wbMatch && wbMatch.status !== 'finished';
            } else {
                const lbPrev = allMatches.find(x =>
                    x.bracket === 'losers' && x.round === round - 1 && x.position === position
                );
                return !!lbPrev && lbPrev.status !== 'finished';
            }
        } else {
            const prevPos = missingSlot === 'a' ? 2 * position - 1 : 2 * position;
            const lbPrev = allMatches.find(x =>
                x.bracket === 'losers' && x.round === round - 1 && x.position === prevPos
            );
            return !!lbPrev && lbPrev.status !== 'finished';
        }

    } else if (bracket === 'grand_final') {
        if (missingSlot === 'a') {
            const wbFinal = allMatches.find(x =>
                x.bracket === 'winners' && x.round === wbRounds
            );
            return !!wbFinal && wbFinal.status !== 'finished';
        } else {
            const lbFinal = allMatches.find(x =>
                x.bracket === 'losers' && x.round === lbRounds
            );
            return !!lbFinal && lbFinal.status !== 'finished';
        }
    }

    return false;
}

/**
 * Propage le qualifié d'une BYE vers le match aval correspondant.
 */
function propagateByeWinner(match, winner, size, wbRounds, lbRounds) {
    if (match.bracket === 'winners') {
        // Gagnant : monte dans WB
        const nextRound = match.round + 1;
        if (nextRound > wbRounds) {
            // Finale WB par BYE → GF slot a
            const gf = db.prepare(`SELECT * FROM matches WHERE tournament_id = ?
                AND bracket = 'grand_final' AND round = 1 AND position = 1`).get(match.tournament_id);
            if (gf) db.prepare('UPDATE matches SET participant_a = ? WHERE id = ?').run(winner, gf.id);
        } else {
            const nextPos = Math.ceil(match.position / 2);
            const slot = match.position % 2 === 1 ? 'a' : 'b';
            const next = db.prepare(`SELECT * FROM matches WHERE tournament_id = ?
                AND bracket = 'winners' AND round = ? AND position = ?`)
                .get(match.tournament_id, nextRound, nextPos);
            if (next) db.prepare(`UPDATE matches SET participant_${slot} = ? WHERE id = ?`).run(winner, next.id);
        }
        // Perdant fantôme : on ne propage rien dans le LB (pas de perdant à descendre)
        // → le slot LB qui aurait reçu ce perdant restera NULL et sera traité par la
        //   passe suivante de propagateByesDouble comme un slot qui ne peut plus être rempli.

    } else if (match.bracket === 'losers') {
        const next = getLoserBracketNext(match.round, match.position, size, lbRounds);
        if (next === null) {
            // Finale LB par BYE → GF slot b
            const gf = db.prepare(`SELECT * FROM matches WHERE tournament_id = ?
                AND bracket = 'grand_final' AND round = 1 AND position = 1`).get(match.tournament_id);
            if (gf) db.prepare('UPDATE matches SET participant_b = ? WHERE id = ?').run(winner, gf.id);
        } else {
            const nextLb = db.prepare(`SELECT * FROM matches WHERE tournament_id = ?
                AND bracket = 'losers' AND round = ? AND position = ?`)
                .get(match.tournament_id, next.round, next.position);
            if (nextLb) db.prepare(`UPDATE matches SET participant_${next.slot} = ? WHERE id = ?`)
                .run(winner, nextLb.id);
        }
    }
    // grand_final BYE : ne devrait pas arriver
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
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });
    if (tournament.status !== 'open')
        return res.status(400).json({ error: 'Tournament already started' });

    const participants = getParticipantIds(tournament);
    if (participants.length < 2)
        return res.status(400).json({ error: 'At least 2 participants are required' });

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
                    throw new Error('The bracket has not been generated');
                }
                // Propage les BYE (slots vides au round 1) vers les rounds suivants
                propagateByes(tournament.id);

            } else if (tournament.format === 'double_elimination') {
                const count = db.prepare(
                    'SELECT COUNT(*) AS c FROM matches WHERE tournament_id = ?'
                ).get(tournament.id).c;
                if (count === 0) {
                    throw new Error('The bracket has not been generated');
                }
                propagateByesDouble(tournament.id, tournament.max_participants);
            }

            db.prepare(`UPDATE tournaments SET status = 'ongoing' WHERE id = ?`).run(tournament.id);
        });
        tx();
        res.json({ success: true });
    } catch (err) {
        console.error('Start tournament failed:', err);
        res.status(400).json({ error: err.message || 'Error starting the tournament' });
    }
});

// PUT /api/tournaments/:id/matches/:matchId — saisie/modification du score
router.put('/:id/matches/:matchId', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });
    if (tournament.status !== 'ongoing')
        return res.status(400).json({ error: 'Tournament is not ongoing' });

    const match = db.prepare(
        'SELECT * FROM matches WHERE id = ? AND tournament_id = ?'
    ).get(req.params.matchId, req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.participant_a == null || match.participant_b == null)
        return res.status(400).json({ error: 'Incomplete match: a participant is missing' });

    const { score_a, score_b } = req.body;
    const sa = Number(score_a);
    const sb = Number(score_b);
    if (!Number.isInteger(sa) || !Number.isInteger(sb) || sa < 0 || sb < 0)
        return res.status(400).json({ error: 'Invalid scores' });
    if (sa === sb)
        return res.status(400).json({ error: 'A match cannot end in a draw' });

    const winner = sa > sb ? match.participant_a : match.participant_b;
    const loser  = sa > sb ? match.participant_b : match.participant_a;

    // En single elim : si on MODIFIE un score déjà saisi, et que le gagnant change,
    // on bloque si des matchs en aval sont déjà joués (l'ancien gagnant est peut-être déjà en train de jouer)
    const isRealFinished = match.status === 'finished' && match.winner != null;
    if ((tournament.format === 'single_elimination' || tournament.format === 'double_elimination')
        && isRealFinished) {
        const winnerChanged = match.winner !== winner;
        if (winnerChanged) {
            if (tournament.format === 'single_elimination') {
                const downstreamPlayed = hasDownstreamPlayed(tournament.id, match);
                if (downstreamPlayed) {
                    return res.status(409).json({
                        error: 'Cannot change the winner: downstream matches have already been played'
                    });
                }
            } else {
                return res.status(409).json({
                    error: 'Cannot change the winner in double elimination'
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
                if (isRealFinished && match.winner !== winner) {
                    clearDownstreamSlot(tournament.id, match);
                }
                advanceSingleElim(tournament.id, match, winner);
            } else if (tournament.format === 'double_elimination') {
                advanceDoubleElim(tournament.id, match, winner, loser, tournament.max_participants);
            }
            // round_robin : pas d'avancement, le classement est recalculé à la lecture
        });
        tx();
        res.json({ success: true });
    } catch (err) {
        console.error('Set match score failed:', err);
        res.status(500).json({ error: 'Error saving the score' });
    }
});

// GET /api/tournaments/:id/standings — classement round-robin
router.get('/:id/standings', (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.format !== 'round_robin')
        return res.status(400).json({ error: 'Standings are only available in round robin format' });

    const participants = getParticipantIds(tournament);
    const matches = db.prepare(
        'SELECT * FROM matches WHERE tournament_id = ?'
    ).all(tournament.id);

    res.json(computeStandings(matches, participants));
});

// POST /api/tournaments/:id/finish — clôture manuelle du tournoi
router.post('/:id/finish', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });
    if (tournament.status !== 'ongoing')
        return res.status(400).json({ error: 'Tournament is not ongoing' });

    db.prepare(`UPDATE tournaments SET status = 'finished' WHERE id = ?`).run(tournament.id);
    res.json({ success: true });
});

module.exports = router;