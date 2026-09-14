import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SetPasswordModal({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onDone();
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="mark" aria-hidden="true" />
        <h1>Welcome to the Party</h1>
        <p>You're in! Set a password so you can log back in next time.</p>

        <label>
          New Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <label>
          Confirm Password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Set Password & Enter'}
        </button>
      </form>
    </div>
  );
}
