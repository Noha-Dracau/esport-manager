import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Sidebar from './components/Sidebar';
import TournamentsPage from './pages/TournamentsPage';
import TournamentDetailPage from './pages/TournamentDetailPage';
import TeamsPage from './pages/TeamsPage';
import TeamDetailPage from './pages/TeamDetailPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import CreateTournamentPage from './pages/CreateTournamentPage';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import PresentationPage from './pages/PresentationPage.jsx';

export default function App() {
  return (
      <AuthProvider>
        <BrowserRouter>
          <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <main style={{ flex: 1, padding: '2rem' }}>
              <Routes>
                {/* Page principale : Tournaments */}
                <Route path="/" element={<TournamentsPage />} />

                {/* Page de présentation */}
                <Route path="/presentation" element={<PresentationPage />} />

                {/* Autres routes */}
                <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
                <Route path="/teams" element={<TeamsPage />} />
                <Route path="/teams/:id" element={<TeamDetailPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/profile" element={
                  <ProtectedRoute><ProfilePage /></ProtectedRoute>
                } />
                <Route path="/create-tournament" element={
                  <ProtectedRoute><CreateTournamentPage /></ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
  );
}