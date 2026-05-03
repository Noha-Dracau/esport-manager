import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function ProfilePage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile]   = useState(null);
    const [username, setUsername] = useState('');
    const [avatar, setAvatar]     = useState(null);
    const [error, setError]       = useState('');
    const [success, setSuccess]   = useState('');
    const [team, setTeam] = useState(null);
    const [myTournaments, setMyTournaments] = useState(null);

    async function fetchProfile() {
        const res = await api.get('/users/me');
        setProfile(res.data);
        setUsername(res.data.username);

        // Gets the data from user's team (if they have one)
        if (res.data.team_id) {
            const teamRes = await api.get(`/teams/${res.data.team_id}`);
            setTeam(teamRes.data);
        }

        const tourRes = await api.get('/users/me/tournaments');
        setMyTournaments(tourRes.data);
    }

    useEffect(() => { fetchProfile(); }, []);

    async function handleSave() {
        setError(''); setSuccess('');
        try {
            const formData = new FormData();
            if (username !== profile.username) formData.append('username', username);
            if (avatar) formData.append('avatar', avatar);

            if ([...formData.entries()].length === 0)
                return setError('No change to update');

            await api.patch('/users/me', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSuccess('Profile updated!');
            fetchProfile();
        } catch (err) {
            setError(err.response?.data?.error || 'Error');
        }
    }

    if (!profile) return <p>Loading...</p>;

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1>My profile</h1>

            {/* Profile Picture */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{
                    width: '80px', height: '80px', borderRadius: '50%',
                    background: '#fca616', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold',
                    overflow: 'hidden', flexShrink: 0
                }}>
                    {profile.avatar_url
                        ? <img src={`http://localhost:3001${profile.avatar_url}`} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : profile.username[0].toUpperCase()
                    }
                </div>
                <div>
                    <p style={{ color: '#EAEAEA', margin: '0 0 0.4rem' }}>Change picture:</p>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={e => setAvatar(e.target.files[0])}
                        style={{ color: '#fff' }}
                    />
                </div>
            </div>

            {/* Form */}
            <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>Information</h3>

                {error   && <p style={{ color: '#e74c3c' }}>{error}</p>}
                {success && <p style={{ color: '#22c55e' }}>{success}</p>}

                <label style={{ color: '#888', display: 'block', marginBottom: '0.3rem' }}>Username</label>
                <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    style={inputStyle}
                />

                <label style={{ color: '#888', display: 'block', marginBottom: '0.3rem' }}>Email</label>
                <input
                    value={profile.email}
                    disabled
                    style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }}
                />

                <button onClick={handleSave} style={btnStyle}>
                    Save
                </button>
            </div>

            {/* Team */}
            <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>My team</h3>
                {profile.team_id && team ? (
                    <div
                        onClick={() => navigate(`/teams/${profile.team_id}`)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '1rem',
                            padding: '0.8rem', background: '#0f0f23', borderRadius: '8px',
                            cursor: 'pointer', border: '1px solid #2a2a4a'
                        }}
                    >
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '8px',
                            background: 'transparent', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold',
                            overflow: 'hidden', flexShrink: 0
                        }}>
                            {team.logo_url
                                ? <img src={`http://localhost:3001${team.logo_url}`} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : team.name[0].toUpperCase()
                            }
                        </div>
                        <div>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>{team.name}</p>
                            <p style={{ margin: 0, color: '#888', fontSize: '0.85rem' }}>
                                {team.manager_id === Number(user.userId) ? 'Manager' : 'Member'} · {team.members?.length} member{team.members?.length > 1 ? 's' : ''}
                            </p>
                        </div>
                        <span style={{ marginLeft: 'auto', color: '#888' }}>→</span>
                    </div>
                ) : (
                    <p style={{ color: '#888', margin: 0 }}>
                        You do not have any team:{' '}
                        <span
                            onClick={() => navigate('/teams')}
                            style={{ color: '#FCA616', cursor: 'pointer' }}
                        >
                            Join or create a team.
                        </span>
                    </p>
                )}
            </div>

            {/* Tournaments */}
            <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>My tournaments</h3>

                {/* As a manager */}
                {myTournaments?.asManager?.length > 0 && (
                    <>
                        <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Tournaments you manage</p>
                        {myTournaments.asManager.map(t => (
                            <TournamentRow key={t.id} tournament={t} navigate={navigate} />
                        ))}
                    </>
                )}

                {/* As a player*/}
                {myTournaments?.asPlayer?.length > 0 && (
                    <>
                        <p style={{ color: '#888', fontSize: '0.85rem', margin: '1rem 0 0.5rem' }}>Registered as a player</p>
                        {myTournaments.asPlayer.map(t => (
                            <TournamentRow key={t.id} tournament={t} navigate={navigate} />
                        ))}
                    </>
                )}

                {/* As a team */}
                {myTournaments?.asTeam?.length > 0 && (
                    <>
                        <p style={{ color: '#888', fontSize: '0.85rem', margin: '1rem 0 0.5rem' }}>Registered via your team</p>
                        {myTournaments.asTeam.map(t => (
                            <TournamentRow key={t.id} tournament={t} navigate={navigate} />
                        ))}
                    </>
                )}

                {myTournaments?.asManager?.length === 0 &&
                    myTournaments?.asPlayer?.length === 0 &&
                    myTournaments?.asTeam?.length === 0 && (
                        <p style={{ color: '#888', margin: 0 }}>You do not participate in any tournament</p>
                    )}
            </div>
        </div>
    );
}

function TournamentRow({ tournament, navigate }) {
    return (
        <div
            onClick={() => navigate(`/tournaments/${tournament.id}`)}
            style={{
                display: 'flex', alignItems: 'center', gap: '0.8rem',
                padding: '0.6rem', background: '#0f0f23', borderRadius: '8px',
                cursor: 'pointer', marginBottom: '0.4rem',
                border: '1px solid #2a2a4a'
            }}
        >
            <div style={{
                width: '36px', height: '36px', borderRadius: '6px',
                background: '#7c3aed22', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0
            }}>
                🏆
            </div>
            <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{tournament.name}</p>
                <p style={{ margin: 0, color: '#888', fontSize: '0.8rem' }}>{tournament.game} · {tournament.format.replace(/_/g, ' ')}</p>
            </div>
            <span style={{
                fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px',
                background: tournament.status === 'open' ? '#22c55e22' : '#f59e0b22',
                color: tournament.status === 'open' ? '#22c55e' : '#f59e0b'
            }}>
        {tournament.status === 'open' ? 'Open' : 'Ongoing'}
      </span>
        </div>
    );
}

const inputStyle = {
    display: 'block', width: '100%', padding: '0.7rem 1rem',
    borderRadius: '8px', border: '1px solid #333',
    background: '#0f0f23', color: '#fff',
    fontSize: '1rem', boxSizing: 'border-box', marginBottom: '1rem'
};

const btnStyle = {
    padding: '0.7rem 1.5rem', background: '#fca616',
    color: '#14203E', border: 'none', borderRadius: '8px',
    fontSize: '1rem', cursor: 'pointer'
};