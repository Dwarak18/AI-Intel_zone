import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, setToken, clearToken } from '../api/client';

interface UserDict {
  id: number;
  username: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isActive: boolean;
}

interface TeamInfo {
  id: number;
  teamCode: string;
  name: string;
  status: string;
}

interface AuthState {
  user: UserDict | null;
  team: TeamInfo | null;
  loading: boolean;
  loginAdmin: (username: string, password: string) => Promise<void>;
  loginTeam: (team_code: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDict | null>(null);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me()
      .then(r => {
        const u = r.data.user;
        // Ensure isAdmin is always a real boolean (backend role-based fallback)
        if (u && u.isAdmin === undefined) {
          u.isAdmin = ['super_admin', 'admin', 'moderator'].includes(u.role);
        }
        setUser(u);
        setTeam(r.data.team ?? null);
      })
      .catch(() => { setUser(null); setTeam(null); })
      .finally(() => setLoading(false));
  }, []);

  const loginAdmin = async (username: string, password: string) => {
    const { data } = await authApi.loginAdmin(username, password);
    setToken(data.token);
    const u = data.user;
    if (u && u.isAdmin === undefined) u.isAdmin = ['super_admin', 'admin', 'moderator'].includes(u.role);
    setUser(u);
    setTeam(null);
  };

  const loginTeam = async (team_code: string, password: string) => {
    const { data } = await authApi.loginTeam(team_code, password);
    setToken(data.token);
    const u = data.user;
    if (u && u.isAdmin === undefined) u.isAdmin = ['super_admin', 'admin', 'moderator'].includes(u.role);
    setUser(u);
    setTeam(data.team ?? null);
  };

  const logout = async () => {
    await authApi.logout();
    clearToken();
    setUser(null);
    setTeam(null);
  };

  return (
    <AuthContext.Provider value={{ user, team, loading, loginAdmin, loginTeam, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
