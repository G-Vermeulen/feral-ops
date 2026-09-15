import { DIFFICULTY } from './difficultyMeta';

export default function QuestDetailModal({
  job,
  objectives,
  memberName,
  currentUserId,
  newObjectiveText,
  onChangeObjectiveText,
  onAddObjective,
  onToggleObjective,
  onAccept,
  onComplete,
  onCancel,
  onReturn,
  onClose,
}) {
  const diff = DIFFICULTY[job.difficulty] || DIFFICULTY.common;
  const isUnclaimed = !job.assigned_to;
  const doneCount = objectives.filter((t) => t.done).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`scroll-detail rarity-${job.difficulty}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="scroll-detail-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <span className={`wax-seal seal-${job.difficulty}`} aria-hidden="true" />

        <div className="job-top-row">
          <span className="job-rarity-tag">{diff.label}</span>
          <span className="job-rewards">
            <span className="job-xp">+{job.xp_reward} XP</span>
            <span className="job-gems">◆{job.gem_reward}</span>
          </span>
        </div>

        <h2 className="scroll-detail-title">{job.client_name}</h2>
        <div className="job-type">{job.job_type}</div>

        {job.deadline && <div className="job-deadline">Due {job.deadline}</div>}

        <div className="job-owner">
          {isUnclaimed ? (
            <span className="unclaimed-tag">Unclaimed</span>
          ) : (
            <span className="claimed-tag">Claimed by {memberName || 'someone'}</span>
          )}
        </div>

        {isUnclaimed && currentUserId && (
          <button className="accept-btn" onClick={() => onAccept(job)}>
            Accept Quest
          </button>
        )}

        {!isUnclaimed && job.status === 'review' && (
          <button className="return-btn" onClick={() => onReturn(job)}>
            ← Back to In Progress
          </button>
        )}

        {!isUnclaimed && job.status !== 'done' && (
          <div className="quest-action-row">
            <button className="complete-btn" onClick={() => onComplete(job)}>
              Complete
            </button>
            <button className="cancel-btn" onClick={() => onCancel(job)}>
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

        <div className="job-details">
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
                      onChange={() => onToggleObjective(t)}
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
              value={newObjectiveText || ''}
              onChange={(e) => onChangeObjectiveText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAddObjective()}
            />
            <button onClick={onAddObjective}>+</button>
          </div>
        </div>
      </div>
    </div>
  );
}
