const router = require('express').Router();
const db     = require('../db/database');
const auth   = require('../middleware/auth');
const { uploadSingle, saveImage, deleteUpload } = require('../middleware/upload');

// GET /api/users/me - connected user profile
router.get('/me', auth, (req, res) => {
  const user = db.prepare(
    'SELECT id, email, username, avatar_url, team_id FROM users WHERE id = ?'
  ).get(req.user.id);
  res.json(user);
});

// GET /api/users/me/tournaments — tournois auxquels l'utilisateur participe
router.get('/me/tournaments', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  // Tournois en tant que joueur
  const asPlayer = db.prepare(`
    SELECT t.* FROM tournaments t
    JOIN registrations r ON r.tournament_id = t.id
    WHERE r.user_id = ?
  `).all(req.user.id);

  // Tournois en tant qu'équipe (si manager)
  let asTeam = [];
  if (user.team_id) {
    asTeam = db.prepare(`
      SELECT t.* FROM tournaments t
      JOIN registrations r ON r.tournament_id = t.id
      WHERE r.team_id = ?
    `).all(user.team_id);
  }

  // Tournois créés par l'utilisateur
  const asManager = db.prepare(
      'SELECT * FROM tournaments WHERE manager_id = ?'
  ).all(req.user.id);

  res.json({ asPlayer, asTeam, asManager });
});

// GET /api/users/:id — profil public d'un utilisateur
router.get('/:id', (req, res) => {
  const user = db.prepare(
      'SELECT id, username, avatar_url FROM users WHERE id = ?'
  ).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(user);
});

// PATCH /api/users/me - change profile
router.patch('/me', auth, uploadSingle('avatar'), async (req, res) => {
  const { username } = req.body;
  if (username && username.length > 30)
    return res.status(400).json({ error: "Field 'username' must not exceed 30 characters" });

  if (req.file) {
    const current = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(req.user.id);
    if (current?.avatar_url) deleteUpload(current.avatar_url);
  }
  const avatar_url = req.file ? await saveImage(req.file.buffer) : undefined;

  const fields = [];
  const params = [];

  if (username)   { fields.push('username = ?');   params.push(username); }
  if (avatar_url) { fields.push('avatar_url = ?'); params.push(avatar_url); }

  if (fields.length === 0)
    return res.status(400).json({ error: 'Nothing to modify!' });

  params.push(req.user.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

module.exports = router;
