import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import TournamentBracket from '../components/TournamentBracket';
import RoundRobinView from '../components/RoundRobinView';

export default function ManageTournamentPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [tournament, setTournament] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const isManager = tournament && user && Number(user.userId) === tournament.manager_id;

    async function loadTournament() {
        try {
            setLoading(true);
            const res = await api.get(`/tournaments/${id}`);
            setTournament(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadTournament(); }, [id]);

    async function handleStart() {
        const today = new Date().toISOString().split('T')[0];
        const tournamentDate = tournament.date?.split('T')[0] ?? tournament.date;
        const earlyWarning = tournamentDate > today
            ? `\n⚠️ Tournament date is ${new Date(tournamentDate).toLocaleDateString('en-GB')}. Start anyway?`
            : '';
        if (!confirm(`Start tournament? Registration will be closed.${earlyWarning}`)) return;
        setBusy(true);
        setError('');
        try {
            await api.post(`/tournaments/${id}/start`);
            await loadTournament();
        } catch (err) {
            setError(err.response?.data?.error || 'Error starting tournament');
        } finally {
            setBusy(false);
        }
    }

    async function handleFinish() {
        // check for unfinished matches to tailor the confirmation message
        let unfinishedCount = 0;
        try {
            const res = await api.get(`/tournaments/${id}/bracket`);
            unfinishedCount = res.data.matches.filter(m => m.status !== 'finished').length;
        } catch { /* on continue même si la check échoue */ }

        const msg = unfinishedCount > 0
            ? `${unfinishedCount} unfinished match(es) remaining. Finish tournament anyway?`
            : 'Finish tournament? This action is irreversible.';
        if (!confirm(msg)) return;

        setBusy(true);
        setError('');
        try {
            await api.post(`/tournaments/${id}/finish`);
            await loadTournament();
        } catch (err) {
            setError(err.response?.data?.error || 'Error finishing tournament');
        } finally {
            setBusy(false);
        }
    }

    if (loading) return <p style={{ color: '#EAEAEA' }}>Loading…</p>;
    if (!tournament) return <p style={{ color: '#EAEAEA' }}>Tournament not found</p>;

    if (!isManager) {
        return (
            <div>
                <h2 style={{ color: '#EAEAEA' }}>Access denied</h2>
                <p style={{ color: '#a1a1a1' }}>Only the tournament manager can access this page.</p>
                <Link to={`/tournaments/${id}`} style={{ color: '#FCA616' }}>← Back to tournament</Link>
            </div>
        );
    }

    const statusLabel = {
        open: 'Open', ongoing: 'Ongoing', finished: 'Finished'
    }[tournament.status];

    const statusColor = {
        open: '#FCA616', ongoing: '#3498db', finished: '#2ecc71'
    }[tournament.status];

    return (
        <div>
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem'
            }}>
                <div>
                    <button
                        onClick={() => navigate(`/tournaments/${id}`)}
                        style={{
                            padding: '0.4rem 0.8rem', borderRadius: '6px', border: 'none',
                            background: '#14203E', color: '#FCA616', cursor: 'pointer',
                            marginBottom: '0.5rem', fontSize: '0.85rem'
                        }}
                    >
                        ← Public page
                    </button>
                    <h1 style={{ color: '#EAEAEA', margin: '0.3rem 0' }}>
                        Managing {tournament.name}
                    </h1>
                    <p style={{ color: '#a1a1a1', margin: 0 }}>
                        {tournament.game} · {formatLabel(tournament.format)} · {tournament.mode === 'teams' ? 'Teams' : 'Players'}
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
    <span style={{
        padding: '0.4rem 0.8rem', borderRadius: '999px',
        background: '#1a1a2e', color: statusColor,
        fontWeight: 'bold', fontSize: '0.85rem'
    }}>
        {statusLabel}
    </span>
                    {tournament.status === 'open' && (
                        <button
                            onClick={handleStart}
                            disabled={busy}
                            style={{
                                padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none',
                                background: '#FCA616', color: '#14203E', cursor: busy ? 'wait' : 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            {busy ? 'Starting…' : 'Start tournament'}
                        </button>
                    )}
                    {tournament.status === 'ongoing' && (
                        <button
                            onClick={handleFinish}
                            disabled={busy}
                            style={{
                                padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none',
                                background: '#e74c3c', color: '#fff', cursor: busy ? 'wait' : 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            {busy ? 'Finishing…' : 'Finish tournament'}
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <p style={{
                    color: '#e74c3c', background: '#1a1a2e', padding: '0.7rem 1rem',
                    borderRadius: '8px', marginBottom: '1rem'
                }}>{error}</p>
            )}

            {tournament.status === 'open' && (
                <div style={{
                    background: '#1a1a2e', borderRadius: '12px', padding: '1.5rem',
                    color: '#a1a1a1', marginBottom: '1rem'
                }}>
                    {tournament.format === 'round_robin'
                        ? 'The schedule will be generated automatically on start. All participants will meet once.'
                        : 'Generate the bracket on the public page first, then check the seeding (drag & drop) before clicking "Start". Any registration or unregistration after generation will reset the bracket.'}
                </div>
            )}

            {tournament.status !== 'open' && tournament.format === 'round_robin' && (
                <RoundRobinView
                    tournamentId={tournament.id}
                    mode={tournament.mode}
                    isManager={true}
                    tournamentStatus={tournament.status}
                    onUpdate={loadTournament}
                />
            )}

            {tournament.status !== 'open' && tournament.format !== 'round_robin' && (
                <TournamentBracket
                    tournament={tournament}
                    isManager={true}
                    canScore={true}
                    onRefresh={loadTournament}
                />
            )}
        </div>
    );
}

function formatLabel(f) {
    return {
        single_elimination: 'Single elimination',
        double_elimination: 'Double elimination',
        round_robin: 'Round Robin'
    }[f] || f;
}