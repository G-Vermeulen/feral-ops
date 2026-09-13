# Feral Ops

A real-time **quest board** for Feral Services. Every job is a quest with a
difficulty tier and an XP reward; completing one levels up whoever's assigned.
An AI Questmaster (running on Groq's free-tier Llama 3.3 70B — no Anthropic
API billing required) can post and close quests on request. Built to make the
day-to-day feel like a party grinding a shared board, not a task list.

## What's in here

- `supabase/schema.sql` — database schema (quests, objectives, party members, XP/level trigger, agent log)
- `src/` — React quest board (Vite). Live-syncs across everyone connected.
- `agent/` — Node/Express server giving Claude ("the Questmaster") tool access to the same tables
- `.env.example` — copy to `.env` and fill in your keys

## The game layer

- **Quests** (jobs) have a `difficulty`: common / rare / epic / legendary, each with a default XP reward (50/120/250/500) and **gem** reward (10/25/60/150) — gems are shown with a ◆ symbol.
- **Objectives** (tasks) are a per-quest checklist with a progress bar — click a quest card to expand it.
- Marking a quest **Completed** fires a database trigger that adds XP and gems to whoever it's assigned to and recalculates their level automatically — no app code needed, works even when the AI agent closes the quest.
- The **Party** sidebar shows everyone's level, XP bar, and gem count, live.
- Gems don't do anything yet — they're a pure "look what I earned" currency. Natural next step: let people redeem gems for something real (choose the next music at the studio, skip a chore, a small bonus) once the novelty needs a payoff.

## Setup

1. **Create a Supabase project** at supabase.com (free tier is enough for 2-3 users).
2. In the SQL Editor, paste and run `supabase/schema.sql`.
3. In Project Settings > API, copy your **Project URL**, **anon public key**, and
   **service_role key**.
4. `cp .env.example .env` and fill in:
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — for the frontend
   - `SUPABASE_SERVICE_ROLE_KEY` — for the agent server only (keep this secret)
   - `GROQ_API_KEY` — free at console.groq.com (no card required for the free tier)
5. Install and run the board:
   ```
   npm install
   npm run dev
   ```
6. In a second terminal, run the agent server:
   ```
   npm run agent
   ```
   It listens on `http://localhost:3001/chat` — POST `{ "message": "..." }` to it.
   Wire this to whatever chat surface you want (a simple chat box in the app,
   a Slack bot, a Telegram bot — the endpoint doesn't care).

## Inviting your 1-2 employees

Email auth is already wired into the app (`src/components/Login.jsx`). To add
someone:
1. Supabase dashboard > Authentication > Users > "Add user" (set an email + password)
2. Add a matching row in `team_members` (same `id` as their auth user) so they
   show up as an assignee on jobs.

They log in at the board's URL and see the same live jobs you do.

## Talking to the assistant

There's now a floating "Ask the assistant" button in the bottom-right of the
board. It calls the agent server directly — make sure `npm run agent` is
running (or deployed) and `VITE_AGENT_URL` points at it. Try:
- "create a flyer job for Riaan, due Friday"
- "what's overdue?"
- "mark the Johnson job as in review"

Every job it touches updates on the board live for anyone watching.

## Going live (Vercel + Railway)

The board and the agent are two separate deployments — a static frontend and a
small always-on server.

**1. Push this folder to a GitHub repo** (Vercel and Railway both deploy from git):
```
git init
git add .
git commit -m "Feral Ops"
gh repo create feral-ops --private --source=. --push
```
(or create the repo on GitHub's site and `git remote add origin ...` + `git push`)

**2. Deploy the board to Vercel:**
- vercel.com > New Project > import the repo
- It auto-detects Vite (via `vercel.json`) — no config needed
- Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
  `VITE_AGENT_URL` (you'll fill this in after step 3)
- Deploy — you'll get a URL like `feral-ops.vercel.app`

**3. Deploy the agent to Railway:**
- railway.app > New Project > deploy from the same GitHub repo
- It auto-detects Node and uses `railway.json` to run `npm run start`
- Add environment variables: `GROQ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `VITE_SUPABASE_URL`, and `FRONTEND_ORIGIN` (your Vercel URL from step 2)
- Deploy — you'll get a URL like `feral-ops-agent.up.railway.app`

**4. Wire them together:**
- Back in Vercel, set `VITE_AGENT_URL` to `https://feral-ops-agent.up.railway.app/chat`
- Redeploy the frontend (Vercel does this automatically on env var changes, or trigger manually)

Now the board is a real URL you and your employees can bookmark on any device —
no local servers to keep running.

## Next steps once this is running

- Consider a "who's online" indicator using Supabase Presence, if it'd help
  to see who's actively looking at the board
- A level-up toast/animation would land better than the number silently changing
- Decide what gems are actually redeemable for once the novelty needs a payoff
