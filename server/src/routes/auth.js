const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db/database');

// POST /api/auth/register
router.post('/register', (req, res) => {
    const { email, password, username } = req.body;
    if (!email || !password || !username)
        return res.status(400).json({ error: 'Missing fields!' });

    const hash = bcrypt.hashSync(password, 10);
    try {
        const stmt = db.prepare(
            'INSERT INTO users (email, password, username) VALUES (?, ?, ?)'
        );
        const result = stmt.run(email, hash, username);
        const token = jwt.sign(
            { id: result.lastInsertRowid, username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.json({ token, userId: result.lastInsertRowid, username });
    } catch (err) {
        if (err.message.includes('UNIQUE'))
            return res.status(409).json({ error: 'Email or nickname already exists!' });
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password))
        return res.status(401).json({ error: 'Incorrect identifiers!' });

    const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
    res.json({ token, userId: user.id, username: user.username, teamId: user.team_id });
});

module.exports = router;