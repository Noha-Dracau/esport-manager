function generateSingleElimination(participants, maxParticipants) {
    // On arrondit au prochain carré de 2
    const size = nextPowerOfTwo(maxParticipants);
    const rounds = Math.log2(size);
    const matches = [];

    // Round 1 — on place les participants dans les slots
    // Les slots vides sont des "BYE" (qualification automatique)
    const slots = [...participants];
    while (slots.length < size) slots.push(null); // complète avec des BYE

    for (let i = 0; i < size / 2; i++) {
        matches.push({
            round:         1,
            position:      i + 1,
            participant_a: slots[i * 2]     ?? null,
            participant_b: slots[i * 2 + 1] ?? null,
            winner:        null,
            status:        'pending'
        });
    }

    // Rounds suivants — slots vides, seront remplis au démarrage
    for (let r = 2; r <= rounds; r++) {
        const matchesInRound = size / Math.pow(2, r);
        for (let i = 0; i < matchesInRound; i++) {
            matches.push({
                round:         r,
                position:      i + 1,
                participant_a: null,
                participant_b: null,
                winner:        null,
                status:        'pending'
            });
        }
    }

    return { matches, rounds, size };
}

function nextPowerOfTwo(n) {
    let p = 1;
    while (p < n) p *= 2;
    return p;
}

module.exports = { generateSingleElimination };