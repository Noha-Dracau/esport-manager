import { useEffect, useState } from 'react';
import api from '../api/axios';
import ScoreModal from './ScoreModal';

export default function RoundRobinView({ tournamentId, mode, isManager, tournamentStatus, onUpdate }) {
    const [matches, setMatches]     = useState([]);
    const [standings, setStandings] = useState([]);
    const [names, setNames]         = useState({});
    const [images, setImages]       = useState({});
    const [error, setError]         = useState('');
    const [editingMatch, setEditingMatch] = useState(null);

    async function loadAll() {
        try {
            const [bracketRes, standingsRes] = await Promise.all([
                api.get(`/tournaments/${tournamentId}/bracket`),
                api.get(`/tournaments/${tournamentId}/standings`)
            ]);
            setMatches(bracketRes.data.matches);
            setStandings(standingsRes.data);
            await fetchNames(bracketRes.data.matches, standingsRes.data, mode);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load');
        }
    }

    async function fetchNames(matchesArr, standingsArr, mode) {
        const ids = new Set();
        matchesArr.forEach(m => {
            if (m.participant_a) ids.add(m.participant_a);
            if (m.participant_b) ids.add(m.participant_b);
        });
        standingsArr.forEach(s => ids.add(s.participant_id));

        const nameMap  = {};
        const imageMap = {};
        await Promise.all([...ids].map(async id => {
            try {
                const url = mode === 'players' ? `/users/${id}` : `/teams/${id}`;
                const res = await api.get(url);
                nameMap[id]  = mode === 'players' ? res.data.username : res.data.name;
                imageMap[id] = mode === 'players' ? (res.data.avatar_url || null) : (res.data.logo_url || null);
            } catch { nameMap[id] = `#${id}`; }
        }));
        setNames(nameMap);
        setImages(imageMap);
    }

    useEffect(() => { loadAll(); }, [tournamentId]);

    async function submitScore(scoreA, scoreB) {
        await api.put(`/tournaments/${tournamentId}/matches/${editingMatch.id}`, {
            score_a: scoreA, score_b: scoreB
        });
        await loadAll();
        onUpdate?.();
    }

    const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);
    const canEdit = isManager && tournamentStatus === 'ongoing';

    return (
        <div>
            {error && (
                <p style={errorBox}>{error}</p>
            )}

            <h3 style={{ color: '#FCA616', marginTop: 0 }}>Standings</h3>
            <div style={tableWrap}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#EAEAEA' }}>
                    <thead>
                    <tr style={{ borderBottom: '1px solid #2a2a4a' }}>
                        <th style={th}>#</th>
                        <th style={{ ...th, textAlign: 'left' }}>
                            {mode === 'teams' ? 'Team' : 'Player'}
                        </th>
                        <th style={th}>P</th>
                        <th style={th}>W</th>
                        <th style={th}>L</th>
                        <th style={th}>Pts</th>
                    </tr>
                    </thead>
                    <tbody>
                    {standings.map(row => (
                        <tr key={row.participant_id} style={{ borderBottom: '1px solid #14203E' }}>
                            <td style={td}>{row.rank}</td>
                            <td style={{ ...td, textAlign: 'left' }}>
                                {names[row.participant_id] || `#${row.participant_id}`}
                            </td>
                            <td style={td}>{row.played}</td>
                            <td style={td}>{row.wins}</td>
                            <td style={td}>{row.losses}</td>
                            <td style={{ ...td, color: '#FCA616', fontWeight: 'bold' }}>{row.points}</td>
                        </tr>
                    ))}
                    {standings.length === 0 && (
                        <tr><td colSpan={6} style={{ ...td, color: '#a1a1a1', fontStyle: 'italic' }}>
                            No matches finished yet.
                        </td></tr>
                    )}
                    </tbody>
                </table>
            </div>

            <h3 style={{ color: '#FCA616' }}>Matches</h3>
            {rounds.map(round => {
                const list = matches.filter(m => m.round === round);
                return (
                    <div key={round} style={{ marginBottom: '1.5rem' }}>
                        <p style={{ color: '#a1a1a1', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                            Round {round}
                        </p>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '0.8rem'
                        }}>
                            {list.map(m => (
                                <RRMatchCard
                                    key={m.id}
                                    match={m}
                                    names={names}
                                    images={images}
                                    canEdit={canEdit}
                                    onEdit={() => setEditingMatch(m)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}

            {editingMatch && (
                <ScoreModal
                    match={editingMatch}
                    names={names}
                    onClose={() => setEditingMatch(null)}
                    onSubmit={submitScore}
                />
            )}
        </div>
    );
}

function RRMatchCard({ match, names, images, canEdit, onEdit }) {
    const done = match.status === 'finished';
    const wonByA = done && match.winner === match.participant_a;
    const wonByB = done && match.winner === match.participant_b;

    return (
        <div style={{
            background: '#0f0f23', borderRadius: '8px',
            border: '1px solid #2a2a4a', overflow: 'hidden',
            cursor: canEdit ? 'pointer' : 'default'
        }}
             onClick={canEdit ? onEdit : undefined}
        >
            <SideRow
                pid={match.participant_a} name={names[match.participant_a]}
                image={images[match.participant_a]}
                score={done ? match.score_a : null}
                highlighted={wonByA} faded={done && !wonByA}
                borderBottom
            />
            <SideRow
                pid={match.participant_b} name={names[match.participant_b]}
                image={images[match.participant_b]}
                score={done ? match.score_b : null}
                highlighted={wonByB} faded={done && !wonByB}
            />
            {canEdit && (
                <div style={{
                    padding: '0.4rem 0.8rem', borderTop: '1px solid #2a2a4a',
                    fontSize: '0.75rem', color: '#a1a1a1', textAlign: 'center'
                }}>
                    {done ? 'Click to edit' : 'Click to enter score'}
                </div>
            )}
        </div>
    );
}

function SideRow({ pid, name, image, score, highlighted, faded, borderBottom }) {
    const label = pid ? (name || `#${pid}`) : 'TBD';
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.6rem 0.8rem',
            borderBottom: borderBottom ? '1px solid #2a2a4a' : 'none',
            background: highlighted ? '#14203E' : 'transparent',
            opacity: faded ? 0.5 : 1,
            minHeight: '40px'
        }}>
            {pid && (image ? (
                <img src={`http://localhost:3001${image}`} alt={label}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
                <div style={{
                    width: '24px', height: '24px', borderRadius: '50%', background: '#2a2a4a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', flexShrink: 0
                }}>{label[0]?.toUpperCase()}</div>
            ))}
            <span style={{
                flex: 1,
                color: highlighted ? '#FCA616' : '#EAEAEA',
                fontWeight: highlighted ? 'bold' : 'normal',
                fontSize: '0.9rem'
            }}>
                {label}
            </span>
            {score != null && (
                <span style={{
                    color: highlighted ? '#FCA616' : '#EAEAEA',
                    fontWeight: 'bold', fontSize: '1.1rem',
                    minWidth: '24px', textAlign: 'right'
                }}>
                    {score}
                </span>
            )}
        </div>
    );
}

const th = { padding: '0.5rem', textAlign: 'center', color: '#a1a1a1', fontSize: '0.8rem', fontWeight: 'normal' };
const td = { padding: '0.5rem', textAlign: 'center', fontSize: '0.9rem' };
const tableWrap = { background: '#1a1a2e', borderRadius: '12px', padding: '1rem', marginBottom: '2rem', overflowX: 'auto' };
const errorBox = { color: '#e74c3c', background: '#1a1a2e', padding: '0.7rem 1rem', borderRadius: '8px', marginBottom: '1rem' };