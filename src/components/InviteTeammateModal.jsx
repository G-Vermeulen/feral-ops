import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AGENT_URL = import.meta.env.VITE_AGENT_URL || 'http://localhost:3001/chat';
const INVITE_URL = AGENT_URL.replace(/\/chat$/, '/admin/invite-teammate');

export default function InviteTeammateModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok: true } | { error }

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setResult(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    try {
      const res = await fetch(INVITE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: email.trim(), display_name: displayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error || 'Something went wrong.' });
      } else {
        setResult({ ok: true });
        setEmail('');
        setDisplayName('');
      }
    } catch (err) {
      setResult({ error: "Couldn't reach the server." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Invite a Teammate</h2>
        <p className="shop-subtitle">
          They'll get an email invite to set their password and join the board.
        </p>

        <label>
          Display Name
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        {result?.error && <div className="modal-error">{result.error}</div>}
        {result?.ok && <div className="invite-success">Invite sent!</div>}

        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onClose}>
            Close
          </button>
          <button type="submit" disabled={sending}>
            {sending ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
      </form>
    </div>
  );
}
