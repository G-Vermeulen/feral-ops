import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import wolfMark from '../assets/feral-wolf-mark.png';

export default function Login({ onSwitchToSignup }) {
  const [identifier, setIdentifier] = useState(''); // animal name OR full email
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Animal-name accounts use a synthetic email under the hood; real emails
    // (e.g. the owner's) still work as typed.
    const trimmed = identifier.trim();
    const email = trimmed.includes('@') ? trimmed : `${trimmed.toLowerCase()}@feral-ops.local`;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src={wolfMark} alt="Feral Services" className="mark login-mark" />
        <h1>Feral Ops</h1>
        <p>Sign in to see the board.</p>

        <label>
          Animal Name or Email
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="login-hint">
          No account yet?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToSignup(); }}>
            Create one
          </a>
        </p>
      </form>
    </div>
  );
}
