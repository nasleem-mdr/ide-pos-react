import React, { useState } from 'react';
import '../css/Login.css';

function Login({ onLoginSuccess }) {
  const [formData, setFormData] = useState({
    user: '',
    pass: '',
    client: '1000000',
    role: '1000000'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: formData.user,
          password: formData.pass,
          parameters: {
            clientId: 1000000,
            roleId: 1000000,
            organizationId: 0,
            language: "en_US"
          }
        }),
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();

        if (response.ok && data.token) {
          localStorage.setItem('token', data.token);
          const userId = data.userId || (data.userContext && data.userContext.userId);
          if (userId) {
            localStorage.setItem('AD_User_ID', userId);
          } else {
            console.warn("AD_User_ID tidak ditemukan di respon API.");
          }
          onLoginSuccess();
        } else {
          setError(data.message || "Kredensial tidak valid. Silakan coba lagi.");
        }
      } else {
        const textError = await response.text();
        setError("Server error: " + textError.slice(0, 100));
      }
    } catch (err) {
      setError("Koneksi gagal. Periksa jaringan Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <div className="grid-overlay" />
      <div className="login-card">
        <div className="accent-bar" />

        <div className="login-logo">
          <div className="logo-mark">iD</div>
          <span className="logo-text">iDempiere</span>
        </div>

        <div className="login-headline">Sign In</div>
        <div className="login-sub">// Enterprise Resource Platform</div>

        {error && <div className="error-banner">⚠ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label">Username</label>
            <div className="field-wrap">
              
              <input
                className="field-input"
                type="text"
                placeholder="enter username"
                autoComplete="username"
                onChange={e => setFormData({ ...formData, user: e.target.value })}
              />
              <div className="field-focus-line" />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Password</label>
            <div className="field-wrap">
              
              <input
                className="field-input"
                type="password"
                placeholder="enter password"
                autoComplete="current-password"
                onChange={e => setFormData({ ...formData, pass: e.target.value })}
              />
              <div className="field-focus-line" />
            </div>
          </div>

          <button className="btn-login" type="submit" disabled={loading}>
            {loading && <span className="btn-loader" />}
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        <div className="divider">
          <div className="divider-line" />
          <span className="divider-text">secure</span>
          <div className="divider-line" />
        </div>

        <div className="login-footer">
          NSoft ID · @nasleemmad
        </div>
      </div>
    </div>
  );
}

export default Login;