import { useState, useRef, useEffect } from 'react';

const AGENT_URL = import.meta.env.VITE_AGENT_URL || 'http://localhost:3001/chat';

export default function AgentPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [thread, setThread] = useState([]); // [{role, text}]
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]); // raw messages array for the API
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  const send = async (e) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;

    setThread((t) => [...t, { role: 'user', text: message }]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(AGENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json();
      setThread((t) => [...t, { role: 'agent', text: data.reply }]);
      setHistory(data.messages ?? []);
    } catch (err) {
      setThread((t) => [
        ...t,
        { role: 'agent', text: "Couldn't reach the agent — is the server running?" },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`agent-panel ${open ? 'open' : ''}`}>
      <button className="agent-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close assistant' : 'Ask the assistant'}
      </button>

      {open && (
        <div className="agent-window">
          <div className="agent-thread">
            {thread.length === 0 && (
              <div className="agent-empty">
                Try: "post a legendary quest for Riaan's rebrand, due Friday" or "what's overdue?"
              </div>
            )}
            {thread.map((m, i) => (
              <div key={i} className={`agent-msg ${m.role}`}>
                {m.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form className="agent-input-row" onSubmit={send}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell it what to do…"
              disabled={sending}
            />
            <button type="submit" disabled={sending}>
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
