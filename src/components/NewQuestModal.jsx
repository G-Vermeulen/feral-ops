import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const DIFFICULTY_XP = {
  common: [50, 10],
  rare: [120, 25],
  epic: [250, 60],
  legendary: [500, 150],
  mythical: [5000, 1500], // 10x legendary — Questmaster (owner) only
};

export default function NewQuestModal({ onClose }) {
  const [form, setForm] = useState({
    client_name: '',
    job_type: '',
    difficulty: 'common',
    deadline: '',
    notes: '',
    items: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id;
      if (!uid) return;
      supabase
        .from('team_members')
        .select('role')
        .eq('id', uid)
        .single()
        .then(({ data: member }) => setIsOwner(member?.role === 'owner'));
    });
  }, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.client_name.trim() || !form.job_type.trim()) {
      setError('Quest giver and quest type are required.');
      return;
    }
    setSaving(true);
    setError('');

    const [xp_reward, gem_reward] = DIFFICULTY_XP[form.difficulty];
    const { data: userData } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from('jobs').insert({
      client_name: form.client_name.trim(),
      job_type: form.job_type.trim(),
      difficulty: form.difficulty,
      xp_reward,
      gem_reward,
      deadline: form.deadline || null,
      notes: form.notes.trim() || null,
      items: form.items.trim() || null,
      created_by: userData?.user?.id ?? null,
      status: 'todo', // posted unclaimed — anyone can accept it
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Post a New Quest</h2>

        <label>
          Quest Giver
          <input
            type="text"
            placeholder="e.g. Riaan, Johnson & Co."
            value={form.client_name}
            onChange={update('client_name')}
          />
        </label>

        <label>
          Quest Type
          <input
            type="text"
            placeholder="e.g. logo, business cards, flyer, social"
            value={form.job_type}
            onChange={update('job_type')}
          />
        </label>

        <label>
          Difficulty
          <select value={form.difficulty} onChange={update('difficulty')}>
            <option value="common">Common — 50 XP, 10 gems</option>
            <option value="rare">Rare — 120 XP, 25 gems</option>
            <option value="epic">Epic — 250 XP, 60 gems</option>
            <option value="legendary">Legendary — 500 XP, 150 gems</option>
            {isOwner && (
              <option value="mythical">Mythical — 5000 XP, 1500 gems (Questmaster only)</option>
            )}
          </select>
        </label>

        <label>
          Deadline
          <input type="date" value={form.deadline} onChange={update('deadline')} />
        </label>

        <label>
          Quest Information
          <textarea
            rows={3}
            placeholder="Briefing, context, what the client wants…"
            value={form.notes}
            onChange={update('notes')}
          />
        </label>

        <label>
          Quest Items
          <textarea
            rows={2}
            placeholder="Assets/materials needed — e.g. logo files, brand colors, reference images"
            value={form.items}
            onChange={update('items')}
          />
        </label>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Posting…' : 'Post Quest'}
          </button>
        </div>
      </form>
    </div>
  );
}
