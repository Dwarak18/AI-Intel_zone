import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api/client';

interface Stats {
  totalTeams: number; activeTeams: number; totalSubmissions: number; totalSuccessful: number;
  validationRate: number; openSecurityEvents: number; flaggedLogs: number; hallucinationRate: number;
}
interface ActivityEntry { teamCode: string; missionCode: string; status: string; score: number; createdAt: string; }
interface AnalyticsData { hourlyData: any[]; activeTeamsList: any[]; }

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, ac, an] = await Promise.all([
          adminApi.stats(),
          adminApi.activityFeed(10),
          adminApi.analytics(),
        ]);
        setStats(s.data);
        setActivity(ac.data.activity || []);
        setAnalytics(an.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <AdminLayout><div className="arena-loader">Loading…</div></AdminLayout>;

  const s = stats!;
  const cards = [
    { label: 'Total Teams', value: s.totalTeams, sub: `${s.activeTeams} active`, icon: 'bi-people-fill', color: '#6366f1' },
    { label: 'Submissions', value: s.totalSubmissions, sub: `${s.totalSuccessful} successful`, icon: 'bi-send-fill', color: '#3b82f6' },
    { label: 'Validation Rate', value: `${s.validationRate}%`, sub: 'of all submissions', icon: 'bi-patch-check-fill', color: '#10b981' },
    { label: 'Security Events', value: s.openSecurityEvents, sub: 'open events', icon: 'bi-shield-exclamation', color: '#f59e0b' },
    { label: 'Flagged Logs', value: s.flaggedLogs, sub: 'require review', icon: 'bi-flag-fill', color: '#ef4444' },
    { label: 'Hallucination Rate', value: `${s.hallucinationRate}%`, sub: 'avg across all logs', icon: 'bi-cpu-fill', color: '#8b5cf6' },
  ];

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title"><i className="bi bi-speedometer2 me-2 text-accent" />Control Dashboard</h1>
        <span className="page-badge">LIVE</span>
      </div>

      <div className="stat-grid">
        {cards.map(c => (
          <div className="stat-card" key={c.label}>
            <div className="stat-icon" style={{ background: c.color + '22' }}>
              <i className={`bi ${c.icon}`} style={{ color: c.color }} />
            </div>
            <div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
              <div className="stat-sub">{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="arena-panel mt-4">
        <div className="arena-panel-header">
          <span><i className="bi bi-activity me-2" />Recent Activity</span>
        </div>
        <div className="table-responsive">
          <table className="arena-table">
            <thead><tr><th>Team</th><th>Mission</th><th>Status</th><th>Score</th><th>Time</th></tr></thead>
            <tbody>
              {activity.length === 0 && <tr><td colSpan={5} className="text-center py-4">No submissions yet</td></tr>}
              {activity.map((a, i) => (
                <tr key={i}>
                  <td className="mono">{a.teamCode}</td>
                  <td className="mono">{a.missionCode}</td>
                  <td><span className={`badge-status ${a.status}`}>{a.status}</span></td>
                  <td className="text-accent mono">{a.score}</td>
                  <td className="text-muted">{new Date(a.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {analytics?.activeTeamsList && analytics.activeTeamsList.length > 0 && (
        <div className="arena-panel mt-4">
          <div className="arena-panel-header"><span><i className="bi bi-people me-2" />Active Teams</span></div>
          <div className="table-responsive">
            <table className="arena-table">
              <thead><tr><th>Team</th><th>Score</th><th>Submissions</th></tr></thead>
              <tbody>
                {analytics!.activeTeamsList.map((t: any, i: number) => (
                  <tr key={i}>
                    <td className="mono">{t.teamCode}</td>
                    <td className="text-accent mono">{t.totalScore ?? 0}</td>
                    <td>{t.submissionCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
