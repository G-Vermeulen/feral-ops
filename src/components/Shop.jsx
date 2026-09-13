import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const RARITY_LABEL = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 };

export default function Shop({ onClose }) {
  const [activeItems, setActiveItems] = useState([]); // current rotation, buyable
  const [ownedItems, setOwnedItems] = useState([]); // everything the player owns, any rotation
  const [ownedIds, setOwnedIds] = useState(new Set());
  const [me, setMe] = useState(null);
  const [rotationWeek, setRotationWeek] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return;

    const [{ data: shopItems }, { data: purchases }, { data: member }] = await Promise.all([
      supabase.from('shop_items').select('*').eq('active', true),
      supabase.from('member_purchases').select('item_id, shop_items(*)').eq('member_id', uid),
      supabase.from('team_members').select('*').eq('id', uid).single(),
    ]);

    const sorted = (shopItems ?? []).sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
    setActiveItems(sorted);
    setRotationWeek(sorted[0]?.rotation_week ?? null);
    setOwnedIds(new Set((purchases ?? []).map((p) => p.item_id)));
    setOwnedItems((purchases ?? []).map((p) => p.shop_items).filter(Boolean));
    setMe(member ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buy = async (item) => {
    if (!me || me.gems < item.cost || ownedIds.has(item.id)) return;
    setBusyId(item.id);
    setError('');

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

  const renderItem = (item, forceOwned = false) => {
    const isOwned = forceOwned || ownedIds.has(item.id);
    const isEquipped =
      (item.category === 'class' && me.equipped_class_id === item.id) ||
      (item.category === 'skill' && me.equipped_skill_id === item.id);
    const canAfford = me.gems >= item.cost;

    return (
      <div key={item.id} className={`shop-item rarity-tag-${item.rarity} ${isEquipped ? 'equipped' : ''}`}>
        <div className="shop-item-top">
          <span className={`shop-rarity-label rarity-text-${item.rarity}`}>
            {RARITY_LABEL[item.rarity]}
          </span>
          {!isOwned && <span className="shop-item-cost">◆{item.cost}</span>}
        </div>
        <div className="shop-item-name">{item.name}</div>
        <div className="shop-item-desc">{item.description}</div>
        {isOwned ? (
          <button className="shop-equip-btn" disabled={isEquipped} onClick={() => equip(item)}>
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
          {rotationWeek && ` This week's rotation: ${rotationWeek}.`}
        </p>

        {error && <div className="modal-error">{error}</div>}

        <div className="shop-section-label">This Week's Rotation</div>
        <div className="shop-grid">{activeItems.map((i) => renderItem(i))}</div>

        {ownedItems.length > 0 && (
          <>
            <div className="shop-section-label">Your Collection</div>
            <div className="shop-grid">{ownedItems.map((i) => renderItem(i, true))}</div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
