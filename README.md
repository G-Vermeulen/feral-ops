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

## Posting and claiming quests

- **Post a Quest** button on the board opens a form: Quest Giver, Quest Type, Difficulty, Deadline, Quest Information, and Quest Items (materials/assets needed). No typing to the assistant required.
- New quests land in **Unclaimed** with no one assigned.
- Any signed-in team member can tap **Accept Quest** on an unclaimed card — it assigns them and moves the quest straight to **In Progress**. First to claim it gets it.
- Click a quest card to expand it and see the full briefing, items list, and objectives checklist.
- The Questmaster (chat assistant) still works for quick asks like "what's overdue?" or posting a quest by voice/text, and now supports quest items too — but the form is the faster path for day-to-day use.

There's now a floating "Ask the assistant" button in the bottom-right of the
board. It calls the agent server directly — make sure `npm run agent` is
running (or deployed) and `VITE_AGENT_URL` points at it. Try:
- "create a flyer job for Riaan, due Friday"
- "what's overdue?"
- "mark the Johnson job as in review"

Every job it touches updates on the board live for anyone watching.

## Live deployment

Both pieces are deployed on **Render**, from this same GitHub repo:

- **Board** (static site): https://feral-ops-board.onrender.com
- **Agent** (web service): https://feral-ops-agent.onrender.com

Repo is linked to Render by URL rather than through Render's GitHub App, so
**auto-deploy on push does not fire** — after pushing a change, trigger a
manual deploy from the Render dashboard (or ask Claude, if using the Render
connector, to call `trigger_deploy` for the relevant service).

Environment variables already set on each service:
- **Board:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AGENT_URL`
- **Agent:** `GROQ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`,
  `FRONTEND_ORIGIN`, `ROTATION_SECRET`

Both are on Render's **free tier**, which means they spin down after ~15
minutes of inactivity and take 30-60 seconds to wake up on the next request —
this is expected, not a bug. A free uptime pinger (e.g. UptimeRobot) hitting
`/health` on the agent every 10 minutes keeps it warm if that delay is
annoying.

## Next steps once this is running

- Consider a "who's online" indicator using Supabase Presence, if it'd help
  to see who's actively looking at the board
- Gems currently buy cosmetic classes/skills in the Shop (equipped titles on
  the leaderboard) — decide if a real-world reward should ever be layered on
  top once that novelty needs a bigger payoff
- Set up the free weekly shop-rotation scheduler if you haven't yet: a free
  cron-job.org account hitting `/admin/rotate-shop?secret=...` on the agent,
  weekly
