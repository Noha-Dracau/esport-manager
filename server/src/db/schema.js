const db = require('./database');

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
            participant_a INTEGER, -- user_id ou team_id selon le mode
            participant_b INTEGER,
            winner        INTEGER,
            status        TEXT DEFAULT 'pending'
            );
    `);

    runMigrations();

    console.log('Database successfully initialized');
}

function runMigrations() {
    try { db.exec("ALTER TABLE matches ADD COLUMN bracket TEXT DEFAULT 'winners'"); } catch (e) {}
    try { db.exec("ALTER TABLE matches ADD COLUMN loser INTEGER"); } catch (e) {}
    try { db.exec("ALTER TABLE matches ADD COLUMN score_a INTEGER"); } catch (e) {}
    try { db.exec("ALTER TABLE matches ADD COLUMN score_b INTEGER"); } catch (e) {}
    try { db.exec("ALTER TABLE users ADD COLUMN discord_username TEXT"); } catch (e) {}
    try { db.exec("ALTER TABLE teams ADD COLUMN bio TEXT"); } catch (e) {}
}

module.exports = { initSchema };