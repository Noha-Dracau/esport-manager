const router = require('express').Router();
const db     = require('../db/database');
const auth   = require('../middleware/auth');
const { uploadSingle, saveImage, deleteUpload } = require('../middleware/upload');

// GET /api/teams?search=xxx
router.get('/', (req, res) => {
    const { search } = req.query;
    const query = search
        ? 'SELECT * FROM teams WHERE deleted_at IS NULL AND name LIKE ? ORDER BY name COLLATE NOCASE ASC'
        : 'SELECT * FROM teams WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC';
    const params = search ? [`%${search}%`] : [];
    res.json(db.prepare(query).all(...params));
});

// GET /api/teams/:id
router.get('/:id', (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const members = db.prepare(
        'SELECT id, username, avatar_url, discord_username FROM users WHERE team_id = ?'
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

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (user.team_id)
        return res.status(400).json({ error: 'You already have a team!' });

    const nameTaken = db.prepare('SELECT 1 FROM teams WHERE name = ? AND deleted_at IS NULL').get(name);
    if (nameTaken) return res.status(409).json({ error: 'Team name already taken!' });

    try {
        const result = db.prepare(
            'INSERT INTO teams (name, logo_url, manager_id) VALUES (?, ?, ?)'
        ).run(name, logo_url, req.user.id);

        db.prepare('UPDATE users SET team_id = ? WHERE id = ?')
            .run(result.lastInsertRowid, req.user.id);

        res.status(201).json({ id: result.lastInsertRowid });
    } catch (err) {
        if (err.message?.includes('UNIQUE'))
            return res.status(409).json({ error: 'Team name already taken!' });
        res.status(500).json({ error: 'Database error' });
    }
});

// PATCH /api/teams/:id - update name and/or logo (manager only)
router.patch('/:id', auth, uploadSingle('logo'), async (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });
    if (team.deleted_at)
        return res.status(400).json({ error: 'Team has been disbanded' });

    const { name, bio } = req.body;
    if (name && name.length > 50)
        return res.status(400).json({ error: "Field 'name' must not exceed 50 characters" });
    if (name && name !== team.name) {
        const nameTaken = db.prepare(
            'SELECT 1 FROM teams WHERE name = ? AND deleted_at IS NULL AND id != ?'
        ).get(name, req.params.id);
        if (nameTaken) return res.status(409).json({ error: 'Team name already taken!' });
    }

    let bioValue = team.bio;
    if (bio !== undefined) {
        const bioTrimmed = bio.trim();
        if (bioTrimmed.length > 200)
            return res.status(400).json({ error: "Field 'bio' must not exceed 200 characters" });
        bioValue = bioTrimmed === '' ? null : bioTrimmed;
    }

    if (req.file && team.logo_url) deleteUpload(team.logo_url);
    const logo_url = req.file ? await saveImage(req.file.buffer) : team.logo_url;

    db.prepare('UPDATE teams SET name = ?, logo_url = ?, bio = ? WHERE id = ?')
        .run(name || team.name, logo_url, bioValue, req.params.id);

    res.json({ success: true });
});

// DELETE /api/teams/:id - disband the team (soft delete, manager only)
router.delete('/:id', auth, (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });
    if (team.deleted_at)
        return res.status(400).json({ error: 'Team is already disbanded' });

    try {
        const disband = db.transaction(() => {
            // Unregister from open tournaments and invalidate their brackets
            const openRegs = db.prepare(`
                SELECT r.tournament_id FROM registrations r
                JOIN tournaments t ON t.id = r.tournament_id
                WHERE r.team_id = ? AND t.status = 'open'
            `).all(req.params.id);
            for (const reg of openRegs) {
                db.prepare('DELETE FROM registrations WHERE tournament_id = ? AND team_id = ?')
                    .run(reg.tournament_id, req.params.id);
                db.prepare('DELETE FROM matches WHERE tournament_id = ?')
                    .run(reg.tournament_id);
            }

            // Disaffiliate all members (including manager)
            db.prepare('UPDATE users SET team_id = NULL WHERE team_id = ?').run(req.params.id);

            // Delete pending invitations
            db.prepare('DELETE FROM invitations WHERE team_id = ?').run(req.params.id);

            // Soft delete
            db.prepare("UPDATE teams SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
        });

        disband();
        deleteUpload(team.logo_url);
        res.json({ success: true });
    } catch (err) {
        console.error('Disband team failed:', err);
        res.status(500).json({ error: 'Error disbanding the team' });
    }
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