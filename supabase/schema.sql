-- Feral Ops: core schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

create extension if not exists "uuid-ossp";

-- Adventurers on the team (mirrors auth.users, adds XP/level for the game layer)
create table if not exists team_members (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'designer', -- 'owner' | 'designer' | 'contractor'
  xp integer not null default 0,
  level integer not null default 1,
  gems integer not null default 0,
  created_at timestamptz not null default now()
);

-- Jobs = Quests: the top-level unit of work (a client project)
create table if not exists jobs (
  id uuid primary key default uuid_generate_v4(),
  client_name text not null,
  job_type text not null,             -- 'logo', 'business_cards', 'flyer', 'social', 'print_run', etc.
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  difficulty text not null default 'common' check (difficulty in ('common', 'rare', 'epic', 'legendary')),
  xp_reward integer not null default 50,
  gem_reward integer not null default 10,
  assigned_to uuid references team_members(id),
  deadline date,
  notes text,
  created_by uuid references team_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tasks = Objectives: the checklist inside a quest
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- Agent activity log
create table if not exists agent_log (
  id uuid primary key default uuid_generate_v4(),
  requested_by uuid references team_members(id),
  action text not null,
  input jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);

-- Keep updated_at fresh on jobs
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists jobs_set_updated_at on jobs;
create trigger jobs_set_updated_at
  before update on jobs
  for each row execute function set_updated_at();

-- Award XP + gems, and level up the assignee automatically when a quest is completed.
-- Leveling curve: level N requires N^2 * 100 total XP (level 1 -> 2 at 400xp, etc.)
create or replace function award_quest_xp()
returns trigger as $$
declare
  new_xp integer;
  new_level integer;
begin
  if new.status = 'done' and old.status is distinct from 'done' and new.assigned_to is not null then
    update team_members
      set xp = xp + new.xp_reward,
          gems = gems + new.gem_reward
      where id = new.assigned_to
      returning xp into new_xp;

    new_level := floor(sqrt(new_xp::numeric / 100)) + 1;

    update team_members set level = new_level where id = new.assigned_to;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists jobs_award_xp on jobs;
create trigger jobs_award_xp
  after update on jobs
  for each row execute function award_quest_xp();

-- Row Level Security: any authenticated team member can read/write.
alter table jobs enable row level security;
alter table tasks enable row level security;
alter table team_members enable row level security;
alter table agent_log enable row level security;

create policy "team can read jobs" on jobs for select using (auth.role() = 'authenticated');
create policy "team can write jobs" on jobs for all using (auth.role() = 'authenticated');

create policy "team can read tasks" on tasks for select using (auth.role() = 'authenticated');
create policy "team can write tasks" on tasks for all using (auth.role() = 'authenticated');

create policy "team can read members" on team_members for select using (auth.role() = 'authenticated');
create policy "team can update own xp via trigger" on team_members for update using (auth.role() = 'authenticated');

create policy "team can read agent log" on agent_log for select using (auth.role() = 'authenticated');
create policy "team can write agent log" on agent_log for all using (auth.role() = 'authenticated');

-- Enable realtime on the tables the board and leaderboard watch
alter publication supabase_realtime add table jobs;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table team_members;
