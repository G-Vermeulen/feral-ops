import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import KanbanBoard from './components/KanbanBoard';
import Leaderboard from './components/Leaderboard';
import Login from './components/Login';
import AgentPanel from './components/AgentPanel';
import Shop from './components/Shop';
import './index.css';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [showShop, setShowShop] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null; // brief flash-free load
  if (!session) return <Login />;

  return (
    <div className="app">
      <header className="app-header">
        <div className="mark" aria-hidden="true" />
        <div>
          <h1>Feral Ops</h1>
          <p>The Quest Board — Feral Services</p>
        </div>
        <button className="shop-nav-btn" onClick={() => setShowShop(true)}>
          Shop
        </button>
        <button className="signout" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>
      <main className="main-layout">
        <KanbanBoard />
        <Leaderboard />
      </main>
      <AgentPanel />
      {showShop && <Shop onClose={() => setShowShop(false)} />}
    </div>
  );
}
