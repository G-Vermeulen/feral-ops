import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

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
  const [loading, setLoading] = useState(true);
  const [dragJobId, setDragJobId] = useState(null);
  const [expanded, setExpanded] = useState(null);

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

  useEffect(() => {
    loadJobs();
    loadTasks();

    const channel = supabase
      .channel('quest-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => loadJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTasks())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [loadJobs, loadTasks]);

  const moveJob = async (jobId, newStatus) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j)));
    const { error } = await supabase.from('jobs').update({ status: newStatus }).eq('id', jobId);
    if (error) {
      console.error('Failed to move quest', error);
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

  if (loading) return <div className="board-status">Consulting the quest board…</div>;

  return (
    <div className="board">
      {COLUMNS.map((col) => {
        const colJobs = jobs.filter((j) => j.status === col.key);
        return (
          <div
            key={col.key}
            className="column"
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

                return (
                  <div
                    key={job.id}
                    className={`job-card rarity-${job.difficulty}`}
                    draggable
                    onDragStart={() => setDragJobId(job.id)}
                    onDragEnd={() => setDragJobId(null)}
                    onClick={() => setExpanded(isOpen ? null : job.id)}
                  >
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

                    {isOpen && objectives.length > 0 && (
                      <ul className="objective-list" onClick={(e) => e.stopPropagation()}>
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

                    {job.notes && <div className="job-notes">{job.notes}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
