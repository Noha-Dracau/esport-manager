// client/src/pages/ManageTournamentPage.jsx
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
            setError(err.response?.data?.error || 'Erreur de chargement');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadTournament(); }, [id]);

    async function handleStart() {
        const today = new Date().toISOString().split('T')[0];
        const tournamentDate = tournament.date?.split('T')[0] ?? tournament.date;
        const earlyWarning = tournamentDate > today
            ? `\n⚠️ La date prévue du tournoi est le ${new Date(tournamentDate).toLocaleDateString('fr-FR')}. Démarrer quand même ?`
            : '';
        if (!confirm(`Démarrer le tournoi ? Les inscriptions seront fermées.${earlyWarning}`)) return;
        setBusy(true);
        setError('');
        try {
            await api.post(`/tournaments/${id}/start`);
            await loadTournament();
        } catch (err) {
            setError(err.response?.data?.error || 'Erreur au démarrage');
        } finally {
            setBusy(false);
        }
    }

    async function handleFinish() {
        // Vérifie s'il reste des matchs non joués pour adapter la confirmation
        let unfinishedCount = 0;
        try {
            const res = await api.get(`/tournaments/${id}/bracket`);
            unfinishedCount = res.data.matches.filter(m => m.status !== 'finished').length;
        } catch { /* on continue même si la check échoue */ }

        const msg = unfinishedCount > 0
            ? `Il reste ${unfinishedCount} match(s) non joué(s). Terminer le tournoi quand même ?`
            : 'Terminer le tournoi ? Cette action est définitive.';
        if (!confirm(msg)) return;

        setBusy(true);
        setError('');
        try {
            await api.post(`/tournaments/${id}/finish`);
            await loadTournament();
        } catch (err) {
            setError(err.response?.data?.error || 'Erreur à la clôture');
        } finally {
            setBusy(false);
        }
    }

    if (loading) return <p style={{ color: '#EAEAEA' }}>Chargement…</p>;
    if (!tournament) return <p style={{ color: '#EAEAEA' }}>Tournoi introuvable</p>;

    if (!isManager) {
        return (
            <div>
                <h2 style={{ color: '#EAEAEA' }}>Accès refusé</h2>
                <p style={{ color: '#a1a1a1' }}>Seul le manager du tournoi peut accéder à cette page.</p>
                <Link to={`/tournaments/${id}`} style={{ color: '#FCA616' }}>← Retour au tournoi</Link>
            </div>
        );
    }

    const statusLabel = {
        open: 'Ouvert', ongoing: 'En cours', finished: 'Terminé'
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
                        ← Page publique
                    </button>
                    <h1 style={{ color: '#EAEAEA', margin: '0.3rem 0' }}>
                        Gestion : {tournament.name}
                    </h1>
                    <p style={{ color: '#a1a1a1', margin: 0 }}>
                        {tournament.game} · {formatLabel(tournament.format)} · {tournament.mode === 'teams' ? 'Équipes' : 'Joueurs'}
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
                            {busy ? 'Démarrage…' : 'Démarrer le tournoi'}
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
                            {busy ? 'Clôture…' : 'Terminer le tournoi'}
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
                        ? 'Le calendrier sera généré automatiquement au démarrage. Tous les participants se rencontreront une fois.'
                        : 'Le bracket sera figé au démarrage. Vérifie le seeding (drag & drop sur la page publique) avant de cliquer "Démarrer".'}
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
        single_elimination: 'Élimination simple',
        double_elimination: 'Double élimination',
        round_robin: 'Round Robin'
    }[f] || f;
}