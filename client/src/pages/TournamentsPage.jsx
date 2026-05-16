import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function TournamentsPage() {
    const [tournaments, setTournaments] = useState([]);
    const [search, setSearch]           = useState('');
    const [game, setGame]               = useState('');
    const [mode, setMode]               = useState('');
    const [status, setStatus]           = useState('');
    const [games, setGames]             = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/tournaments/games').then(r => setGames(r.data));
    }, []);

    useEffect(() => {
        api.get('/tournaments', { params: { search, game, mode, status } })
            .then(r => setTournaments(r.data));
    }, [search, game, mode, status]);

    return (
        <div>
            <h1>Tournaments</h1>

            {/* Searchbar + filters */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <input
                    placeholder="Search for a tournament..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ ...inputStyle, flex: 2, minWidth: '200px' }}
                />
                <select value={game} onChange={e => setGame(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '150px' }}>
                    <option value="">All games</option>
                    {games.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select value={mode} onChange={e => setMode(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '150px' }}>
                    <option value="">Any</option>
                    <option value="players">Players VS Players</option>
                    <option value="teams">Teams VS Teams</option>
                </select>
                <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '150px' }}>
                    <option value="">All statuses</option>
                    <option value="open">Open</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="finished">Finished</option>
                </select>
            </div>

            {/* Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1.5rem'
            }}>
                {tournaments.map(t => (
                    <div
                        key={t.id}
                        onClick={() => navigate(`/tournaments/${t.id}`)}
                        style={cardStyle(t.status)}
                    >
                        <img
                            src={t.logo_url ? `http://localhost:3001${t.logo_url}` : '/default-tournament.png'}
                            alt={t.name}
                            style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px' }}
                        />
                        <h3 style={{ margin: '0.5rem 0 0.2rem' }}>{t.name}</h3>
                        <p style={{ color: '#FCA616', fontSize: '0.85rem', margin: '0.2rem 0' }}>{t.game}</p>
                        <p style={{ color: '#EAEAEA', fontSize: '0.85rem', margin: '0.2rem 0' }}>
                            {t.mode === 'players' ? 'Players VS Players' : 'Teams VS Teams'}
                        </p>
                        <p style={{ color: '#EAEAEA', fontSize: '0.85rem', margin: '0.2rem 0' }}>
                            {new Date(t.date).toLocaleDateString('fr-FR')}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                            <span style={{ color: '#EAEAEA', fontSize: '0.8rem' }}>{t.format.replace(/_/g, ' ')}</span>
                            <span style={{
                                background: t.status === 'open' ? '#22c55e22' : t.status === 'ongoing' ? '#f59e0b22' : '#a1a1a122',
                                color: t.status === 'open' ? '#22c55e' : t.status === 'ongoing' ? '#f59e0b' : '#a1a1a1',
                                padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem'
                            }}>
                                {t.status === 'open' ? 'Open' : t.status === 'ongoing' ? 'Ongoing' : 'Finished'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const inputStyle = {
    padding: '0.6rem 1rem', borderRadius: '8px',
    border: '1px solid #333', background: '#1a1a2e', color: '#fff', flex: 1
};

const cardStyle = (status) => ({
    background: '#1a1a2e', borderRadius: '12px', padding: '1rem',
    cursor: 'pointer', transition: 'transform 0.2s',
    border: '1px solid #2a2a4a',
    opacity: status === 'finished' ? 0.6 : 1,
});