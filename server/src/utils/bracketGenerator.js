/**
 * Generates a single-elimination bracket.
 * All matches are created upfront; round 2+ slots start empty.
 * All matches use bracket = 'main'.
 *
 * @param {Array<number>} participants - ordered list of participant IDs
 * @param {number} maxParticipants - determines bracket size (next power of 2)
 * @returns {{ matches: Array, rounds: number, size: number }}
 */
function generateSingleElimination(participants, maxParticipants) {
    const size = nextPowerOfTwo(maxParticipants);
    const rounds = Math.log2(size);
    const matches = [];

    const slots = [...participants];
    while (slots.length < size) slots.push(null);

    for (let i = 0; i < size / 2; i++) {
        matches.push({
            round: 1, position: i + 1, bracket: 'main',
            participant_a: slots[i * 2] ?? null,
            participant_b: slots[i * 2 + 1] ?? null,
            winner: null, status: 'pending'
        });
    }

    for (let r = 2; r <= rounds; r++) {
        const matchesInRound = size / Math.pow(2, r);
        for (let i = 0; i < matchesInRound; i++) {
            matches.push({
                round: r, position: i + 1, bracket: 'main',
                participant_a: null, participant_b: null,
                winner: null, status: 'pending'
            });
        }
    }

    return { matches, rounds, size };
}

/**
 * Generates a double-elimination bracket.
 *
 * Structure:
 *   - bracket = 'winners':    winners bracket, like single elim (R rounds)
 *   - bracket = 'losers':     losers bracket, 2(R-1) rounds alternating minor/major
 *   - bracket = 'grand_final': one match, round 1, position 1
 *
 * LB convention:
 *   - Odd LB rounds (1, 3, 5…) = "minor": LB survivors play each other
 *     (WB round-1 losers feed in for LB round 1 specifically)
 *   - Even LB rounds (2, 4, 6…) = "major": LB survivors face incoming WB losers
 *
 * LB sizing:
 *   - LB round 1 (minor): size/4 matches  (receives size/2 WB R1 losers)
 *   - LB round 2 (major): size/4 matches  (LB R1 survivors + WB R2 losers)
 *   - LB round 3 (minor): size/8 matches  (LB R2 survivors)
 *   - LB round 4 (major): size/8 matches  (LB R3 survivors + WB R3 losers)
 *   - … etc.
 *   - LB round lbRounds:  1 match         (LB final)
 *
 * Anti-snake: on each WB→LB drop, losers are placed in reverse order to avoid
 * rematches against their previous WB opponent. Mapping is deterministic.
 *
 * @param {Array<number>} participants - ordered list of participant IDs
 * @param {number} maxParticipants - determines bracket size (next power of 2)
 * @returns {{ matches: Array, wbRounds: number, lbRounds: number, size: number }}
 */
function generateDoubleElimination(participants, maxParticipants) {
    const size = nextPowerOfTwo(maxParticipants);
    const wbRounds = Math.log2(size);
    const lbRounds = 2 * (wbRounds - 1);
    const matches = [];

    // -------- Winners Bracket --------
    const slots = [...participants];
    while (slots.length < size) slots.push(null);

    for (let i = 0; i < size / 2; i++) {
        matches.push({
            round: 1, position: i + 1, bracket: 'winners',
            participant_a: slots[i * 2] ?? null,
            participant_b: slots[i * 2 + 1] ?? null,
            winner: null, status: 'pending'
        });
    }
    for (let r = 2; r <= wbRounds; r++) {
        const matchesInRound = size / Math.pow(2, r);
        for (let i = 0; i < matchesInRound; i++) {
            matches.push({
                round: r, position: i + 1, bracket: 'winners',
                participant_a: null, participant_b: null,
                winner: null, status: 'pending'
            });
        }
    }

    // -------- Losers Bracket --------
    for (let lbR = 1; lbR <= lbRounds; lbR++) {
        const isMinor = lbR % 2 === 1; // odd rounds are minor
        // match count per LB round — minor: size / 2^((lbR+3)/2)
        let matchCount;
        if (isMinor) {
            // lbR = 1 → size/4; lbR = 3 → size/8; lbR = 5 → size/16 …
            matchCount = size / Math.pow(2, (lbR + 3) / 2);
        } else {
            // lbR = 2 → size/4; lbR = 4 → size/8; lbR = 6 → size/16 …
            matchCount = size / Math.pow(2, (lbR + 2) / 2);
        }
        matchCount = Math.max(1, Math.floor(matchCount));

        for (let i = 0; i < matchCount; i++) {
            matches.push({
                round: lbR, position: i + 1, bracket: 'losers',
                participant_a: null, participant_b: null,
                winner: null, status: 'pending'
            });
        }
    }

    // -------- Grand Final --------
    matches.push({
        round: 1, position: 1, bracket: 'grand_final',
        participant_a: null, participant_b: null,
        winner: null, status: 'pending'
    });

    return { matches, wbRounds, lbRounds, size };
}

