import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function LevelUpToast() {
  const [toast, setToast] = useState(null); // { name, level }

  useEffect(() => {
    const channel = supabase
      .channel('level-up-watch')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'team_members' },
        (payload) => {
          const before = payload.old?.level;
          const after = payload.new?.level;
          if (typeof before === 'number' && after > before) {
            setToast({ name: payload.new.display_name, level: after });
            setTimeout(() => setToast(null), 5000);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  if (!toast) return null;

  return (
    <div className="levelup-toast">
      <div className="levelup-title">Level Up!</div>
      <div className="levelup-body">
        {toast.name} reached <strong>Level {toast.level}</strong>
      </div>
    </div>
  );
}
