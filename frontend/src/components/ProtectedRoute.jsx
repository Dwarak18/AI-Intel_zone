import React, { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { getStoredUser } from '../api/client.js';
import { verifyToken } from '../api/auth.js';

export default function ProtectedRoute({ role }) {
  const [status, setStatus] = useState('checking'); // checking | ok | fail
  const user = getStoredUser();

  useEffect(() => {
    if (!user) { setStatus('fail'); return; }
    verifyToken()
      .then(() => setStatus('ok'))
      .catch(() => { setStatus('fail'); });
  }, []);

  if (status === 'checking') {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (status === 'fail') {
    return <Navigate to={role === 'admin' ? '/login' : '/team-login'} replace />;
  }

  // Role check
  if (role === 'admin' && !user?.isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
