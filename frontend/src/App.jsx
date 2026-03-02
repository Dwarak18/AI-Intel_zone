import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import TeamLogin from './pages/TeamLogin.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminTeams from './pages/admin/Teams.jsx';
import AdminMissions from './pages/admin/Missions.jsx';
import AdminLeaderboard from './pages/admin/Leaderboard.jsx';
import AdminLiveScores from './pages/admin/LiveScores.jsx';
import AdminActivity from './pages/admin/Activity.jsx';
import AdminLogs from './pages/admin/Logs.jsx';
import AdminSecurity from './pages/admin/Security.jsx';
import AdminAudit from './pages/admin/Audit.jsx';
import MissionConsole from './pages/team/MissionConsole.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/team-login" element={<TeamLogin />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Admin routes */}
        <Route path="/admin" element={<ProtectedRoute role="admin" />}>
          <Route index element={<AdminDashboard />} />
          <Route path="teams" element={<AdminTeams />} />
          <Route path="missions" element={<AdminMissions />} />
          <Route path="leaderboard" element={<AdminLeaderboard />} />
          <Route path="live-scores" element={<AdminLiveScores />} />
          <Route path="activity" element={<AdminActivity />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="security" element={<AdminSecurity />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>

        {/* Team routes */}
        <Route path="/team" element={<ProtectedRoute role="team" />}>
          <Route path="console" element={<MissionConsole />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
