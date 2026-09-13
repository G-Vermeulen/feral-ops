import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Shop({ onClose }) {
  const [items, setItems] = useState([]);
  const [owned, setOwned] = useState(new Set());
  const [me, setMe] = useState(null); // team_members row for the current user
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return;

    const [{ data: shopItems }, { data: purchases }, { data: member }] = await Promise.all([
      supabase.from('shop_items').select('*').order('cost', { ascending: true }),
      supabase.from('member_purchases').select('item_id').eq('member_id', uid),
      supabase.from('team_members').select('*').eq('id', uid).single(),
    ]);

    setItems(shopItems ?? []);
    setOwned(new Set((purchases ?? []).map((p) => p.item_id)));
    setMe(member ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buy = async (item) => {
    if (!me || me.gems < item.cost || owned.has(item.id)) return;
    setBusyId(item.id);
    setError('');

    // Conditional update: only succeeds if they still have enough gems,
    // preventing a double-spend if two purchases race.
    const { data: updated, error: deductError } = await supabase
      .from('team_members')
      .update({ gems: me.gems - item.cost })
      .eq('id', me.id)
      .gte('gems', item.cost)
      .select()
      .single();

    if (deductError || !updated) {
      setError("Couldn't complete the purchase — you may not have enough gems.");
      setBusyId(null);
      load();
      return;
    }

    const { error: purchaseError } = await supabase
      .from('member_purchases')
      .insert({ member_id: me.id, item_id: item.id });

    if (purchaseError) {
      // roll back the gem deduction if recording the purchase failed
      await supabase.from('team_members').update({ gems: me.gems }).eq('id', me.id);
      setError('Purchase failed, gems refunded.');
      setBusyId(null);
      return;
    }

    setBusyId(null);
    load();
  };

  const equip = async (item) => {
    const field = item.category === 'class' ? 'equipped_class_id' : 'equipped_skill_id';
    await supabase.from('team_members').update({ [field]: item.id }).eq('id', me.id);
    load();
  };

  if (!me) return null;

  const classes = items.filter((i) => i.category === 'class');
  const skills = items.filter((i) => i.category === 'skill');

  const renderItem = (item) => {
    const isOwned = owned.has(item.id);
    const isEquipped =
      (item.category === 'class' && me.equipped_class_id === item.id) ||
      (item.category === 'skill' && me.equipped_skill_id === item.id);
    const canAfford = me.gems >= item.cost;

    return (
      <div key={item.id} className={`shop-item ${isEquipped ? 'equipped' : ''}`}>
        <div className="shop-item-top">
          <span className="shop-item-name">{item.name}</span>
          {!isOwned && <span className="shop-item-cost">◆{item.cost}</span>}
        </div>
        <div className="shop-item-desc">{item.description}</div>
        {isOwned ? (
          <button
            className="shop-equip-btn"
            disabled={isEquipped}
            onClick={() => equip(item)}
          >
            {isEquipped ? 'Equipped' : 'Equip'}
          </button>
        ) : (
          <button
            className="shop-buy-btn"
            disabled={!canAfford || busyId === item.id}
            onClick={() => buy(item)}
          >
            {busyId === item.id ? 'Buying…' : canAfford ? 'Buy' : 'Not enough gems'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card shop-card" onClick={(e) => e.stopPropagation()}>
        <div className="shop-header">
          <h2>The Shop</h2>
          <span className="shop-balance">◆ {me.gems}</span>
        </div>
        <p className="shop-subtitle">
          Cosmetic only — classes and skills are just flavor, they don't change quests or rewards.
        </p>

        {error && <div className="modal-error">{error}</div>}

        <div className="shop-section-label">Classes</div>
        <div className="shop-grid">{classes.map(renderItem)}</div>

        <div className="shop-section-label">Skills</div>
        <div className="shop-grid">{skills.map(renderItem)}</div>

        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
