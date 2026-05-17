import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import DiscordBadge from '../components/DiscordBadge';

export default function TeamDetailPage() {
    const { id } = useParams();
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [team, setTeam]       = useState(null);
    const [error, setError]     = useState('');
    const [success, setSuccess] = useState('');
    const [editing, setEditing] = useState(false);
    const [form, setForm]       = useState({ name: '', bio: '' });
    const [logo, setLogo]       = useState(null);

    async function fetchTeam() {
        const res = await api.get(`/teams/${id}`);
        setTeam(res.data);
    }

    useEffect(() => { fetchTeam(); }, [id]);

    async function handleJoinRequest() {
        if (!user) return navigate('/login');
        setError(''); setSuccess('');
        try {
            await api.post('/invitations', { team_id: Number(id) });
            setSuccess('Request sent!');
            fetchTeam();
        } catch (err) {
            setError(err.response?.data?.error || 'Error');
        }
    }

    async function handleInvitation(invitationId, status) {
        try {
            await api.patch(`/invitations/${invitationId}`, { status });
            fetchTeam();
        } catch (err) { setError(err.response?.data?.error || 'Error'); }
    }

    async function handleCancelRequest() {
        const myInvitation = team.pendingInvitations?.find(
            i => i.user_id === Number(user?.userId)
        );
        if (!myInvitation) return;
        try {
            await api.delete(`/invitations/${myInvitation.id}`);
            setSuccess('Request successfully canceled.');
            fetchTeam();
        } catch (err) {
            setError(err.response?.data?.error || 'Error');
        }
    }

    async function handleLeave() {
        if (!confirm('Leave this team?')) return;
        try {
            await api.post(`/teams/${id}/leave`);
            await refreshUser();
            navigate('/teams');
        } catch (err) { setError(err.response?.data?.error || 'Error'); }
    }

    async function handleKick(userId, username) {
        if (!confirm(`Kick ${username} from the team?`)) return;
        try {
            await api.post(`/teams/${id}/kick/${userId}`);
            fetchTeam();
        } catch (err) { setError(err.response?.data?.error || 'Error'); }
    }

    async function handleSave() {
        setError('');
        try {
            const formData = new FormData();
            formData.append('name', form.name);
            formData.append('bio', form.bio);
            if (logo) formData.append('logo', logo);
            await api.patch(`/teams/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setEditing(false);
            setSuccess('Team updated!');
            fetchTeam();
        } catch (err) {
            setError(err.response?.data?.error || 'Error');
        }
    }

    async function handleDelete() {
        if (!confirm('Delete the team (no going back)?')) return;
        try {
            await api.delete(`/teams/${id}`);
            await refreshUser();
            navigate('/teams');
        } catch (err) { setError(err.response?.data?.error || 'Error'); }
    }

    if (!team) return <p>Loading...</p>;

    const isManager  = Number(user?.userId) === team.manager_id;
    const isMember   = team.members?.some(m => m.id === Number(user?.userId));
    const hasPending = team.pendingInvitations?.some(i => i.user_id === Number(user?.userId));

    return (
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                {!editing && (
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '12px',
                        background: 'transparent', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold',
                        overflow: 'hidden', flexShrink: 0
                    }}>
                        {team.logo_url
                            ? <img src={`http://localhost:3001${team.logo_url}`} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : team.name[0].toUpperCase()
                        }
                    </div>
                )}
                <div style={{ flex: 1 }}>
                    {editing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            <input
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                maxLength={50}
                                style={inputStyle}
                            />
                            <div>
                                <label style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>Bio</label>
                                <textarea
                                    value={form.bio}
                                    onChange={e => setForm({ ...form, bio: e.target.value })}
                                    maxLength={220}
                                    placeholder="Tell others about your team. You can include a link."
                                    rows={3}
                                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                                />
                                <p style={{ color: '#555', fontSize: '0.75rem', textAlign: 'right', margin: '-0.3rem 0 0.3rem' }}>
                                    {form.bio.trim().length}/200
                                </p>
                            </div>
                            <div>
                                <label style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>New logo</label>
                                <input type="file" accept="image/*" onChange={e => setLogo(e.target.files[0])} style={{ color: '#EAEAEA' }} />
                            </div>
                        </div>
                    ) : (
                        <>
                            <h1 style={{ margin: '0 0 0.3rem' }}>{team.name}</h1>
                            <BioText bio={team.bio} />
                            <p style={{ color: '#EAEAEA', margin: '0.3rem 0 0' }}>
                                {isManager ? 'You are the manager' : isMember ? 'You are a member' : ''}
                            </p>
                        </>
                    )}
                </div>

                {/* Manager buttons */}
                {isManager && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        {editing ? (
                            <>
                                <button onClick={handleSave} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setEditing(false)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #555', background: 'transparent', color: '#EAEAEA', cursor: 'pointer' }}>Cancel</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => { setForm({ name: team.name, bio: team.bio ?? '' }); setLogo(null); setEditing(true); }} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#FCA616', color: '#14203E', cursor: 'pointer' }}>Modify</button>
                                <button onClick={handleDelete} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e74c3c', background: 'transparent', color: '#e74c3c', cursor: 'pointer' }}>Delete the team</button>
                            </>
                        )}
                    </div>
                )}

                {/* Leave button */}
                {isMember && !isManager && (
                    <button onClick={handleLeave} style={{
                        padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #f59e0b',
                        background: 'transparent', color: '#f59e0b', cursor: 'pointer'
                    }}>
                        Leave the team
                    </button>
                )}
            </div>

            {error   && <p style={{ color: '#e74c3c' }}>{error}</p>}
            {success && <p style={{ color: '#22c55e' }}>{success}</p>}

            {/* Join button */}
            {!isManager && !isMember && user && (
                <div style={{ marginBottom: '1.5rem' }}>
                    {hasPending ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ color: '#f59e0b' }}>Pending request</span>
                            <button
                                onClick={handleCancelRequest}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: '8px',
                                    border: '1px solid #e74c3c', background: 'transparent',
                                    color: '#e74c3c', cursor: 'pointer'
                                }}
                            >
                                Cancel the request
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleJoinRequest}
                            style={{
                                padding: '0.8rem 2rem', borderRadius: '8px', border: 'none',
                                background: '#FCA616', color: '#14203E',
                                fontSize: '1rem', cursor: 'pointer'
                            }}
                        >
                            Request to join
                        </button>
                    )}
                </div>
            )}

            {/* Members */}
            <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>Members ({team.members?.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {team.members?.map(member => (
                        <div key={member.id} style={{
                            display: 'flex', alignItems: 'center', gap: '0.8rem',
                            padding: '0.6rem', background: '#0f0f23', borderRadius: '8px'
                        }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '50%',
                                background: 'transparent', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontWeight: 'bold', overflow: 'hidden'
                            }}>
                                {member.avatar_url
                                    ? <img src={`http://localhost:3001${member.avatar_url}`} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : member.username[0].toUpperCase()
                                }
                            </div>
                            <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {member.username}
                                <DiscordBadge username={member.discord_username} />
                            </span>
                            {member.id === team.manager_id && (
                                <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>👑 Manager</span>
                            )}
                            {/* Kick button (manager only) */}
                            {isManager && member.id !== team.manager_id && (
                                <button
                                    onClick={() => handleKick(member.id, member.username)}
                                    style={{
                                        padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem',
                                        border: '1px solid #e74c3c', background: 'transparent',
                                        color: '#e74c3c', cursor: 'pointer'
                                    }}
                                >
                                    Kick
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Tournaments of the team */}
            {team.tournaments?.length > 0 && (() => {
                const active = team.tournaments.filter(t => t.status !== 'finished');
                const past   = team.tournaments.filter(t => t.status === 'finished');
                return (
                    <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                        <h3 style={{ marginTop: 0 }}>Tournaments</h3>

                        {active.length > 0 && (
                            <>
                                <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Active tournaments</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: past.length > 0 ? '1rem' : 0 }}>
                                    {active.map(t => <TournamentRow key={t.id} t={t} navigate={navigate} />)}
                                </div>
                            </>
                        )}

                        {past.length > 0 && (
                            <>
                                <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Past tournaments</p>
                                <div style={{ opacity: 0.6, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {past.map(t => <TournamentRow key={t.id} t={t} navigate={navigate} />)}
                                </div>
                            </>
                        )}
                    </div>
                );
            })()}

            {/* Pending requests (manager only) */}
            {isManager && (
                <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '1.5rem' }}>
                    <h3 style={{ marginTop: 0 }}>
                        Pending requests ({team.pendingInvitations?.length || 0})
                    </h3>
                    {team.pendingInvitations?.length === 0 && (
                        <p style={{ color: '#EAEAEA', margin: 0 }}>Currently no pending request.</p>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {team.pendingInvitations?.map(inv => (
                            <div key={inv.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '0.8rem', background: '#0f0f23', borderRadius: '8px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '50%',
                                        background: '#FCA616', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', fontWeight: 'bold'
                                    }}>
                                        {inv.username[0].toUpperCase()}
                                    </div>
                                    <span>{inv.username}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleInvitation(inv.id, 'accepted')}
                                        style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e' }}
                                    >
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => handleInvitation(inv.id, 'declined')}
                                        style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', background: '#e74c3c22', color: '#e74c3c', border: '1px solid #e74c3c' }}
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const URL_SPLIT = /(\b(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?)/gi;
const URL_TEST  = /^(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?$/i;

function BioText({ bio }) {
    if (!bio) return null;
    const parts = bio.split(URL_SPLIT);
    return (
        <p style={{ color: '#a1a1a1', margin: '0.3rem 0 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
            {parts.map((part, i) =>
                URL_TEST.test(part)
                    ? <a key={i} href={/^https?:\/\//i.test(part) ? part : `https://${part}`}
                         target="_blank" rel="noopener noreferrer"
                         style={{ color: '#FCA616', textDecoration: 'underline' }}>{part}</a>
                    : part
            )}
        </p>
    );
}

function TournamentRow({ t, navigate }) {
    return (
        <div
            onClick={() => navigate(`/tournaments/${t.id}`)}
            style={{
                display: 'flex', alignItems: 'center', gap: '0.8rem',
                padding: '0.6rem', background: '#0f0f23', borderRadius: '8px',
                cursor: 'pointer', border: '1px solid #2a2a4a'
            }}
        >
            <span style={{ flex: 1 }}>{t.name}</span>
            <span style={{ color: '#EAEAEA', fontSize: '0.8rem' }}>{t.game}</span>
            <span style={{
                fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px',
                background: t.status === 'open' ? '#22c55e22' : t.status === 'ongoing' ? '#f59e0b22' : '#a1a1a122',
                color: t.status === 'open' ? '#22c55e' : t.status === 'ongoing' ? '#f59e0b' : '#a1a1a1'
            }}>
                {t.status === 'open' ? 'Open' : t.status === 'ongoing' ? 'Ongoing' : 'Finished'}
            </span>
        </div>
    );
}

const inputStyle = {
    width: '100%', padding: '0.6rem 1rem', borderRadius: '8px',
    border: '1px solid #333', background: '#0f0f23',
    color: '#fff', fontSize: '1rem', boxSizing: 'border-box'
};