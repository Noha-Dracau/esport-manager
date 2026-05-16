import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function Podium({ tournament }) {
    const [places, setPlaces] = useState(null);
    const [names, setNames]   = useState({});
    const [images, setImages] = useState({});

    useEffect(() => { loadPodium(); }, [tournament.id]);

    async function loadPodium() {
        let first = [], second = [], third = [];

        try {
            if (tournament.format === 'round_robin') {
                const res = await api.get(`/tournaments/${tournament.id}/standings`);
                const standings = res.data;
                first  = standings.filter(s => s.rank === 1).map(s => s.participant_id);
                second = standings.filter(s => s.rank === 2).map(s => s.participant_id);
                third  = standings.filter(s => s.rank === 3).map(s => s.participant_id);

            } else {
                const res = await api.get(`/tournaments/${tournament.id}/bracket`);
                const matches = res.data.matches;

                if (tournament.format === 'single_elimination') {
                    const main = matches.filter(m => m.bracket !== 'losers' && m.bracket !== 'grand_final');
                    const maxRound = Math.max(...main.map(m => m.round));
                    const final = main.find(m => m.round === maxRound);
                    if (final?.winner) first  = [final.winner];
                    if (final?.loser)  second = [final.loser];
                    if (maxRound > 1) {
                        const semis = main.filter(m => m.round === maxRound - 1);
                        third = semis.map(m => m.loser).filter(Boolean);
                    }

                } else if (tournament.format === 'double_elimination') {
                    const gf = matches.find(m => m.bracket === 'grand_final');
                    if (gf?.winner) first  = [gf.winner];
                    if (gf?.loser)  second = [gf.loser];
                    const lbMatches = matches.filter(m => m.bracket === 'losers');
                    if (lbMatches.length > 0) {
                        const maxLbRound = Math.max(...lbMatches.map(m => m.round));
                        const lbFinal = lbMatches.find(m => m.round === maxLbRound);
                        if (lbFinal?.loser) third = [lbFinal.loser];
                    }
                }
            }

            const allIds = [...new Set([...first, ...second, ...third])];
            await fetchNames(allIds);
            setPlaces({ first, second, third });
        } catch {
            setPlaces({ first: [], second: [], third: [] });
        }
    }

    async function fetchNames(ids) {
        const nameMap  = {};
        const imageMap = {};
        await Promise.all(ids.map(async id => {
            try {
                if (tournament.mode === 'players') {
                    const res = await api.get(`/users/${id}`);
                    nameMap[id]  = res.data.username;
                    imageMap[id] = res.data.avatar_url || null;
                } else {
                    const res = await api.get(`/teams/${id}`);
                    nameMap[id]  = res.data.name;
                    imageMap[id] = res.data.logo_url || null;
                }
            } catch { nameMap[id] = `#${id}`; }
        }));
        setNames(nameMap);
        setImages(imageMap);
    }

    if (!places) return null;
    if (!places.first.length && !places.second.length && !places.third.length) return null;

    return (
        <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.2rem' }}>Results</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
                <PodiumSlot medal="🥇" color="#FFD700" ids={places.first}  names={names} images={images} />
                <PodiumSlot medal="🥈" color="#C0C0C0" ids={places.second} names={names} images={images} />
                <PodiumSlot medal="🥉" color="#CD7F32" ids={places.third}  names={names} images={images} />
            </div>
        </div>
    );
}

function PodiumSlot({ medal, color, ids, names, images }) {
    return (
        <div style={{
            flex: 1, background: '#0f0f23', borderRadius: '8px',
            padding: '1rem', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem'
        }}>
            <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{medal}</span>
            {ids.length === 0 ? (
                <span style={{ color: '#a1a1a1', fontSize: '0.8rem', fontStyle: 'italic' }}>—</span>
            ) : (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                    {ids.map(id => (
                        <Participant key={id} id={id} name={names[id]} image={images[id]} color={color} />
                    ))}
                </div>
            )}
        </div>
    );
}

function Participant({ id, name, image, color }) {
    const label = name || `#${id}`;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
            {image ? (
                <img
                    src={`http://localhost:3001${image}`}
                    alt={label}
                    style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${color}` }}
                />
            ) : (
                <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: '#2a2a4a', border: `2px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem', fontWeight: 'bold', color
                }}>{label[0]?.toUpperCase()}</div>
            )}
            <span style={{
                color, fontWeight: 'bold', fontSize: '0.85rem',
                maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>{label}</span>
        </div>
    );
}
