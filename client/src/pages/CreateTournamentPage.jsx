import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function CreateTournamentPage() {
    const navigate = useNavigate();
    const [error, setError]   = useState('');
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        name:             '',
        game:             '',
        description:      '',
        date:             '',
        format:           'single_elimination',
        max_participants: 8,
        mode:             'players',
    });
    const [logo, setLogo] = useState(null);

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value });
    }

    async function handleSubmit() {
        setError('');
        if (!form.name || !form.game || !form.date)
            return setError('Missing mandatory fields.');

        setLoading(true);
        try {
            const formData = new FormData();
            Object.entries(form).forEach(([k, v]) => formData.append(k, v));
            if (logo) formData.append('logo', logo);

            const res = await api.post('/tournaments', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            navigate(`/tournaments/${res.data.id}`);
        } catch (err) {
            setError(err.response?.data?.error || 'Error during the creation');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '1.5rem' }}>Create a tournament</h1>

            {error && <p style={{ color: '#e74c3c', marginBottom: '1rem' }}>{error}</p>}

            <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Title */}
                <div>
                    <label style={labelStyle}>Title *</label>
                    <input name="name" value={form.name} onChange={handleChange} placeholder="Name of the tournament..." maxLength={100} style={inputStyle} />
                </div>

                {/* Game */}
                <div>
                    <label style={labelStyle}>Game *</label>
                    <select name="game" value={form.game} onChange={handleChange} style={inputStyle}>
                        <option value="">Select a game</option>
                        <option value="League of Legends">League of Legends</option>
                        <option value="Valorant">Valorant</option>
                        <option value="CS2">CS2</option>
                        <option value="Fortnite">Fortnite</option>
                        <option value="Rocket League">Rocket League</option>
                        <option value="Overwatch 2">Overwatch 2</option>
                        <option value="FIFA">FIFA</option>
                        <option value="Street Fighter 6">Street Fighter 6</option>
                    </select>
                </div>

                {/* Description */}
                <div>
                    <label style={labelStyle}>Description</label>
                    <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        placeholder="Describe your tournament..."
                        rows={3}
                        maxLength={500}
                        style={{ ...inputStyle, resize: 'vertical' }}
                    />
                </div>

                {/* Date */}
                <div>
                    <label style={labelStyle}>Date *</label>
                    <input name="date" type="date" value={form.date} onChange={handleChange} min={new Date().toISOString().split('T')[0]} style={inputStyle} />
                </div>

                {/* Format */}
                <div>
                    <label style={labelStyle}>Format</label>
                    <select name="format" value={form.format} onChange={handleChange} style={inputStyle}>
                        <option value="single_elimination">Single elimination</option>
                        <option value="double_elimination">Double elimination</option>
                        <option value="round_robin">Round Robin</option>
                    </select>
                </div>

                {/* Number of participants */}
                <div>
                    <label style={labelStyle}>Maximum number of participants: {form.max_participants}</label>
                    <input
                        name="max_participants"
                        type="range"
                        min="4" max="64" step="4"
                        value={form.max_participants}
                        onChange={handleChange}
                        style={{ width: '100%', accentColor: '#FCA616' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.8rem' }}>
                        <span>4</span><span>16</span><span>32</span><span>64</span>
                    </div>
                </div>

                {/* Mode */}
                <div>
                    <label style={labelStyle}>Mode</label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {['players', 'teams'].map(m => (
                            <button
                                key={m}
                                onClick={() => setForm({ ...form, mode: m })}
                                style={{
                                    flex: 1, padding: '0.7rem', borderRadius: '8px', cursor: 'pointer',
                                    border: `3px solid ${form.mode === m ? '#FCA616' : 'transparent'}`,
                                    background: form.mode === m ? '#FCA616' : 'transparent',
                                    color: form.mode === m ? '#14203E' : '#FCA616',
                                    fontSize: '1rem'
                                }}
                            >
                                {m === 'players' ? 'Players VS Players' : 'Teams VS Teams'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Logo */}
                <div>
                    <label style={labelStyle}>Picture (optionnal)</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={e => setLogo(e.target.files[0])}
                        style={{ color: '#fff' }}
                    />
                    {logo && (
                        <img
                            src={URL.createObjectURL(logo)}
                            alt="preview"
                            style={{ marginTop: '0.8rem', width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
                        />
                    )}
                </div>

                {/* Button */}
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                        padding: '0.9rem', background: loading ? '#14203E' : '#FCA616',
                        color: '#14203E', border: 'none', borderRadius: '8px',
                        fontSize: '1rem', cursor: loading ? 'default' : 'pointer',
                        marginTop: '0.5rem'
                    }}
                >
                    {loading ? 'Creation...' : 'Create tournament'}
                </button>
            </div>
        </div>
    );
}

const labelStyle = {
    display: 'block', marginBottom: '0.4rem',
    color: '#FFFFFF', fontSize: '0.9rem'
};

const inputStyle = {
    width: '100%', padding: '0.7rem 1rem',
    borderRadius: '8px', border: '1px solid #333',
    background: '#14203E', color: '#EAEAEA',
    fontSize: '1rem', boxSizing: 'border-box'
};