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

module.exports = router;