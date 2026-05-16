// server/src/utils/bracketGenerator.js

/**
 * Génère un bracket single élimination.
 * Tous les matchs sont créés (avec slots vides pour les rounds > 1).
 * bracket = 'main' pour tous les matchs.
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
 * Génère un bracket double élimination.
 *
 * Structure :
 *   - bracket = 'winners' : winners bracket, comme single elim (R rounds)
 *   - bracket = 'losers'  : losers bracket, 2(R-1) rounds alternant minor/major
 *   - bracket = 'grand_final' : un seul match, round 1, position 1
 *
 * Convention LB :
 *   - Round LB impair (1, 3, 5...) = "minor" : les rescapés LB jouent entre eux
 *     ou les perdants WB y entrent (cas LB round 1 spécifiquement)
 *   - Round LB pair (2, 4, 6...) = "major" : les rescapés LB affrontent les nouveaux perdants WB
 *
 * Plus précisément :
 *   - LB round 1 : reçoit les perdants de WB round 1 (taille = size/4)
 *   - LB round 2 : reçoit les rescapés de LB round 1 + les perdants de WB round 2 (taille = size/4)
 *   - LB round 3 : minor pur, rescapés de LB round 2 (taille = size/8)
 *   - LB round 4 : major, rescapés LB round 3 + perdants WB round 3 (taille = size/8)
 *   - ... etc.
 *
 * Anti-snake : à chaque descente WB→LB, les perdants sont placés en ordre inversé pour
 * éviter de retomber sur leur ancien adversaire WB. Le mapping est calculé déterministiquement.
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
    // Tailles :
    //   - LB round 1 (minor) : size/4 matchs (reçoit les size/2 perdants de WB R1)
    //   - LB round 2 (major) : size/4 matchs (rescapés LB R1 + perdants WB R2)
    //   - LB round 3 (minor) : size/8 matchs (rescapés LB R2 entre eux)
    //   - LB round 4 (major) : size/8 matchs (rescapés LB R3 + perdants WB R3)
    //   - ...
    //   - LB round lbRounds : 1 match (finale LB)
    for (let lbR = 1; lbR <= lbRounds; lbR++) {
        const isMinor = lbR % 2 === 1; // minor sur rounds impairs
        // Le "pas" qui définit combien de joueurs restent à ce round
        // minor : taille = size / 2^( (lbR+3)/2 )  → simplification ci-dessous
        let matchCount;
        if (isMinor) {
            // lbR = 1 → size/4 ; lbR = 3 → size/8 ; lbR = 5 → size/16 ...
            matchCount = size / Math.pow(2, (lbR + 3) / 2);
        } else {
            // lbR = 2 → size/4 ; lbR = 4 → size/8 ; lbR = 6 → size/16 ...
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
 * Calcule où va le perdant d'un match WB.
 * Retourne { round, position, slot } dans le losers bracket, ou null si pas applicable.
 *
 * Mapping anti-snake :
 *   - Perdants de WB round 1 (taille size/2) → LB round 1 (taille size/4)
 *     Ordre direct : perdants des positions 1-2 → match LB position 1, etc.
 *     (premier round LB, pas d'anti-snake nécessaire car personne n'a encore croisé personne)
 *
 *   - Perdants de WB round R (R >= 2) → LB round 2(R-1) (major)
 *     Anti-snake : ordre inversé pour éviter qu'un joueur retombe sur son ancien adversaire WB.
 *
 * Le slot dans le match LB cible : 'a' si on entre en major depuis WB, ce qui laisse 'b' au rescapé LB.
 * Pour LB R1 (qui n'a pas de rescapé en entrée), on remplit a puis b par paires.
 */
function getLoserBracketTarget(wbRound, wbPosition, size) {
    if (wbRound === 1) {
        // size/2 perdants → size/4 matchs LB R1 : 2 perdants par match
        const lbPosition = Math.ceil(wbPosition / 2);
        const slot = wbPosition % 2 === 1 ? 'a' : 'b';
        return { round: 1, position: lbPosition, slot };
    }

    // WB round R (R >= 2) → LB round 2(R-1) (major round)
    const lbRound = 2 * (wbRound - 1);
    // Nombre de matchs WB round R = size / 2^R, et nombre de matchs LB major R = pareil
    const wbMatchesInRound = size / Math.pow(2, wbRound);
    // Anti-snake : inversion de l'ordre
    const lbPosition = wbMatchesInRound - wbPosition + 1;
    // Le perdant WB prend le slot 'a' du match LB major (le rescapé LB précédent prend 'b')
    return { round: lbRound, position: lbPosition, slot: 'a' };
}

/**
 * Calcule où va le gagnant d'un match LB.
 * Retourne { round, position, slot } dans le losers bracket, ou null si c'était la finale LB.
 *
 * Convention :
 *   - Gagnant LB round impair (minor) → LB round R+1 (major), slot 'b' (le slot 'a' attend un perdant WB)
 *   - Gagnant LB round pair (major) → LB round R+1 (minor), pair par pair sur le slot 'a' ou 'b'
 *   - Gagnant de la finale LB (round = lbRounds) → grand final, slot 'b'
 */
function getLoserBracketNext(lbRound, lbPosition, size, lbRounds) {
    if (lbRound === lbRounds) {
        return null; // finale LB, va en GF
    }

    const isMinor = lbRound % 2 === 1;

    if (isMinor) {
        // → major round suivant, slot 'b' (le 'a' attend un perdant WB)
        return { round: lbRound + 1, position: lbPosition, slot: 'b' };
    } else {
        // major → minor : on apparie les gagnants 2 par 2
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