import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import TeamLoginPage from './pages/TeamLoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import TeamsPage from './pages/admin/TeamsPage';
import MissionsPage from './pages/admin/MissionsPage';
import LeaderboardPage from './pages/admin/LeaderboardPage';
import LogsPage from './pages/admin/LogsPage';
import SecurityPage from './pages/admin/SecurityPage';
import AuditPage from './pages/admin/AuditPage';
import ConsolePage from './pages/team/ConsolePage';
import TimerPage from './pages/admin/TimerPage';

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="d-flex align-items-center justify-content-center vh-100"><div className="spinner-border text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) return <Navigate to="/team/console" replace />;
  return <>{children}</>;
}

function TeamGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="d-flex align-items-center justify-content-center vh-100"><div className="spinner-border text-success" /></div>;
  if (!user) return <Navigate to="/team-login" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="d-flex align-items-center justify-content-center vh-100"><div className="spinner-border text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.isAdmin) return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/team/console" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/team-login" element={<TeamLoginPage />} />
          <Route path="/admin/dashboard" element={<AdminGuard><DashboardPage /></AdminGuard>} />
          <Route path="/admin/teams" element={<AdminGuard><TeamsPage /></AdminGuard>} />
          <Route path="/admin/missions" element={<AdminGuard><MissionsPage /></AdminGuard>} />
          <Route path="/admin/leaderboard" element={<AdminGuard><LeaderboardPage /></AdminGuard>} />
          <Route path="/admin/logs" element={<AdminGuard><LogsPage /></AdminGuard>} />
          <Route path="/admin/security" element={<AdminGuard><SecurityPage /></AdminGuard>} />
          <Route path="/admin/audit" element={<AdminGuard><AuditPage /></AdminGuard>} />
          <Route path="/admin/timer" element={<AdminGuard><TimerPage /></AdminGuard>} />
          <Route path="/team/console" element={<TeamGuard><ConsolePage /></TeamGuard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
