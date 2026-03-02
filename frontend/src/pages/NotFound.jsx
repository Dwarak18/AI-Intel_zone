import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 text-center">
      <i className="bi bi-exclamation-triangle text-warning" style={{ fontSize: 64 }} />
      <h1 className="display-4 fw-bold mt-3">404</h1>
      <p className="text-muted">Page not found</p>
      <Link to="/" className="btn btn-primary mt-2">Go Home</Link>
    </div>
  );
}
