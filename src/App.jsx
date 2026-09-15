import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import KanbanBoard from './components/KanbanBoard';
import Leaderboard from './components/Leaderboard';
import Login from './components/Login';
import Signup from './components/Signup';
import AgentPanel from './components/AgentPanel';
import Shop from './components/Shop';
import LevelUpToast from './components/LevelUpToast';
import InviteTeammateModal from './components/InviteTeammateModal';
import SetPasswordModal from './components/SetPasswordModal';
import wolfMark from './assets/feral-wolf-mark.png';
import './index.css';

function arrivedViaInvite() {
  const hash = window.location.hash || '';
  return hash.includes('type=invite') || hash.includes('type=recovery');
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [showShop, setShowShop] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(arrivedViaInvite());
  const [authView, setAuthView] = useState('signup'); // default new visitors to self-signup

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('team_members')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setIsOwner(data?.role === 'owner'));
  }, [session]);

  if (session === undefined) return null; // brief flash-free load
  if (!session) {
    return authView === 'signup' ? (
      <Signup onSwitchToLogin={() => setAuthView('login')} />
    ) : (
      <Login onSwitchToSignup={() => setAuthView('signup')} />
    );
  }

  if (needsPassword) {
    return (
      <SetPasswordModal
        onDone={() => {
          window.history.replaceState(null, '', window.location.pathname);
          setNeedsPassword(false);
        }}
      />
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <img src={wolfMark} alt="Feral Services" className="mark" />
        <div>
          <h1>Feral Ops</h1>
          <p>The Quest Board — Feral Services</p>
        </div>
        {isOwner && (
          <button className="invite-nav-btn" onClick={() => setShowInvite(true)}>
            Invite
          </button>
        )}
        <button className="shop-nav-btn" onClick={() => setShowShop(true)}>
          Shop
        </button>
        <button className="signout" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>
      <div className="brand-divider" aria-hidden="true" />
      <main className="main-layout">
        <KanbanBoard />
        <Leaderboard />
      </main>
      <AgentPanel />
      <LevelUpToast />
      {showShop && <Shop onClose={() => setShowShop(false)} />}
      {showInvite && <InviteTeammateModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
