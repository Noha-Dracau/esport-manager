// client/src/components/ScoreModal.jsx
import { useState, useEffect } from 'react';

export default function ScoreModal({ match, names, onClose, onSubmit }) {
    const [scoreA, setScoreA] = useState(match.score_a ?? '');
    const [scoreB, setScoreB] = useState(match.score_b ?? '');
    const [error, setError] = useState('');
    const [busy, setBusy]   = useState(false);

    const nameA = names[match.participant_a] || `#${match.participant_a}`;
    const nameB = names[match.participant_b] || `#${match.participant_b}`;
    const isEditing = match.status === 'finished';

    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter') handleSubmit();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    async function handleSubmit() {
        setError('');
        const a = parseInt(scoreA, 10);
        const b = parseInt(scoreB, 10);
        if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
            setError('Les scores doivent être des entiers positifs.');
            return;
        }
        if (a === b) {
            setError('Un match ne peut pas se terminer sur une égalité.');
            return;
        }
        setBusy(true);
        try {
            await onSubmit(a, b);
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Erreur lors de la sauvegarde');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#1a1a2e', borderRadius: '12px', padding: '2rem',
                    minWidth: '380px', maxWidth: '90vw',
                    border: '1px solid #2a2a4a'
                }}
            >
                <h3 style={{ color: '#FCA616', margin: '0 0 1.5rem', textAlign: 'center' }}>
                    {isEditing ? 'Modifier le score' : 'Saisir le score'}
                </h3>

                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                    gap: '1rem', alignItems: 'center', marginBottom: '1rem'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: '#EAEAEA', margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
                            {nameA}
                        </p>
                        <input
                            type="number"
                            min="0"
                            value={scoreA}
                            onChange={e => setScoreA(e.target.value)}
                            autoFocus
                            style={scoreInputStyle}
                        />
                    </div>
                    <span style={{ color: '#a1a1a1', fontSize: '1.2rem' }}>:</span>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: '#EAEAEA', margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
                            {nameB}
                        </p>
                        <input
                            type="number"
                            min="0"
                            value={scoreB}
                            onChange={e => setScoreB(e.target.value)}
                            style={scoreInputStyle}
                        />
                    </div>
                </div>

                {error && (
                    <p style={{ color: '#e74c3c', textAlign: 'center', margin: '0.5rem 0' }}>
                        {error}
                    </p>
                )}

                <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button
                        onClick={onClose}
                        disabled={busy}
                        style={{
                            padding: '0.6rem 1.2rem', borderRadius: '8px',
                            border: '1px solid #555', background: 'transparent',
                            color: '#EAEAEA', cursor: 'pointer'
                        }}
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={busy}
                        style={{
                            padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none',
                            background: '#FCA616', color: '#14203E',
                            cursor: busy ? 'wait' : 'pointer', fontWeight: 'bold'
                        }}
                    >
                        {busy ? 'Enregistrement…' : 'Valider'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const scoreInputStyle = {
    width: '80px', padding: '0.8rem', textAlign: 'center', fontSize: '1.5rem',
    borderRadius: '8px', border: '1px solid #333',
    background: '#0f0f23', color: '#FCA616', fontWeight: 'bold'
};