const db = require('./database');

/**
 * Creates all database tables if they do not exist and runs pending migrations.
 * Safe to call on every server start (idempotent).
 */
function initSchema() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
                                             id         INTEGER PRIMARY KEY AUTOINCREMENT,
                                             email      TEXT UNIQUE NOT NULL,
                                             password   TEXT NOT NULL,
                                             username   TEXT UNIQUE NOT NULL,
                                             avatar_url TEXT,
                                             team_id    INTEGER REFERENCES teams(id),
            created_at TEXT DEFAULT (datetime('now'))
            );

        CREATE TABLE IF NOT EXISTS teams (
                                             id         INTEGER PRIMARY KEY AUTOINCREMENT,
                                             name       TEXT UNIQUE NOT NULL,
                                             logo_url   TEXT,
                                             manager_id INTEGER NOT NULL REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now'))
            );

        CREATE TABLE IF NOT EXISTS tournaments (
                                                   id               INTEGER PRIMARY KEY AUTOINCREMENT,
                                                   name             TEXT NOT NULL,
                                                   game             TEXT NOT NULL,
                                                   logo_url         TEXT,
                                                   description      TEXT,
                                                   date             TEXT NOT NULL,
                                                   format           TEXT NOT NULL, -- 'single_elimination' | 'double_elimination' | 'round_robin'
                                                   max_participants INTEGER NOT NULL,
                                                   mode             TEXT NOT NULL, -- 'players' | 'teams'
                                                   manager_id       INTEGER NOT NULL REFERENCES users(id),
            status           TEXT DEFAULT 'open', -- 'open' | 'ongoing' | 'finished'
            created_at       TEXT DEFAULT (datetime('now'))
            );

        CREATE TABLE IF NOT EXISTS registrations (
                                                     id            INTEGER PRIMARY KEY AUTOINCREMENT,
                                                     tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
            user_id       INTEGER REFERENCES users(id),
            team_id       INTEGER REFERENCES teams(id),
            registered_at TEXT DEFAULT (datetime('now'))
            );

        CREATE TABLE IF NOT EXISTS invitations (
                                                   id          INTEGER PRIMARY KEY AUTOINCREMENT,
                                                   team_id     INTEGER NOT NULL REFERENCES teams(id),
            user_id     INTEGER NOT NULL REFERENCES users(id),
            status      TEXT DEFAULT 'pending', -- 'pending' | 'accepted' | 'declined'
            created_at  TEXT DEFAULT (datetime('now'))
            );

        CREATE TABLE IF NOT EXISTS matches (
                                               id            INTEGER PRIMARY KEY AUTOINCREMENT,
                                               tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
            round         INTEGER NOT NULL,
            position      INTEGER NOT NULL,
            participant_a INTEGER, -- user_id or team_id depending on tournament mode
            participant_b INTEGER,
            winner        INTEGER,
            status        TEXT DEFAULT 'pending'
            );
    `);

    runMigrations();

    console.log('Database successfully initialized');
}

/**
 * Applies additive schema changes that cannot be expressed in CREATE TABLE IF NOT EXISTS.
 * Each statement is wrapped in try/catch so already-applied migrations are silently skipped.
 */
function runMigrations() {
    try { db.exec("ALTER TABLE matches ADD COLUMN bracket TEXT DEFAULT 'winners'"); } catch (e) {}
    try { db.exec("ALTER TABLE matches ADD COLUMN loser INTEGER"); } catch (e) {}
    try { db.exec("ALTER TABLE matches ADD COLUMN score_a INTEGER"); } catch (e) {}
    try { db.exec("ALTER TABLE matches ADD COLUMN score_b INTEGER"); } catch (e) {}
    try { db.exec("ALTER TABLE users ADD COLUMN discord_username TEXT"); } catch (e) {}
    try { db.exec("ALTER TABLE teams ADD COLUMN bio TEXT"); } catch (e) {}

    // Drop UNIQUE on teams.name (was in CREATE TABLE), add deleted_at, create partial unique index.
    // Guard: skip if the partial index already exists (migration already applied).
    try {
        const indexed = db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='teams_name_active'").get();
        if (!indexed) {
            db.pragma('foreign_keys = OFF');
            db.exec(`CREATE TABLE teams_migrated (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                logo_url   TEXT,
                manager_id INTEGER NOT NULL REFERENCES users(id),
                created_at TEXT DEFAULT (datetime('now')),
                bio        TEXT,
                deleted_at TEXT
            )`);
            db.exec('INSERT INTO teams_migrated SELECT id, name, logo_url, manager_id, created_at, bio, NULL FROM teams');
            db.exec('DROP TABLE teams');
            db.exec('ALTER TABLE teams_migrated RENAME TO teams');
            db.exec("CREATE UNIQUE INDEX teams_name_active ON teams(name) WHERE deleted_at IS NULL");
            db.pragma('foreign_keys = ON');
        }
    } catch (e) {
        db.pragma('foreign_keys = ON');
        console.error('Migration teams_name_active failed:', e);
    }
}

module.exports = { initSchema };