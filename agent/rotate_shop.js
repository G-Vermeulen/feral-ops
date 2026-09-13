import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'openai/gpt-oss-20b';

// Rarity distribution: 1 legendary, 2 epic, 3 rare, 4 common = 10 items total.
// Prices scale with rarity — cosmetic only, no gameplay effect.
const TIERS = [
  { rarity: 'legendary', count: 1, cost: 1400 },
  { rarity: 'epic', count: 2, cost: 700 },
  { rarity: 'rare', count: 3, cost: 350 },
  { rarity: 'common', count: 4, cost: 150 },
];
const TOTAL_ITEMS = TIERS.reduce((sum, t) => sum + t.count, 0); // 10

function mondayOf(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

async function generateItems() {
  const prompt = `Generate exactly ${TOTAL_ITEMS} fictional fantasy RPG "classes" and "skills" for a
graphic design studio's cosmetic shop (Feral Services quest board). These are flavor-only
titles employees can equip next to their name — no real gameplay effect, just fun.
Mix classes (e.g. "Ranger", "Blacksmith") and skills (e.g. "Silver Tongue", "Iron Will")
freely across the list. Each should have a short witty one-line description tying it
loosely to design/freelance work (deadlines, clients, revisions, exports, etc.).

Order the list from the MOST impressive/legendary-sounding item first, down to the most
mundane/common-sounding item last — this order determines rarity tier, so item 1 should
feel like the grandest, and item ${TOTAL_ITEMS} the most modest.

Respond with ONLY a raw JSON array, no markdown fences, no commentary, in this exact shape:
[{"name": "...", "category": "class" | "skill", "description": "..."}, ...]`;

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 1.0,
  });

  let text = response.choices[0].message.content.trim();
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');

  const items = JSON.parse(text);
  if (!Array.isArray(items) || items.length < TOTAL_ITEMS) {
    throw new Error(`Expected ${TOTAL_ITEMS} items, got ${Array.isArray(items) ? items.length : typeof items}`);
  }
  return items.slice(0, TOTAL_ITEMS);
}

async function rotateShop() {
  console.log('Generating new shop rotation...');
  const items = await generateItems();

  // Assign rarity + price by position, per the fixed distribution.
  const rows = [];
  let idx = 0;
  for (const tier of TIERS) {
    for (let i = 0; i < tier.count; i++) {
      const item = items[idx++];
      rows.push({
        name: item.name,
        category: item.category === 'skill' ? 'skill' : 'class',
        description: item.description,
        rarity: tier.rarity,
        cost: tier.cost,
        active: true,
        rotation_week: mondayOf(new Date()),
      });
    }
  }

  const { error: deactivateError } = await supabase
    .from('shop_items')
    .update({ active: false })
    .eq('active', true);
  if (deactivateError) throw deactivateError;

  const { error: insertError } = await supabase.from('shop_items').insert(rows);
  if (insertError) throw insertError;

  console.log(`Shop rotated: ${rows.map((r) => `${r.name} (${r.rarity})`).join(', ')}`);
}

rotateShop()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Shop rotation failed:', err);
    process.exit(1);
  });
