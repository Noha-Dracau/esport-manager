import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import TournamentBracket from '../components/TournamentBracket';
import { Link } from 'react-router-dom';

export default function TournamentDetailPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tournament, setTournament] = useState(null);
    const [error, setError]           = useState('');
    const [success, setSuccess]       = useState('');
    const [editing, setEditing]       = useState(false);
    const [form, setForm]             = useState({});
    const [logo, setLogo]             = useState(null);

    async function fetchTournament() {
        const res = await api.get(`/tournaments/${id}`);
        setTournament(res.data);
        setForm({
            name:             res.data.name,
            game:             res.data.game,
            description:      res.data.description || '',
            date:             res.data.date?.split('T')[0] || res.data.date,
            format:           res.data.format,
            max_participants: res.data.max_participants,
            mode:             res.data.mode,
        });
    }

    useEffect(() => { fetchTournament(); }, [id]);

    async function handleRegister() {
        if (!user) return navigate('/login');
        setError(''); setSuccess('');
        try {
            await api.post(`/tournaments/${id}/register`);
            setSuccess('Registered successfully!');
            fetchTournament();
        } catch (err) {
            setError(err.response?.data?.error || 'Error during registration');
        }
    }

    async function handleUnregister() {
        setError(''); setSuccess('');
        try {
            await api.delete(`/tournaments/${id}/unregister`);
            setSuccess('Unregistered successfully');
            fetchTournament();
        } catch (err) {
            setError(err.response?.data?.error || 'Error');
        }
    }

    async function handleSave() {
        setError('');
        try {
            const formData = new FormData();
            Object.entries(form).forEach(([k, v]) => formData.append(k, v));
            if (logo) formData.append('logo', logo);
            await api.patch(`/tournaments/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setEditing(false);
            setSuccess('Tournament updated!');
            fetchTournament();
        } catch (err) {
            setError(err.response?.data?.error || 'Error');
        }
    }

    async function handleDelete() {
        if (!confirm('Definitively delete this tournament?')) return;
        try {
            await api.delete(`/tournaments/${id}`);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Error');
        }
    }

    if (!tournament) return <p>Loading...</p>;

    const isManager = Number(user?.userId) === tournament.manager_id;
    const isAlreadyRegistered = tournament.registrations?.some(r =>
        tournament.mode === 'players'
            ? r.user_id === Number(user?.userId)
            : r.team_id === user?.teamId
    );
    const isFull = tournament.registrations?.length >= tournament.max_participants;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', marginBottom: '2rem' }}>
                {tournament.logo_url && !editing && (
                    <img
                        src={`http://localhost:3001${tournament.logo_url}`}
                        alt="logo"
                        style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '12px' }}
                    />
                )}
                <div style={{ flex: 1 }}>
                    {editing ? (
                        <input
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            maxLength={100}
                            style={inputStyle}
                        />
                    ) : (
                        <h1 style={{ margin: '0 0 0.5rem' }}>{tournament.name}</h1>
                    )}
                    <p style={{ color: '#FCA616', margin: '0.2rem 0' }}>{tournament.game}</p>
                    <p style={{ color: '#EAEAEA', margin: '0.2rem 0' }}>{new Date(tournament.date).toLocaleDateString('fr-FR')}</p>
                    <p style={{ color: '#EAEAEA', margin: '0.2rem 0' }}>{tournament.format.replace(/_/g, ' ')}</p>
                    <p style={{ color: '#EAEAEA', margin: '0.2rem 0' }}>
                        {tournament.mode === 'players' ? 'Players VS Players' : 'Teams VS Teams'}
                    </p>
                    <span style={{
                        background: tournament.status === 'open' ? '#22c55e22' : '#f59e0b22',
                        color: tournament.status === 'open' ? '#22c55e' : '#f59e0b',
                        padding: '2px 10px', borderRadius: '4px', fontSize: '0.8rem'
                    }}>
            {tournament.status === 'open' ? 'Open' :
                tournament.status === 'ongoing' ? 'Ongoing' :
                    'Finished'}
          </span>
                </div>

                {/* Buttons manager only */}
                {isManager && tournament.status === 'open' && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        {editing ? (
                            <>
                                <button onClick={handleSave} style={btnGreen}>Save</button>
                                <button onClick={() => setEditing(false)} style={btnGray}>Cancel</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setEditing(true)} style={btnPurple}>Modify</button>
                                <button onClick={handleDelete} style={btnRed}>Delete</button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Manage button — visible to manager in all states */}
            {isManager && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <Link
                        to={`/tournaments/${tournament.id}/manage`}
                        style={{
                            display: 'inline-block', padding: '0.7rem 1.4rem', borderRadius: '8px',
                            background: '#FCA616', color: '#14203E', fontWeight: 'bold',
                            textDecoration: 'none'
                        }}
                    >
                        {tournament.status === 'open' ? '⚙ Manage tournament' :
                            tournament.status === 'ongoing' ? '⚙ Manage matches' :
                                '⚙ View results'}
                    </Link>
                </div>
            )}

            {/* Edit form */}
            {editing && (
                <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div>
                        <label style={labelStyle}>Game</label>
                        <select value={form.game} onChange={e => setForm({ ...form, game: e.target.value })} style={inputStyle}>
                            {['League of Legends','Valorant','CS2','Fortnite','Rocket League','Overwatch 2','FIFA','Street Fighter 6'].map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Description</label>
                        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} maxLength={500} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    <div>
                        <label style={labelStyle}>Date</label>
                        <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} min={new Date().toISOString().split('T')[0]} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Format</label>
                        <select value={form.format} onChange={e => {
                            const newFormat = e.target.value;
                            const clampedMax = newFormat === 'round_robin' && Number(form.max_participants) > 8 ? 8 : form.max_participants;
                            setForm({ ...form, format: newFormat, max_participants: clampedMax });
                        }} style={inputStyle}>
                            <option value="single_elimination">Single elimination</option>
                            <option value="double_elimination">Double elimination</option>
                            <option value="round_robin">Round Robin</option>
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Max participants: {form.max_participants}</label>
                        <input type="range" min="4" max={form.format === 'round_robin' ? 8 : 64} step="4" value={form.max_participants}
                               onChange={e => setForm({ ...form, max_participants: e.target.value })}
                               style={{ width: '100%', accentColor: '#FCA616' }} />
                    </div>
                    <div>
                        <label style={labelStyle}>New logo</label>
                        <input type="file" accept="image/*" onChange={e => setLogo(e.target.files[0])} style={{ color: '#fff' }} />
                    </div>
                </div>
            )}

            {/* Description */}
            {tournament.description && !editing && (
                <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    <p style={{ margin: 0 }}>{tournament.description}</p>
                </div>
            )}

            {error   && <p style={{ color: '#e74c3c', marginBottom: '1rem' }}>{error}</p>}
            {success && <p style={{ color: '#22c55e', marginBottom: '1rem' }}>{success}</p>}

            {/* Registration / Unregistration buttons */}
            {tournament.status === 'open' && user && (
                <div style={{ marginBottom: '1.5rem' }}>
                    {isAlreadyRegistered ? (
                        <button onClick={handleUnregister} style={{ ...btnRed, padding: '0.8rem 2rem' }}>
                            Unregister
                        </button>
                    ) : (
                        <button onClick={handleRegister} disabled={isFull} style={{
                            padding: '0.8rem 2rem', borderRadius: '8px', border: 'none',
                            background: isFull ? '#333' : '#FCA616',
                            color: '#fff', fontSize: '1rem', cursor: isFull ? 'default' : 'pointer'
                        }}>
                            {isFull ? 'Full' : 'Register'}
                        </button>
                    )}
                </div>
            )}

            {/* List of participants */}
            <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>
                    Participants ({tournament.registrations?.length} / {tournament.max_participants})
                </h3>
                {tournament.registrations?.length === 0 && (
                    <p style={{ color: '#EAEAEA' }}>No participant for now.</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {tournament.registrations?.map((r, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: '0.8rem',
                            padding: '0.6rem', background: '#0f0f23', borderRadius: '8px'
                        }}>
                            {tournament.mode === 'players' ? (
                                <>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {r.username?.[0]?.toUpperCase()}
                                    </div>
                                    <span>{r.username}</span>
                                </>
                            ) : (
                                <>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '8px',
                                        background: '#1d9e75', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {r.team_name?.[0]?.toUpperCase()}
                                    </div>
                                    <span>{r.team_name}</span>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Bracket */}
            <TournamentBracket
                tournament={tournament}
                isManager={isManager}
                canScore={false}
                onRefresh={fetchTournament}
            />

        </div>
    );
}

const inputStyle = {
    width: '100%', padding: '0.7rem 1rem', borderRadius: '8px',
    border: '1px solid #333', background: '#0f0f23',
    color: '#fff', fontSize: '1rem', boxSizing: 'border-box'
};
const labelStyle = { display: 'block', marginBottom: '0.3rem', color: '#EAEAEA', fontSize: '0.9rem' };
const btnPurple = { padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#FCA616', color: '#14203E', cursor: 'pointer' };
const btnRed    = { padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e74c3c', background: 'transparent', color: '#e74c3c', cursor: 'pointer' };
const btnGreen  = { padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer' };
const btnGray   = { padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #555', background: 'transparent', color: '#e74c3c', cursor: 'pointer' };