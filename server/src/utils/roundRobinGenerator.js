/**
 * Generates a round-robin schedule using the circle method.
 * Each participant faces every other participant exactly once.
 *
 * @param {Array<number>} participantIds
 * @returns {Array<{round: number, position: number, participant_a: number, participant_b: number}>}
 */
function generateRoundRobin(participantIds) {
    if (participantIds.length < 2) return [];

    const participants = [...participantIds];
    const isOdd = participants.length % 2 !== 0;
    if (isOdd) participants.push(null); // BYE placeholder — this participant rests for one round

    const n = participants.length;
    const totalRounds = n - 1;
    const matchesPerRound = n / 2;
    const schedule = [];

    // First participant stays fixed; the rest rotate clockwise
    let rotating = participants.slice(1);

    for (let round = 1; round <= totalRounds; round++) {
        const lineup = [participants[0], ...rotating];
        let position = 1;

        for (let i = 0; i < matchesPerRound; i++) {
            const a = lineup[i];
            const b = lineup[n - 1 - i];
            // Skip BYE matches — one participant rests this round
            if (a !== null && b !== null) {
                schedule.push({
                    round,
                    position: position++,
                    participant_a: a,
                    participant_b: b
                });
            }
        }

        // Rotate: last element wraps to the front of the rotating segment
        rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
    }

    return schedule;
}

/**
 * Computes round-robin standings from finished matches.
 * Scoring: win = 3 pts, loss = 0 pts.
 * Tiebreakers: points → wins → head-to-head → id (stable).
 *
 * @param {Array} matches - match rows from the database (with winner, loser, status)
 * @param {Array<number>} participantIds
 * @returns {Array<{participant_id: number, played: number, wins: number, losses: number, points: number, rank: number}>}
 */
function computeStandings(matches, participantIds) {
    const table = {};
    for (const id of participantIds) {
        table[id] = { participant_id: id, played: 0, wins: 0, losses: 0, points: 0 };
    }

    // h2h[a][b] = 1 if a defeated b
    const h2h = {};

    for (const m of matches) {
        if (m.status !== 'finished' || m.winner == null) continue;
        const w = m.winner, l = m.loser;
        if (table[w]) { table[w].wins++; table[w].played++; table[w].points += 3; }
        if (table[l]) { table[l].losses++; table[l].played++; }
        h2h[w] = h2h[w] || {};
        h2h[w][l] = 1;
    }

    const sorted = Object.values(table).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (h2h[a.participant_id]?.[b.participant_id]) return -1;
        if (h2h[b.participant_id]?.[a.participant_id]) return 1;
        return a.participant_id - b.participant_id;
    });

    const result = [];
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
        const rank = (i > 0 && sorted[i].points === sorted[i - 1].points)
            ? result[i - 1].rank
            : currentRank;
        result.push({ ...sorted[i], rank });
        currentRank++;
    }
    return result;
}

module.exports = { generateRoundRobin, computeStandings };