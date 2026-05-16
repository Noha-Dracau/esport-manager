const router = require('express').Router();
const db     = require('../db/database');
const auth   = require('../middleware/auth');
const { uploadSingle, saveImage } = require('../middleware/upload');

// GET /api/teams?search=xxx
router.get('/', (req, res) => {
    const { search } = req.query;
    const query = search
        ? 'SELECT * FROM teams WHERE name LIKE ?'
        : 'SELECT * FROM teams';
    const params = search ? [`%${search}%`] : [];
    res.json(db.prepare(query).all(...params));
});

// GET /api/teams/:id
router.get('/:id', (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: 'Équipe introuvable' });

    const members = db.prepare(
        'SELECT id, username, avatar_url FROM users WHERE team_id = ?'
    ).all(req.params.id);

    const pending = db.prepare(
        'SELECT i.*, u.username FROM invitations i JOIN users u ON i.user_id = u.id WHERE i.team_id = ? AND i.status = ?'
    ).all(req.params.id, 'pending');

    const tournaments = db.prepare(`
    SELECT t.* FROM tournaments t
    JOIN registrations r ON r.tournament_id = t.id
    WHERE r.team_id = ?
  `).all(req.params.id);

    res.json({ ...team, members, pendingInvitations: pending, tournaments });
});

// POST /api/teams - create a team
router.post('/', auth, uploadSingle('logo'), async (req, res) => {
    const { name } = req.body;
    if (name && name.length > 50)
        return res.status(400).json({ error: "Field 'name' must not exceed 50 characters" });
    const logo_url = req.file ? await saveImage(req.file.buffer) : null;

    // Asserts the user is not in a team
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (user.team_id)
        return res.status(400).json({ error: 'You already have a team!' });

    try {
        const result = db.prepare(
            'INSERT INTO teams (name, logo_url, manager_id) VALUES (?, ?, ?)'
        ).run(name, logo_url, req.user.id);

        db.prepare('UPDATE users SET team_id = ? WHERE id = ?')
            .run(result.lastInsertRowid, req.user.id);

        res.status(201).json({ id: result.lastInsertRowid });
    } catch {
        res.status(409).json({ error: 'Team name already taken!' });
    }
});

// DELETE /api/teams/:id - delete the team (manager only)
router.delete('/:id', auth, (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: 'Unfound team' });
    if (team.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });

    // Removes the team for everyone
    db.prepare('UPDATE users SET team_id = NULL WHERE team_id = ?').run(req.params.id);
    // Removes linked invitations
    db.prepare('DELETE FROM invitations WHERE team_id = ?').run(req.params.id);
    // Deletes the team
    db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);

    res.json({ success: true });
});

// POST /api/teams/:id/leave - leaves the team (members only)
router.post('/:id/leave', auth, (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: 'Unfound team' });
    if (team.manager_id === req.user.id)
        return res.status(400).json({ error: 'Manager cannot leave their team.' });

    db.prepare('UPDATE users SET team_id = NULL WHERE id = ?').run(req.user.id);
    res.json({ success: true });
});

// POST /api/teams/:id/kick/:userId - kick a member (manager only)
router.post('/:id/kick/:userId', auth, (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: 'Unfound team' });
    if (team.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });
    if (team.manager_id === Number(req.params.userId))
        return res.status(400).json({ error: 'You cannot kick yourself.' });

    db.prepare('UPDATE users SET team_id = NULL WHERE id = ? AND team_id = ?')
        .run(req.params.userId, req.params.id);
    res.json({ success: true });
});

module.exports = router;