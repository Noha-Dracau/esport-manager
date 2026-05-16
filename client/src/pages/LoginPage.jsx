import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function LoginPage() {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail]           = useState('');
    const [password, setPassword]     = useState('');
    const [username, setUsername]     = useState('');
    const [error, setError]           = useState('');
    const { login } = useAuth();
    const navigate  = useNavigate();

    async function handleSubmit() {
        setError('');
        try {
            const endpoint = isRegister ? '/auth/register' : '/auth/login';
            const payload  = isRegister
                ? { email, password, username }
                : { email, password };

            const res = await api.post(endpoint, payload);
            login(res.data);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'An error occurred');
        }
    }

    return (
        <div style={{
            maxWidth: '400px', margin: '4rem auto',
            background: '#1a1a2e', padding: '2rem',
            borderRadius: '12px', border: '1px solid #2a2a4a'
        }}>
            <h2 style={{ marginBottom: '1.5rem' }}>
                {isRegister ? 'Create new account' : 'Connection'}
            </h2>

            {error && (
                <p style={{ color: '#e74c3c', marginBottom: '1rem' }}>{error}</p>
            )}

            {isRegister && (
                <input
                    placeholder="Username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    maxLength={30}
                    style={inputStyle}
                />
            )}

            <input
                placeholder="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                maxLength={100}
                style={inputStyle}
            />

            <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
            />

            <button onClick={handleSubmit} style={btnStyle}>
                {isRegister ? 'Create account' : 'Connect'}
            </button>

            <p
                onClick={() => { setIsRegister(!isRegister); setError(''); }}
                style={{ marginTop: '1rem', color: '#FCA616', cursor: 'pointer', textAlign: 'center' }}
            >
                {isRegister ? 'Already have an account? Connect' : 'No account? Create one'}
            </p>
        </div>
    );
}

const inputStyle = {
    display: 'block', width: '100%', marginBottom: '1rem',
    padding: '0.7rem 1rem', borderRadius: '8px',
    border: '1px solid #333', background: '#0f0f23',
    color: '#fff', fontSize: '1rem', boxSizing: 'border-box'
};

const btnStyle = {
    width: '100%', padding: '0.8rem',
    background: '#FCA616', color: '#14203E',
    border: 'none', borderRadius: '8px',
    fontSize: '1rem', cursor: 'pointer'
};