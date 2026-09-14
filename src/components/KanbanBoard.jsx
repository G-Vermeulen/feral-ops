import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import NewQuestModal from './NewQuestModal';

const COLUMNS = [
  { key: 'todo', label: 'Unclaimed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: "Awaiting Judgement" },
  { key: 'done', label: 'Completed' },
];

const DIFFICULTY = {
  common: { label: 'Common', stars: 1 },
  rare: { label: 'Rare', stars: 2 },
  epic: { label: 'Epic', stars: 3 },
  legendary: { label: 'Legendary', stars: 4 },
};

export default function KanbanBoard() {
  const [jobs, setJobs] = useState([]);
  const [tasksByJob, setTasksByJob] = useState({});
  const [members, setMembers] = useState({}); // id -> display_name
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dragJobId, setDragJobId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showNewQuest, setShowNewQuest] = useState(false);
  const [newObjectiveText, setNewObjectiveText] = useState({}); // jobId -> draft text
  const [searchText, setSearchText] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  const loadJobs = useCallback(async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('deadline', { ascending: true, nullsFirst: false });
    if (!error) setJobs(data ?? []);
    setLoading(false);
  }, []);

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase.from('tasks').select('*');
    if (!error) {
      const grouped = {};
      for (const t of data ?? []) {
        grouped[t.job_id] = grouped[t.job_id] || [];
        grouped[t.job_id].push(t);
      }
      setTasksByJob(grouped);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    const { data, error } = await supabase.from('team_members').select('id, display_name');
    if (!error) {
      const byId = {};
      for (const m of data ?? []) byId[m.id] = m.display_name;
      setMembers(byId);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    loadTasks();
    loadMembers();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data?.user?.id ?? null));

    const channel = supabase
      .channel('quest-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => loadJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTasks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => loadMembers())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [loadJobs, loadTasks, loadMembers]);

  const visibleJobs = jobs
    .filter((j) => j.status !== 'cancelled')
    .filter((j) => difficultyFilter === 'all' || j.difficulty === difficultyFilter)
    .filter((j) => {
      if (!searchText.trim()) return true;
      const q = searchText.trim().toLowerCase();
      return j.client_name.toLowerCase().includes(q) || j.job_type.toLowerCase().includes(q);
    });

  const moveJob = async (jobId, newStatus) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j)));
    const { error } = await supabase.from('jobs').update({ status: newStatus }).eq('id', jobId);
    if (error) {
      console.error('Failed to move quest', error);
      loadJobs();
    }
  };

  const acceptQuest = async (job, e) => {
    e.stopPropagation();
    if (!currentUserId) return;
    setJobs((prev) =>
      prev.map((j) =>
        j.id === job.id ? { ...j, assigned_to: currentUserId, status: 'in_progress' } : j
      )
    );
    const { error } = await supabase
      .from('jobs')
      .update({ assigned_to: currentUserId, status: 'in_progress' })
      .eq('id', job.id);
    if (error) {
      console.error('Failed to accept quest', error);
      loadJobs();
    }
  };

  const completeQuest = async (job, e) => {
    e.stopPropagation();
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'done' } : j)));
    const { error } = await supabase.from('jobs').update({ status: 'done' }).eq('id', job.id);
    if (error) {
      console.error('Failed to complete quest', error);
      loadJobs();
    }
  };

  const returnToProgress = async (job, e) => {
    e.stopPropagation();
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'in_progress' } : j)));
    const { error } = await supabase.from('jobs').update({ status: 'in_progress' }).eq('id', job.id);
    if (error) {
      console.error('Failed to move quest back', error);
      loadJobs();
    }
  };

  const cancelQuest = async (job, e) => {
    e.stopPropagation();
    if (!window.confirm(`Cancel the "${job.job_type}" quest for ${job.client_name}?`)) return;
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'cancelled' } : j)));
    const { error } = await supabase.from('jobs').update({ status: 'cancelled' }).eq('id', job.id);
    if (error) {
      console.error('Failed to cancel quest', error);
      loadJobs();
    }
  };

  const toggleObjective = async (task) => {
    setTasksByJob((prev) => ({
      ...prev,
      [task.job_id]: prev[task.job_id].map((t) =>
        t.id === task.id ? { ...t, done: !t.done } : t
      ),
    }));
    await supabase.from('tasks').update({ done: !task.done }).eq('id', task.id);
  };

  const addObjective = async (jobId) => {
    const title = (newObjectiveText[jobId] || '').trim();
    if (!title) return;
    setNewObjectiveText((prev) => ({ ...prev, [jobId]: '' }));
    const { error } = await supabase.from('tasks').insert({ job_id: jobId, title });
    if (error) console.error('Failed to add objective', error);
    else loadTasks();
  };

  if (loading) return <div className="board-status">Consulting the quest board…</div>;

  return (
    <div className="board-wrap">
      <div className="board-toolbar">
        <input
          type="text"
          className="board-search"
          placeholder="Search by client or type…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <select
          className="board-filter"
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
        >
          <option value="all">All difficulties</option>
          <option value="common">Common</option>
          <option value="rare">Rare</option>
          <option value="epic">Epic</option>
          <option value="legendary">Legendary</option>
        </select>
        <button className="new-quest-btn" onClick={() => setShowNewQuest(true)}>
          + Post a Quest
        </button>
      </div>

      <div className="board">
        {COLUMNS.map((col) => {
          const colJobs = visibleJobs.filter((j) => j.status === col.key);
          return (
            <div
              key={col.key}
              className="column quest-scroll"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragJobId && moveJob(dragJobId, col.key)}
            >
              <div className="column-header">
                <span>{col.label}</span>
                <span className="column-count">{colJobs.length}</span>
              </div>
              <div className="column-body">
                {colJobs.length === 0 && <div className="column-empty">No quests here</div>}
                {colJobs.map((job) => {
                  const diff = DIFFICULTY[job.difficulty] || DIFFICULTY.common;
                  const objectives = tasksByJob[job.id] || [];
                  const doneCount = objectives.filter((t) => t.done).length;
                  const isOpen = expanded === job.id;
                  const isUnclaimed = !job.assigned_to;

                  return (
                    <div
                      key={job.id}
                      className={`job-card parchment-card rarity-${job.difficulty}`}
                      draggable
                      onDragStart={() => setDragJobId(job.id)}
                      onDragEnd={() => setDragJobId(null)}
                      onClick={() => setExpanded(isOpen ? null : job.id)}
                    >
                      <span className={`wax-seal seal-${job.difficulty}`} aria-hidden="true" />
                      <div className="job-top-row">
                        <span className="job-rarity-tag">{diff.label}</span>
                        <span className="job-rewards">
                          <span className="job-xp">+{job.xp_reward} XP</span>
                          <span className="job-gems">◆{job.gem_reward}</span>
                        </span>
                      </div>
                      <div className="job-client">{job.client_name}</div>
                      <div className="job-type">{job.job_type}</div>

                      {job.deadline && <div className="job-deadline">Due {job.deadline}</div>}

                      <div className="job-owner">
                        {isUnclaimed ? (
                          <span className="unclaimed-tag">Unclaimed</span>
                        ) : (
                          <span className="claimed-tag">
                            Claimed by {members[job.assigned_to] || 'someone'}
                          </span>
                        )}
                      </div>

                      {isUnclaimed && currentUserId && (
                        <button className="accept-btn" onClick={(e) => acceptQuest(job, e)}>
                          Accept Quest
                        </button>
                      )}

                      {!isUnclaimed && job.status === 'review' && (
                        <button
                          className="return-btn"
                          onClick={(e) => returnToProgress(job, e)}
                        >
                          ← Back to In Progress
                        </button>
                      )}

                      {!isUnclaimed && job.status !== 'done' && (
                        <div className="quest-action-row">
                          <button className="complete-btn" onClick={(e) => completeQuest(job, e)}>
                            Complete
                          </button>
                          <button className="cancel-btn" onClick={(e) => cancelQuest(job, e)}>
                            Cancel
                          </button>
                        </div>
                      )}

                      {objectives.length > 0 && (
                        <div className="job-progress">
                          <div className="job-progress-bar">
                            <div
                              className="job-progress-fill"
                              style={{ width: `${(doneCount / objectives.length) * 100}%` }}
                            />
                          </div>
                          <span className="job-progress-label">
                            {doneCount}/{objectives.length} objectives
                          </span>
                        </div>
                      )}

                      {isOpen && (
                        <div className="job-details" onClick={(e) => e.stopPropagation()}>
                          {job.notes && (
                            <div className="job-detail-block">
                              <div className="job-detail-label">Quest Info</div>
                              <div className="job-notes">{job.notes}</div>
                            </div>
                          )}
                          {job.items && (
                            <div className="job-detail-block">
                              <div className="job-detail-label">Quest Items</div>
                              <div className="job-notes">{job.items}</div>
                            </div>
                          )}
                          {objectives.length > 0 && (
                            <ul className="objective-list">
                              {objectives.map((t) => (
                                <li key={t.id}>
                                  <label>
                                    <input
                                      type="checkbox"
                                      checked={t.done}
                                      onChange={() => toggleObjective(t)}
                                    />
                                    <span className={t.done ? 'done' : ''}>{t.title}</span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="add-objective-row">
                            <input
                              type="text"
                              placeholder="Add an objective…"
                              value={newObjectiveText[job.id] || ''}
                              onChange={(e) =>
                                setNewObjectiveText((prev) => ({ ...prev, [job.id]: e.target.value }))
                              }
                              onKeyDown={(e) => e.key === 'Enter' && addObjective(job.id)}
                            />
                            <button onClick={() => addObjective(job.id)}>+</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {showNewQuest && <NewQuestModal onClose={() => setShowNewQuest(false)} />}
    </div>
  );
}
