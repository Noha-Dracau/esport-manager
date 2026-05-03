import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function TeamsPage() {
    const [teams, setTeams]         = useState([]);
    const [search, setSearch]       = useState('');
    const [showForm, setShowForm]   = useState(false);
    const [teamName, setTeamName]   = useState('');
    const [logo, setLogo]           = useState(null);
    const [error, setError]         = useState('');
    const [success, setSuccess]     = useState('');
    const { user } = useAuth();
    const navigate = useNavigate();

    async function fetchTeams() {
        const res = await api.get('/teams', { params: { search } });
        setTeams(res.data);
    }

    useEffect(() => { fetchTeams(); }, [search]);

    async function handleCreateTeam() {
        if (!user) return navigate('/login');
        setError('');
        setSuccess('');
        try {
            const formData = new FormData();
            formData.append('name', teamName);
            if (logo) formData.append('logo', logo);

            await api.post('/teams', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSuccess('Team created successfully!');
            setShowForm(false);
            setTeamName('');
            fetchTeams();
        } catch (err) {
            setError(err.response?.data?.error || 'Error during the creation');
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ margin: 0 }}>Teams</h1>
                {user && (
                    <button onClick={() => setShowForm(!showForm)} style={btnStyle}>
                        {showForm ? 'Cancel' : '➕ Create a team'}
                    </button>
                )}
            </div>

            {/* Form */}
            {showForm && (
                <div style={{ background: '#1a1a2e', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                    <h3 style={{ marginTop: 0 }}>New team</h3>
                    {error   && <p style={{ color: '#e74c3c' }}>{error}</p>}
                    {success && <p style={{ color: '#22c55e' }}>{success}</p>}
                    <input
                        placeholder="Team name"
                        value={teamName}
                        onChange={e => setTeamName(e.target.value)}
                        style={inputStyle}
                    />
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ color: '#EAEAEA', display: 'block', marginBottom: '0.4rem' }}>
                            Logo (optionnal)
                        </label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={e => setLogo(e.target.files[0])}
                            style={{ color: '#fff' }}
                        />
                    </div>
                    <button onClick={handleCreateTeam} style={btnStyle}>
                        Create team
                    </button>
                </div>
            )}

            {/* Search bar */}
            <input
                placeholder="Search for a team..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...inputStyle, marginBottom: '1.5rem' }}
            />

            {/* List of teams */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '1rem'
            }}>
                {teams.map(team => (
                    <div
                        key={team.id}
                        onClick={() => navigate(`/teams/${team.id}`)}
                        style={cardStyle}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '8px',
                                background: 'transparent', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold',
                                overflow: 'hidden', flexShrink: 0
                            }}>
                                {team.logo_url
                                    ? <img src={`http://localhost:3001${team.logo_url}`} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : team.name[0].toUpperCase()
                                }
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 0.2rem' }}>{team.name}</h3>
                                <p style={{ color: '#EAEAEA', margin: 0, fontSize: '0.85rem' }}>See team</p>
                            </div>
                        </div>
                    </div>
                ))}

                {teams.length === 0 && (
                    <p style={{ color: '#EAEAEA' }}>No team found</p>
                )}
            </div>
        </div>
    );
}

const inputStyle = {
    display: 'block', width: '100%', padding: '0.7rem 1rem',
    borderRadius: '8px', border: '1px solid #333',
    background: '#1a1a2e', color: '#fff',
    fontSize: '1rem', boxSizing: 'border-box', marginBottom: '0.8rem'
};

const btnStyle = {
    padding: '0.7rem 1.5rem', background: '#FCA616',
    color: '#14203E', border: 'none', borderRadius: '8px',
    fontSize: '1rem', cursor: 'pointer'
};

const cardStyle = {
    background: '#1a1a2e', borderRadius: '12px', padding: '1rem',
    cursor: 'pointer', border: '1px solid #2a2a4a',
    transition: 'border-color 0.2s'
};