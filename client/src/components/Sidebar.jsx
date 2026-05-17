import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import logo from '../assets/logo.svg'; // Assure-toi que ce chemin est correct

export default function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    return (
        <nav style={{
            width: '220px', height: '100vh', position: 'sticky', top: 0,
            background: '#ffe39a', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem', gap: '0.5rem'
        }}>
            {/* clickable logo */}
            <NavLink to="/presentation" style={{ marginBottom: '1.5rem' }}>
                <img
                    src={logo}
                    alt="LOCK IN! Tournament Manager"
                    style={{
                        width: '150px',
                        height: 'auto',
                        cursor: 'pointer'
                    }}
                />
            </NavLink>

            <NavLink to="/"      style={navStyle}>Tournaments</NavLink>
            <NavLink to="/teams" style={navStyle}>Teams</NavLink>

            {/* Profile */}
            <div style={{ marginTop: 'auto' }}>
                {user ? (
                    <>
                        <NavLink to="/profile" style={navStyle}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                {user.avatarUrl ? (
                                    <img
                                        src={`http://localhost:3001${user.avatarUrl}`}
                                        alt={user.username}
                                        style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                    />
                                ) : (
                                    <span style={{
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        background: '#14203E', color: '#FCA616',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0
                                    }}>
                                        {user.username?.[0]?.toUpperCase()}
                                    </span>
                                )}
                                {user.username}
                            </span>
                        </NavLink>
                        <button onClick={() => { logout(); navigate('/'); }} style={btnStyle}>
                            Disconnect
                        </button>
                    </>
                ) : (
                    <NavLink to="/login" style={navStyle}>Connection</NavLink>
                )}
            </div>
        </nav>
    );
}

const navStyle = ({ isActive }) => ({
    display: 'block',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    color: isActive ? '#FFFFFF' : '#000000',
    textDecoration: 'none',
    backgroundColor: isActive ? '#FCA616' : 'transparent',
    border: '3px solid #FCA616',
    boxShadow: isActive ? '0 0 8px rgba(252, 166, 22, 0.3)' : 'none',
    transition: 'all 0.2s ease',
    fontWeight: '500',
    marginBottom: '0.5rem',
    '&:hover': {
        backgroundColor: isActive ? '#FCA616' : '#F5F5F5',
        border: '1px solid #FCA616',
        boxShadow: '0 0 8px rgba(252, 166, 22, 0.3)',
    },
});

const btnStyle = {
    marginTop: '0.5rem', width: '100%', padding: '0.5rem',
    background: 'transparent', border: '2px solid #e74c3c',
    color: '#e74c3c', borderRadius: '8px', cursor: 'pointer'
};