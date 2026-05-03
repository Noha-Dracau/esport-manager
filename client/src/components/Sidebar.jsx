import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import logo from '../assets/logo.svg'; // Assure-toi que ce chemin est correct

export default function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    return (
        <nav style={{
            width: '220px', minHeight: '100vh', background: '#ffeac8',
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

            {user && (
                <NavLink to="/create-tournament" style={navStyle}>Create a tournament</NavLink>
            )}

            {/* Profile */}
            <div style={{ marginTop: 'auto' }}>
                {user ? (
                    <>
                        <NavLink to="/profile" style={navStyle}>{user.username}</NavLink>
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
    marginTop: '0.5rem', width: '100%', padding: '0.6rem',
    background: 'transparent', border: '1px solid #e74c3c',
    color: '#e74c3c', borderRadius: '8px', cursor: 'pointer'
};