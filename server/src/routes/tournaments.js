const router = require('express').Router();
const db     = require('../db/database');
const auth   = require('../middleware/auth');
const { uploadSingle, saveImage, deleteUpload } = require('../middleware/upload');

// GET /api/tournaments - list with optional filters
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
    const tournament = db.prepare(`
        SELECT t.*, u.username AS manager_username, u.discord_username AS manager_discord_username
        FROM tournaments t
        LEFT JOIN users u ON u.id = t.manager_id
        WHERE t.id = ?
    `).get(req.params.id);
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
    if (format === 'round_robin' && Number(max_participants) > 16)
        return res.status(400).json({ error: 'Round Robin tournaments are limited to 16 participants' });
    const logo_url = req.file ? await saveImage(req.file.buffer) : null;

    const result = db.prepare(`
    INSERT INTO tournaments (name, game, logo_url, description, date, format, max_participants, mode, manager_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, game, logo_url, description, date, format, max_participants, mode, req.user.id);

    res.status(201).json({ id: result.lastInsertRowid });
});

// POST /api/tournaments/:id/register - register for a tournament
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
        if (!user.team_id)
            return res.status(400).json({ error: 'You don\'t have a team' });

        const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(user.team_id);
        if (team.manager_id !== req.user.id)
            return res.status(403).json({ error: 'Only the team manager can register the team' });

        const existing = db.prepare(
            'SELECT * FROM registrations WHERE tournament_id = ? AND team_id = ?'
        ).get(req.params.id, user.team_id);
        if (existing)
            return res.status(409).json({ error: 'Your team is already registered' });

        db.prepare(
            'INSERT INTO registrations (tournament_id, team_id) VALUES (?, ?)'
        ).run(req.params.id, user.team_id);

    } else {
        // player mode
        const existing = db.prepare(
            'SELECT * FROM registrations WHERE tournament_id = ? AND user_id = ?'
        ).get(req.params.id, req.user.id);
        if (existing)
            return res.status(409).json({ error: 'You\'re already registered' });

        db.prepare(
            'INSERT INTO registrations (tournament_id, user_id) VALUES (?, ?)'
        ).run(req.params.id, req.user.id);
    }

    // clear the bracket — participant list changed
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
    if (effectiveFormat === 'round_robin' && Number(effectiveMaxParticip) > 16)
        return res.status(400).json({ error: 'Round Robin tournaments are limited to 16 participants' });
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

    // clear the bracket — participant list changed
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(req.params.id);

    res.json({ success: true });
});

const {
    generateSingleElimination,
    generateDoubleElimination,
    getLoserBracketTarget,
    getLoserBracketNext
} = require('../utils/bracketGenerator');

// GET /api/tournaments/:id/bracket - return the bracket
router.get('/:id/bracket', (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const matches = db.prepare(`
    SELECT * FROM matches WHERE tournament_id = ? ORDER BY round, position
  `).all(req.params.id);

    res.json({ matches, format: tournament.format, mode: tournament.mode });
});

// POST /api/tournaments/:id/bracket/generate - generate or regenerate the bracket
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

// PATCH /api/tournaments/:id/bracket/swap - swap two participants in the bracket
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

// DELETE /api/tournaments/:id/participants/:participantId - remove a participant (manager only)
router.delete('/:id/participants/:participantId', auth, (req, res) => {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.manager_id !== req.user.id)
        return res.status(403).json({ error: 'Unauthorized' });
    if (tournament.status !== 'open')
        return res.status(400).json({ error: 'Cannot remove a participant from a tournament that has already started' });

    const pid = Number(req.params.participantId);

    if (tournament.mode === 'players') {
        db.prepare('DELETE FROM registrations WHERE tournament_id = ? AND user_id = ?')
            .run(req.params.id, pid);
    } else {
        db.prepare('DELETE FROM registrations WHERE tournament_id = ? AND team_id = ?')
            .run(req.params.id, pid);
    }

    // clear the participant from the bracket (round 1 only)
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
 * Returns the participant IDs for a tournament (user_id or team_id depending on mode).
 *
 * @param {{ id: number, mode: string }} tournament
 * @returns {Array<number>}
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
 * Advances a single-elimination winner to the next round.
 * Round R, position P → round R+1, position ceil(P/2).
 * Slot 'a' if P is odd, 'b' if P is even (1-indexed, aligned with the generator).
 *
 * @param {number} tournamentId
 * @param {{ round: number, position: number }} match
 * @param {number} winnerId
 */
function advanceSingleElim(tournamentId, match, winnerId) {
    const nextRound = match.round + 1;
    const nextPosition = Math.ceil(match.position / 2);
    const slot = match.position % 2 === 1 ? 'a' : 'b';

    const next = db.prepare(`
        SELECT * FROM matches
        WHERE tournament_id = ? AND round = ? AND position = ?
    `).get(tournamentId, nextRound, nextPosition);

    if (!next) return; // final match

    db.prepare(`UPDATE matches SET participant_${slot} = ? WHERE id = ?`)
        .run(winnerId, next.id);

    // filling this slot may resolve a downstream BYE when max_participants > actual registrants
    propagateByes(tournamentId);
}

/**
 * Advances both winner and loser of a double-elimination match.
 * Routes depend on the match bracket ('winners', 'losers', or 'grand_final').
 *
 * @param {number} tournamentId
 * @param {{ bracket: string, round: number, position: number }} match
 * @param {number} winner
 * @param {number} loser
 * @param {number} maxParticipants
 */
function advanceDoubleElim(tournamentId, match, winner, loser, maxParticipants) {
    let size = 1;
    while (size < maxParticipants) size *= 2;
    const wbRounds = Math.log2(size);
    const lbRounds = 2 * (wbRounds - 1);

    if (match.bracket === 'winners') {
        // 1. Winner: advance in WB
        const nextWbRound = match.round + 1;
        if (nextWbRound > wbRounds) {
            // WB final — winner goes to grand_final slot a
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

        // 2. Loser: drop to LB
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
        // LB winner advances
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
        // LB loser: eliminated, nothing to propagate
    }
    // grand_final: nothing to propagate — tournament end is triggered manually

    // cascade BYE propagation after each advancement
    propagateByesDouble(tournamentId, maxParticipants);
}

/**
 * Iteratively propagates BYEs in a double-elimination bracket.
 *
 * BYE cases:
 *   - WB: one participant present → qualifies to WB R+1, generates no LB loser;
 *     the LB slot that awaited that loser is then treated as a BYE too
 *   - LB: one participant present → qualifies to LB R+1
 *   - Grand final: one participant present — should not happen
 *
 * @param {number} tournamentId
 * @param {number} maxParticipants
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

            // one participant present — standard BYE
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

            // Both slots empty: close the match only when no upstream match can fill either slot.
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
 * Returns true if the missing slot of a match can still be filled by an upstream match.
 *
 * @param {{ bracket: string, round: number, position: number }} match
 * @param {'a' | 'b'} missingSlot
 * @param {Array} allMatches - all matches for the tournament
 * @param {number} size
 * @param {number} wbRounds
 * @param {number} lbRounds
 * @returns {boolean}
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
 * Propagates the BYE winner to the next match.
 * Called when a match is closed as a BYE (only one participant present).
 *
 * @param {{ bracket: string, round: number, position: number, tournament_id: number }} match
 * @param {number} winner
 * @param {number} size
 * @param {number} wbRounds
 * @param {number} lbRounds
 */
function propagateByeWinner(match, winner, size, wbRounds, lbRounds) {
    if (match.bracket === 'winners') {
        // Winner: advance in WB
        const nextRound = match.round + 1;
        if (nextRound > wbRounds) {
            // WB final BYE — go to GF slot a
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
        // Ghost loser: nothing to propagate to LB (no one dropped out).
        // The LB slot that would have received this loser stays NULL and will be
        // resolved on the next propagateByesDouble pass as an unfillable slot.

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
    // grand_final BYE: should not happen
}

/**
 * Returns true if any downstream match (next rounds) has already been played.
 * Used to block score changes when later matches would be invalidated.
 *
 * @param {number} tournamentId
 * @param {{ round: number, position: number }} match
 * @returns {boolean}
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
 * Nullifies the slot in the next match that contained the previous winner.
 * Called when a score is corrected and the winner changes.
 *
 * @param {number} tournamentId
 * @param {{ round: number, position: number }} match
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
 * Iteratively propagates BYEs in a single-elimination bracket.
 * A "true" BYE is a match with one participant whose missing slot can no longer be filled.
 * Loops until stable because filling a slot can trigger further BYEs downstream.
 *
 * @param {number} tournamentId
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
            if (hasA && hasB) continue;
            if (!hasA && !hasB) continue; // dead match — both slots empty

            const present = hasA ? m.participant_a : m.participant_b;
            const missingSlot = hasA ? 'b' : 'a';

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

            // confirmed BYE — close and propagate
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
 * Marks the tournament as 'finished' if all matches have been played.
 *
 * @param {number} tournamentId
 * @param {string} format
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

// POST /api/tournaments/:id/start - start the tournament
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
                // round robin has no pre-seeding — generate the schedule at start time
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
                // Bracket already generated and seeded by the manager (drag & drop).
                // Guard: at least one round-1 match must exist.
                const r1Count = db.prepare(
                    'SELECT COUNT(*) AS c FROM matches WHERE tournament_id = ? AND round = 1'
                ).get(tournament.id).c;
                if (r1Count === 0) {
                    throw new Error('The bracket has not been generated');
                }
                // propagate BYEs from empty round-1 slots
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

// PUT /api/tournaments/:id/matches/:matchId - record or update a match score
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

    // If modifying an already-set score and the winner changes,
    // block if downstream matches have already been played.
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
            // round_robin: no advancement — standings are computed on read
        });
        tx();
        res.json({ success: true });
    } catch (err) {
        console.error('Set match score failed:', err);
        res.status(500).json({ error: 'Error saving the score' });
    }
});

// GET /api/tournaments/:id/standings - round-robin standings
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

// POST /api/tournaments/:id/finish - manually close a tournament
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