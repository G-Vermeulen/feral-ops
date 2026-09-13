import { createClient } from '@supabase/supabase-js';

// Service role key — server-side only, bypasses RLS. Never ship this to the browser.
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const toolDefinitions = [
  {
    name: 'create_job',
    description: 'Create a new quest (job) for a client.',
    input_schema: {
      type: 'object',
      properties: {
        client_name: { type: 'string' },
        job_type: { type: 'string', description: "e.g. 'logo', 'business_cards', 'flyer', 'social'" },
        difficulty: {
          type: 'string',
          enum: ['common', 'rare', 'epic', 'legendary'],
          description: 'How much effort this quest takes. Default to common for routine work, rare for multi-day jobs, epic for full brand identities, legendary for major/high-stakes clients.',
        },
        deadline: { type: 'string', description: 'YYYY-MM-DD, optional' },
        notes: { type: 'string' },
      },
      required: ['client_name', 'job_type'],
    },
  },
  {
    name: 'update_job_status',
    description: "Move a job to a new status: todo, in_progress, review, or done.",
    input_schema: {
      type: 'object',
      properties: {
        client_name: { type: 'string', description: 'Used to look up the job' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done'] },
      },
      required: ['client_name', 'status'],
    },
  },
  {
    name: 'get_open_jobs',
    description: 'List jobs that are not yet done, optionally filtered by status.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['todo', 'in_progress', 'review'] },
      },
    },
  },
  {
    name: 'get_overdue_jobs',
    description: "List jobs whose deadline has passed and aren't marked done.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_leaderboard',
    description: 'Get the party standings: everyone\'s level, XP, and gem count.',
    input_schema: { type: 'object', properties: {} },
  },
];

const XP_BY_DIFFICULTY = { common: 50, rare: 120, epic: 250, legendary: 500 };
const GEMS_BY_DIFFICULTY = { common: 10, rare: 25, epic: 60, legendary: 150 };

async function logAction(action, input, result) {
  await supabase.from('agent_log').insert({ action, input, result });
}

export async function runTool(name, input) {
  let result;

  if (name === 'create_job') {
    const difficulty = input.difficulty || 'common';
    const payload = {
      ...input,
      difficulty,
      xp_reward: XP_BY_DIFFICULTY[difficulty],
      gem_reward: GEMS_BY_DIFFICULTY[difficulty],
    };
    const { data, error } = await supabase.from('jobs').insert(payload).select().single();
    result = error ? { error: error.message } : { job: data };
  }

  if (name === 'update_job_status') {
    const { data: match } = await supabase
      .from('jobs')
      .select('id')
      .ilike('client_name', `%${input.client_name}%`)
      .limit(1)
      .single();

    if (!match) {
      result = { error: `No job found for client "${input.client_name}"` };
    } else {
      const { data, error } = await supabase
        .from('jobs')
        .update({ status: input.status })
        .eq('id', match.id)
        .select()
        .single();
      result = error ? { error: error.message } : { job: data };
    }
  }

  if (name === 'get_open_jobs') {
    let query = supabase.from('jobs').select('*').neq('status', 'done');
    if (input.status) query = query.eq('status', input.status);
    const { data, error } = await query;
    result = error ? { error: error.message } : { jobs: data };
  }

  if (name === 'get_overdue_jobs') {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .lt('deadline', today)
      .neq('status', 'done');
    result = error ? { error: error.message } : { jobs: data };
  }

  if (name === 'get_leaderboard') {
    const { data, error } = await supabase
      .from('team_members')
      .select('display_name, level, xp, gems')
      .order('gems', { ascending: false });
    result = error ? { error: error.message } : { party: data };
  }

  await logAction(name, input, result);
  return result;
}
