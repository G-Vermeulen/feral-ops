import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { rotateShop } from './shopRotation.js';
import { runChat } from './chat.js';
import { startDiscordBot } from './discordBot.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();

// In dev this allows all origins. Once deployed, set FRONTEND_ORIGIN to your
// Vercel URL so only your own board can call this server.
const allowedOrigin = process.env.FRONTEND_ORIGIN;
app.use(cors(allowedOrigin ? { origin: allowedOrigin } : {}));
app.use(express.json());

app.post('/admin/invite-teammate', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing session token' });

  const { data: userResult, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userResult?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const { data: requester } = await supabaseAdmin
    .from('team_members')
    .select('role')
    .eq('id', userResult.user.id)
    .single();
  if (requester?.role !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can invite teammates' });
  }

  const { email, display_name } = req.body;
  if (!email || !display_name) {
    return res.status(400).json({ error: 'email and display_name are required' });
  }

  const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: 'https://feral-ops-board.onrender.com',
  });
  if (inviteErr) {
    return res.status(500).json({ error: inviteErr.message });
  }

  const { error: insertErr } = await supabaseAdmin
    .from('team_members')
    .insert({ id: invited.user.id, display_name, role: 'designer' });
  if (insertErr) {
    return res.status(500).json({ error: insertErr.message });
  }

  res.json({ ok: true });
});

// Triggered weekly by a free external scheduler (e.g. cron-job.org) hitting this
// URL with the shared secret — keeps the rotation genuinely free (no Render cron cost).
// Accepts either a POST with an X-Rotation-Secret header, or a plain GET with
// ?secret=... in the URL (so it can be triggered from a browser or a simple scheduler).
async function handleRotate(req, res) {
  const secret = req.headers['x-rotation-secret'] || req.query.secret;
  if (!process.env.ROTATION_SECRET || secret !== process.env.ROTATION_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const rows = await rotateShop();
    res.json({ ok: true, items: rows.map((r) => ({ name: r.name, rarity: r.rarity })) });
  } catch (err) {
    console.error('Shop rotation failed:', err);
    res.status(500).json({ error: err.message });
  }
}

app.post('/admin/rotate-shop', handleRotate);
app.get('/admin/rotate-shop', handleRotate);

app.post('/chat', async (req, res) => {
  const { message, history = [] } = req.body;
  try {
    const result = await runChat(message, history);
    res.json(result);
  } catch (err) {
    console.error('Chat failed:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Feral Ops agent (Groq) listening on :${PORT}`));

// Discord bot runs alongside the HTTP server, in the same process — only
// starts if a bot token is configured.
startDiscordBot();
