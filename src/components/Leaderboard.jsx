import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

// Same curve as the DB trigger: level N needs N^2 * 100 XP
function xpForLevel(level) {
  return level * level * 100;
}

export default function Leaderboard() {
  const [members, setMembers] = useState([]);
  const [itemsById, setItemsById] = useState({});

  const load = useCallback(async () => {
    const [{ data: memberData }, { data: itemData }] = await Promise.all([
      supabase.from('team_members').select('*').order('xp', { ascending: false }),
      supabase.from('shop_items').select('id, name'),
    ]);
    if (memberData) setMembers(memberData);
    if (itemData) {
      const byId = {};
      for (const i of itemData) byId[i.id] = i.name;
      setItemsById(byId);
    }
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('party-leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load]);

  if (members.length === 0) return null;

  return (
    <aside className="leaderboard">
      <h2>The Party</h2>
      {members.map((m) => {
        const thisLevelFloor = xpForLevel(m.level - 1);
        const nextLevelXp = xpForLevel(m.level);
        const progress = Math.min(
          100,
          ((m.xp - thisLevelFloor) / (nextLevelXp - thisLevelFloor)) * 100
        );
        const title = [itemsById[m.equipped_class_id], itemsById[m.equipped_skill_id]]
          .filter(Boolean)
          .join(' · ');

        return (
          <div key={m.id} className="member-row">
            <div className="member-top">
              <span className="member-name">{m.display_name}</span>
              <span className="member-level">Lv. {m.level}</span>
            </div>
            {title && <div className="member-title">{title}</div>}
            <div className="xp-bar">
              <div className="xp-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="member-footer">
              <span className="member-xp">{m.xp} XP</span>
              <span className="member-gems">◆ {m.gems}</span>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
