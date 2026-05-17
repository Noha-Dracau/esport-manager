const router = require('express').Router();
const db     = require('../db/database');
const auth   = require('../middleware/auth');

router.post('/', auth, (req, res) => {
    const { team_id } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (user.team_id) return res.status(400).json({ error: 'Already in a team.' });

    // Asserts there is no other pending request
    const existing = db.prepare(
        'SELECT i.*, t.name as team_name FROM invitations i JOIN teams t ON i.team_id = t.id WHERE i.user_id = ? AND i.status = ?'
    ).get(req.user.id, 'pending');
    if (existing)
        return res.status(409).json({
            error: `You already have a pending request in "${existing.team_name}".`
        });

    db.prepare(
        'INSERT INTO invitations (team_id, user_id) VALUES (?, ?)'
    ).run(team_id, req.user.id);
    res.json({ success: true });
});

// PATCH /api/invitations/:id - Accept or decline
router.patch('/:id', auth, (req, res) => {
    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status))
        return res.status(400).json({ error: "Invalid status: must be 'accepted' or 'declined'" });

    const invitation = db.prepare('SELECT * FROM invitations WHERE id = ?').get(req.params.id);
    if (!invitation) return res.status(404).json({ error: 'Unfound invitation' });

    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(invitation.team_id);
    if (team.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });

    if (status === 'accepted') {
        // Asserts the user has no team
        const invitedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(invitation.user_id);
        if (invitedUser.team_id)
            return res.status(400).json({ error: 'This player already joined a team.' });

        db.prepare('UPDATE users SET team_id = ? WHERE id = ?')
            .run(invitation.team_id, invitation.user_id);
        // Deletes all other pending invitations
        db.prepare(
            'UPDATE invitations SET status = ? WHERE user_id = ? AND status = ? AND id != ?'
        ).run('declined', invitation.user_id, 'pending', invitation.id);
    }

    db.prepare('UPDATE invitations SET status = ? WHERE id = ?')
        .run(status, req.params.id);

    res.json({ success: true });
});

// DELETE /api/invitations/:id - cancel their request
router.delete('/:id', auth, (req, res) => {
    const invitation = db.prepare('SELECT * FROM invitations WHERE id = ?').get(req.params.id);
    if (!invitation) return res.status(404).json({ error: 'Unfound invitation' });

    // Asserts it's their request
    if (invitation.user_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });

    // We can only cancel pending requests
    if (invitation.status !== 'pending')
        return res.status(400).json({ error: 'This request has already been treated.' });

    db.prepare('DELETE FROM invitations WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

module.exports = router;