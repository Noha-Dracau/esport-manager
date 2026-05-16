// server/src/utils/roundRobinGenerator.js

/**
 * Génère un calendrier round-robin (méthode du cercle).
 * Chaque participant affronte chaque autre participant exactement une fois.
 *
 * @param {Array<number>} participantIds
 * @returns {Array<{round, position, participant_a, participant_b}>}
 */
function generateRoundRobin(participantIds) {
    if (participantIds.length < 2) return [];

    const participants = [...participantIds];
    const isOdd = participants.length % 2 !== 0;
    if (isOdd) participants.push(null); // BYE placeholder (joueur qui se repose)

    const n = participants.length;
    const totalRounds = n - 1;
    const matchesPerRound = n / 2;
    const schedule = [];

    // On fixe le premier participant, on fait tourner les autres dans le sens horaire
    let rotating = participants.slice(1);

    for (let round = 1; round <= totalRounds; round++) {
        const lineup = [participants[0], ...rotating];
        let position = 1;

        for (let i = 0; i < matchesPerRound; i++) {
            const a = lineup[i];
            const b = lineup[n - 1 - i];
            // On saute les matchs contenant le BYE — ce participant se repose ce round
            if (a !== null && b !== null) {
                schedule.push({
                    round,
                    position: position++,
                    participant_a: a,
                    participant_b: b
                });
            }
        }

        // Rotation : le dernier élément revient en première position du segment tournant
        rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
    }

    return schedule;
}

/**
 * Calcule le classement round-robin à partir des matchs terminés.
 * Barème : victoire = 3 pts, défaite = 0 pt.
 * Départage : pts → victoires → confrontation directe → id (stable).
 *
 * @param {Array} matches - lignes matches de la base (avec winner, loser, status)
 * @param {Array<number>} participantIds
 * @returns {Array<{participant_id, played, wins, losses, points, rank}>}
 */
function computeStandings(matches, participantIds) {
    const table = {};
    for (const id of participantIds) {
        table[id] = { participant_id: id, played: 0, wins: 0, losses: 0, points: 0 };
    }

    // h2h[a][b] = 1 si a a battu b
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