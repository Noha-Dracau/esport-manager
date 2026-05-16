import { useEffect, useState, useRef } from 'react';
import api from '../api/axios';
import ScoreModal from './ScoreModal';

export default function TournamentBracket({ tournament, isManager, canScore = false, onRefresh }) {
    const [bracket, setBracket]       = useState(null);
    const [names, setNames]           = useState({});
    const [dragging, setDragging]     = useState(null); // { matchId, slot }
    const [error, setError]           = useState('');
    const [editingMatch, setEditingMatch] = useState(null);

    async function handleSubmitScore(scoreA, scoreB) {
        await api.put(`/tournaments/${tournament.id}/matches/${editingMatch.id}`, {
            score_a: scoreA, score_b: scoreB
        });
        await fetchBracket();
        onRefresh?.();
    }

    async function fetchBracket() {
        const res = await api.get(`/tournaments/${tournament.id}/bracket`);
        setBracket(res.data);
        await fetchNames(res.data.matches, tournament.mode);
    }

    async function fetchNames(matches, mode) {
        const ids = new Set();
        matches.forEach(m => {
            if (m.participant_a) ids.add(m.participant_a);
            if (m.participant_b) ids.add(m.participant_b);
        });

        const nameMap = {};
        await Promise.all([...ids].map(async id => {
            try {
                if (mode === 'players') {
                    const res = await api.get(`/users/${id}`);
                    nameMap[id] = res.data.username;
                } else {
                    const res = await api.get(`/teams/${id}`);
                    nameMap[id] = res.data.name;
                }
            } catch { nameMap[id] = `#${id}`; }
        }));
        setNames(nameMap);
    }

    async function handleGenerate() {
        setError('');
        try {
            await api.post(`/tournaments/${tournament.id}/bracket/generate`);
            await fetchBracket();
            onRefresh();
        } catch (err) {
            setError(err.response?.data?.error || 'Error');
        }
    }

    async function handleDrop(targetMatchId, targetSlot) {
        if (!dragging) return;
        if (dragging.matchId === targetMatchId && dragging.slot === targetSlot) return;
        setError('');
        try {
            await api.patch(`/tournaments/${tournament.id}/bracket/swap`, {
                matchId:      dragging.matchId,
                slot:         dragging.slot,
                targetMatchId,
                targetSlot
            });
            await fetchBracket();
        } catch (err) {
            setError(err.response?.data?.error || 'Error');
        }
        setDragging(null);
    }

    async function handleKick(participantId) {
        if (!confirm('Remove this participant from the tournament?')) return;
        try {
            await api.delete(`/tournaments/${tournament.id}/participants/${participantId}`);
            await fetchBracket();
            onRefresh();
        } catch (err) {
            setError(err.response?.data?.error || 'Error');
        }
    }

    useEffect(() => { fetchBracket(); }, [tournament.id]);

    if (!bracket) return <p style={{ color: '#EAEAEA' }}>Loading of the bracket...</p>;

    const rounds = [...new Set(bracket.matches.map(m => m.round))].sort((a, b) => a - b);
    const totalRounds = rounds.length;

    return (
        <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Bracket</h3>
                {isManager && tournament.status === 'open' && (
                    <button onClick={handleGenerate} style={{
                        padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
                        background: '#14203E', color: '#FCA616', cursor: 'pointer'
                    }}>
                        Generate / Reset
                    </button>
                )}
            </div>

            {error && <p style={{ color: '#e74c3c', marginBottom: '1rem' }}>{error}</p>}

            {bracket.matches.length === 0 && (
                <div style={{ background: '#0f0f23', borderRadius: '12px', padding: '2rem', textAlign: 'center' }}>
                    <p style={{ color: '#FFFFFF', margin: 0 }}>
                        {isManager
                            ? 'Click "Generate" to automatically create the bracket.'
                            : 'The bracket has not been generated yet.'}
                    </p>
                </div>
            )}

            {bracket.matches.length > 0 && (
                <div style={{
                    overflowX: 'auto',
                    background: '#1a1a2e',
                    borderRadius: '12px',
                    padding: '1.5rem'
                }}>
                    <div style={{
                        display: 'flex',
                        gap: '2rem',
                        minWidth: `${totalRounds * 220}px`,
                        alignItems: 'stretch'
                    }}>
                        {rounds.map(round => {
                            const roundMatches = bracket.matches.filter(m => m.round === round);
                            const roundName = getRoundName(round, totalRounds);

                            return (
                                <div key={round} style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0',
                                    flex: 1,
                                    minWidth: '200px'
                                }}>
                                    {/* Title of the round */}
                                    <p style={{
                                        color: '#FCA616', fontWeight: 'bold', textAlign: 'center',
                                        marginBottom: '1rem', fontSize: '0.9rem'
                                    }}>
                                        {roundName}
                                    </p>

                                    {/* Matches of the round */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-around',
                                        flex: 1,
                                        gap: '1rem'
                                    }}>
                                        {roundMatches.map(match => (
                                            <MatchCard
                                                key={match.id}
                                                match={match}
                                                names={names}
                                                isSeedingManager={isManager && tournament.status === 'open' && round === 1}
                                                canScore={canScore && tournament.status === 'ongoing'}
                                                onEditScore={() => setEditingMatch(match)}
                                                dragging={dragging}
                                                onDragStart={(slot) => setDragging({ matchId: match.id, slot })}
                                                onDrop={(slot) => handleDrop(match.id, slot)}
                                                onDragEnd={() => setDragging(null)}
                                                onKick={handleKick}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {editingMatch && (
                <ScoreModal
                    match={editingMatch}
                    names={names}
                    onClose={() => setEditingMatch(null)}
                    onSubmit={handleSubmitScore}
                />
            )}
        </div>
    );
}

function MatchCard({ match, names, isSeedingManager, canScore, onEditScore, dragging, onDragStart, onDrop, onDragEnd, onKick }) {
    const done = match.status === 'finished';
    const wonByA = done && match.winner === match.participant_a;
    const wonByB = done && match.winner === match.participant_b;
    const bothReady = match.participant_a != null && match.participant_b != null;
    const clickableForScore = canScore && bothReady;

    return (
        <div
            style={{
                background: '#0f0f23', borderRadius: '8px',
                border: '1px solid #2a2a4a', overflow: 'hidden',
                cursor: clickableForScore ? 'pointer' : 'default'
            }}
            onClick={clickableForScore ? onEditScore : undefined}
        >
            {['a', 'b'].map(slot => {
                const pid = match[`participant_${slot}`];
                const name = pid ? (names[pid] || `#${pid}`) : null;
                const score = done ? match[`score_${slot}`] : null;
                const isDraggingThis = dragging?.matchId === match.id && dragging?.slot === slot;
                const isWinner = (slot === 'a' && wonByA) || (slot === 'b' && wonByB);
                const isLoser  = done && !isWinner && pid != null;

                return (
                    <div
                        key={slot}
                        draggable={isSeedingManager && !!pid}
                        onDragStart={(e) => { e.stopPropagation(); isSeedingManager && pid && onDragStart(slot); }}
                        onDragEnd={onDragEnd}
                        onDragOver={e => { e.preventDefault(); }}
                        onDrop={(e) => { e.stopPropagation(); isSeedingManager && onDrop(slot); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.5rem 0.7rem',
                            borderBottom: slot === 'a' ? '1px solid #2a2a4a' : 'none',
                            background: isDraggingThis ? '#FCA616' : isWinner ? '#14203E' : 'transparent',
                            cursor: isSeedingManager && pid ? 'grab' : 'inherit',
                            opacity: isLoser ? 0.5 : 1,
                            minHeight: '36px',
                            transition: 'background 0.15s'
                        }}
                    >
                        {pid ? (
                            <>
                                <div style={{
                                    width: '24px', height: '24px', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: '0.7rem', flexShrink: 0
                                }}>
                                    {name[0]?.toUpperCase()}
                                </div>
                                <span style={{
                                    flex: 1, fontSize: '0.85rem',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    color: isWinner ? '#FCA616' : '#EAEAEA',
                                    fontWeight: isWinner ? 'bold' : 'normal'
                                }}>
                                    {name}
                                </span>
                                {score != null && (
                                    <span style={{
                                        color: isWinner ? '#FCA616' : '#EAEAEA',
                                        fontWeight: 'bold', fontSize: '0.95rem'
                                    }}>{score}</span>
                                )}
                                {isSeedingManager && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onKick(pid); }}
                                        style={{
                                            padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem',
                                            border: '1px solid #e74c3c', background: 'transparent',
                                            color: '#e74c3c', cursor: 'pointer', flexShrink: 0
                                        }}
                                    >✕</button>
                                )}
                            </>
                        ) : (
                            <span style={{ color: '#a1a1a1', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                {isSeedingManager ? 'drag here' : 'TBD'}
                            </span>
                        )}
                    </div>
                );
            })}
            {clickableForScore && (
                <div style={{
                    padding: '0.3rem', borderTop: '1px solid #2a2a4a',
                    fontSize: '0.7rem', color: '#a1a1a1', textAlign: 'center'
                }}>
                    {done ? 'Modifier' : 'Saisir le score'}
                </div>
            )}
        </div>
    );
}

function getRoundName(round, totalRounds) {
    const remaining = totalRounds - round;
    if (remaining === 0) return 'Final';
    if (remaining === 1) return 'Semi finals';
    if (remaining === 2) return 'Quarter-finals';
    return `Round ${round}`;
}