function nextPowerOfTwo(n) {
    let p = 1;
    while (p < n) p *= 2;
    return p;
}

/**
 * Returns where a WB match loser goes in the losers bracket.
 * Returns { round, position, slot } in the LB.
 *
 * Anti-snake mapping:
 *   - WB round 1 losers (size/2) → LB round 1 (size/4 matches)
 *     Direct order: losers from positions 1-2 → LB match 1, etc.
 *     (No anti-snake needed for LB R1 — no one has faced anyone yet.)
 *
 *   - WB round R losers (R >= 2) → LB round 2(R-1) (major)
 *     Anti-snake: reversed order to prevent rematches against a previous WB opponent.
 *
 * Slot in the target LB match: 'a' for WB drop-ins (leaving 'b' for the LB survivor).
 * For LB R1 (no survivor entering), pairs fill both 'a' and 'b'.
 *
 * @param {number} wbRound - winners bracket round of the finished match
 * @param {number} wbPosition - position of the finished match (1-indexed)
 * @param {number} size - bracket size (next power of 2 from maxParticipants)
 * @returns {{ round: number, position: number, slot: 'a' | 'b' }}
 */
function getLoserBracketTarget(wbRound, wbPosition, size) {
    if (wbRound === 1) {
        // size/2 losers → size/4 LB R1 matches: 2 losers per match
        const lbPosition = Math.ceil(wbPosition / 2);
        const slot = wbPosition % 2 === 1 ? 'a' : 'b';
        return { round: 1, position: lbPosition, slot };
    }

    // WB round R (R >= 2) → LB round 2(R-1) (major round)
    const lbRound = 2 * (wbRound - 1);
    // WB matches in round R = size / 2^R, same as LB major matches
    const wbMatchesInRound = size / Math.pow(2, wbRound);
    // anti-snake: reverse the order
    const lbPosition = wbMatchesInRound - wbPosition + 1;
    // WB loser takes slot 'a' in the LB major match (LB survivor takes 'b')
    return { round: lbRound, position: lbPosition, slot: 'a' };
}

/**
 * Returns where a LB match winner goes next in the losers bracket.
 * Returns { round, position, slot }, or null if this was the LB final.
 *
 * Routing:
 *   - Odd LB round (minor) winner → LB round R+1 (major), slot 'b'
 *     (slot 'a' is reserved for the incoming WB loser)
 *   - Even LB round (major) winner → LB round R+1 (minor), paired into slot 'a' or 'b'
 *   - LB final winner (round = lbRounds) → grand final, slot 'b'
 *
 * @param {number} lbRound - current LB round
 * @param {number} lbPosition - position within the LB round (1-indexed)
 * @param {number} size - bracket size
 * @param {number} lbRounds - total number of LB rounds
 * @returns {{ round: number, position: number, slot: 'a' | 'b' } | null}
 */
function getLoserBracketNext(lbRound, lbPosition, size, lbRounds) {
    if (lbRound === lbRounds) {
        return null; // LB final — goes to GF
    }

    const isMinor = lbRound % 2 === 1;

    if (isMinor) {
        // → next major round, slot 'b' (slot 'a' is reserved for a WB loser)
        return { round: lbRound + 1, position: lbPosition, slot: 'b' };
    } else {
        // major → minor: pair winners 2 by 2
        const nextPosition = Math.ceil(lbPosition / 2);
        const slot = lbPosition % 2 === 1 ? 'a' : 'b';
        return { round: lbRound + 1, position: nextPosition, slot };
    }
}

module.exports = {
    generateSingleElimination,
    generateDoubleElimination,
    getLoserBracketTarget,
    getLoserBracketNext
};