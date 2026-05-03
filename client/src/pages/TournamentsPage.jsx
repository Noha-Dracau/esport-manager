import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function TournamentsPage() {
    const [tournaments, setTournaments] = useState([]);
    const [search, setSearch]           = useState('');
    const [game, setGame]               = useState('');
    const navigate = useNavigate();
    const [mode, setMode] = useState('');

    useEffect(() => {
        api.get('/tournaments', { params: { search, game, mode } })
            .then(r => setTournaments(r.data));
    }, [search, game, mode]);

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
                    <option value="League of Legends">League of Legends</option>
                    <option value="Valorant">Valorant</option>
                    <option value="CS2">CS2</option>
                    <option value="Fortnite">Fortnite</option>
                    <option value="Rocket League">Rocket League</option>
                    <option value="Overwatch 2">Overwatch 2</option>
                    <option value="FIFA">FIFA</option>
                    <option value="Street Fighter 6">Street Fighter 6</option>
                </select>
                <select value={mode} onChange={e => setMode(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '150px' }}>
                    <option value="">Any</option>
                    <option value="players">Players VS Players</option>
                    <option value="teams">Teams VS Teams</option>
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
                        style={cardStyle}
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
                                background: t.status === 'open' ? '#22c55e22' : '#f59e0b22',
                                color: t.status === 'open' ? '#22c55e' : '#f59e0b',
                                padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem'
                            }}>
        {t.status === 'open' ? 'Open' : 'Ongoing'}
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

const cardStyle = {
    background: '#1a1a2e', borderRadius: '12px', padding: '1rem',
    cursor: 'pointer', transition: 'transform 0.2s',
    border: '1px solid #2a2a4a'
};