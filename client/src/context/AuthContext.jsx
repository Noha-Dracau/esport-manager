import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const token     = localStorage.getItem('token');
        const userId    = localStorage.getItem('userId');
        const username  = localStorage.getItem('username');
        const teamId    = localStorage.getItem('teamId');
        const avatarUrl = localStorage.getItem('avatarUrl');
        return token ? {
            token, userId, username,
            teamId:    teamId    ? Number(teamId) : null,
            avatarUrl: avatarUrl || null,
        } : null;
    });

    useEffect(() => {
        if (localStorage.getItem('token')) refreshUser();
    }, []);

    async function refreshUser() {
        try {
            const res       = await api.get('/users/me');
            const username  = res.data.username;
            const teamId    = res.data.team_id   ?? null;
            const avatarUrl = res.data.avatar_url ?? null;

            localStorage.setItem('username', username);
            if (teamId != null) localStorage.setItem('teamId', String(teamId));
            else                localStorage.removeItem('teamId');
            if (avatarUrl)      localStorage.setItem('avatarUrl', avatarUrl);
            else                localStorage.removeItem('avatarUrl');

            setUser(prev => prev ? { ...prev, username, teamId, avatarUrl } : prev);
        } catch {
            logout();
        }
    }

    function login(data) {
        localStorage.setItem('token',    data.token);
        localStorage.setItem('userId',   String(data.userId));
        localStorage.setItem('username', data.username);
        if (data.teamId != null) localStorage.setItem('teamId', String(data.teamId));
        else                     localStorage.removeItem('teamId');
        if (data.avatarUrl)      localStorage.setItem('avatarUrl', data.avatarUrl);
        else                     localStorage.removeItem('avatarUrl');
        setUser(data);
    }

    function logout() {
        localStorage.clear();
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
