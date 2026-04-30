import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  Clock,
  FileWarning,
  Package,
  ShieldAlert,
  ArrowRight,
  UserPlus,
  XCircle,
  X,
} from 'lucide-react';
import { useManagerData, toDays } from './data';
import { ContainerDetailDrawer } from './ContainerDetailDrawer';
import type { ManagerContainer } from './data';

type RiskCategory = 'overdue' | 'missing_docs' | 'no_activity' | 'failed_validation';

type RiskItem = {
  cargo_id: string;
  cargo_uuid: string;
  client_name: string;
  bill_of_lading: string;
  flags: string[];
  category: RiskCategory;
  container: ManagerContainer;
};

const CATEGORY_META: Record<
  RiskCategory,
  { label: string; icon: React.ReactNode; bg: string; border: string; textColor: string }
> = {
  overdue: {
    label: 'Overdue releases',
    icon: <Clock className="size-4" />,
    bg: 'bg-red-500/5',
    border: 'border-red-500/25',
    textColor: 'text-red-600 dark:text-red-400',
  },
  failed_validation: {
    label: 'Failed validation',
    icon: <XCircle className="size-4" />,
    bg: 'bg-red-500/5',
    border: 'border-red-500/25',
    textColor: 'text-red-600 dark:text-red-400',
  },
  missing_docs: {
    label: 'Missing docs near release',
    icon: <FileWarning className="size-4" />,
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/25',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  no_activity: {
    label: 'No timeline activity',
    icon: <AlertTriangle className="size-4" />,
    bg: 'bg-muted/50',
    border: 'border-muted',
    textColor: 'text-muted-foreground',
  },
};

const PRIORITY_FOR_CATEGORY: Record<RiskCategory, { label: string; className: string }> = {
  overdue:           { label: 'High',   className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  failed_validation: { label: 'High',   className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  missing_docs:      { label: 'Medium', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  no_activity:       { label: 'Low',    className: 'bg-muted text-muted-foreground' },
};

export function RiskCenterPage() {
  const { loading, error, rows } = useManagerData();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ManagerContainer | null>(null);

  // Triage state — persisted for the session only
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());
  const [assignees, setAssignees] = useState<Record<string, string>>({});
  // Per-row assign input mode
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignDraft, setAssignDraft] = useState('');
  // Filter: show acknowledged/snoozed toggle
  const [showSnoozed, setShowSnoozed] = useState(false);

  const riskItems = useMemo<RiskItem[]>(() => {
    const seen = new Map<string, RiskItem>();

    for (const r of rows) {
      const days = toDays(r.expected_release_date);
      const flags: string[] = [];
      let category: RiskCategory | null = null;

      if (days !== null && days < 0) {
        flags.push('Release date passed');
        category = 'overdue';
      }
      if (r.verification_status === 'failed') {
        flags.push('Validation failed');
        category = category ?? 'failed_validation';
      }
      if (r.verification_status === 'pending_upload' && days !== null && days <= 2) {
        flags.push(`Missing docs — ${days <= 0 ? 'overdue' : `${days}d to release`}`);
        category = category ?? 'missing_docs';
      }
      if (!r.latest_event_time) {
        flags.push('No timeline activity recorded');
        category = category ?? 'no_activity';
      }

      if (flags.length > 0 && category) {
        const existing = seen.get(r.cargo_id);
        if (existing) {
          existing.flags.push(...flags.filter((f) => !existing.flags.includes(f)));
        } else {
          seen.set(r.cargo_id, {
            cargo_id: r.cargo_id,
            cargo_uuid: r.cargo_uuid,
            client_name: r.client_name,
            bill_of_lading: r.bill_of_lading,
            flags,
            category,
            container: r,
          });
        }
      }
    }

    return Array.from(seen.values()).sort((a, b) => {
      const order: RiskCategory[] = ['overdue', 'failed_validation', 'missing_docs', 'no_activity'];
      return order.indexOf(a.category) - order.indexOf(b.category);
    });
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map<RiskCategory, RiskItem[]>();
    for (const item of riskItems) {
      if (!showSnoozed && snoozed.has(item.cargo_id)) continue;
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [riskItems, snoozed, showSnoozed]);

  const totalVisible = useMemo(() =>
    Array.from(grouped.values()).reduce((s, a) => s + a.length, 0),
    [grouped],
  );

  const snoozedCount = snoozed.size;

  function acknowledge(id: string) {
    setAcknowledged((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function snooze(id: string) {
    setSnoozed((p) => { const n = new Set(p); n.add(id); return n; });
    // cancel any open assign input for this row
    if (assigningId === id) setAssigningId(null);
  }

  function unsnooze(id: string) {
    setSnoozed((p) => { const n = new Set(p); n.delete(id); return n; });
  }

  function startAssign(id: string) {
    setAssignDraft(assignees[id] ?? '');
    setAssigningId(id);
  }

  function confirmAssign(id: string) {
    if (assignDraft.trim()) {
      setAssignees((p) => ({ ...p, [id]: assignDraft.trim() }));
    }
    setAssigningId(null);
    setAssignDraft('');
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Risk Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Flagged containers requiring attention
          </p>
        </div>
        <div className="flex items-center gap-3">
          {snoozedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowSnoozed((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <BellOff className="size-3" />
              {showSnoozed ? 'Hide' : 'Show'} {snoozedCount} snoozed
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/pipeline')}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Full pipeline <ArrowRight className="size-3" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-card border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : totalVisible === 0 && snoozedCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="size-7 text-emerald-500" />
          </div>
          <p className="text-sm font-medium">No active risks detected</p>
          <p className="text-xs opacity-60 text-center max-w-xs">
            All containers are on track. The risk center will surface issues as they arise.
          </p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.keys(CATEGORY_META) as RiskCategory[]).map((cat) => {
              const meta = CATEGORY_META[cat];
              const count = grouped.get(cat)?.length ?? 0;
              return (
                <div key={cat} className={`rounded-xl border px-4 py-3 ${meta.bg} ${meta.border}`}>
                  <div className={`flex items-center gap-1.5 mb-1 ${meta.textColor}`}>
                    {meta.icon}
                    <span className="text-xs font-medium truncate">{meta.label}</span>
                  </div>
                  <div className={`text-2xl font-bold tabular-nums ${meta.textColor}`}>{count}</div>
                </div>
              );
            })}
          </div>

          {/* Risk groups */}
          {(Object.keys(CATEGORY_META) as RiskCategory[]).map((cat) => {
            const items = grouped.get(cat);
            if (!items || items.length === 0) return null;
            const meta = CATEGORY_META[cat];
            const priority = PRIORITY_FOR_CATEGORY[cat];
            return (
              <div key={cat} className={`border rounded-xl overflow-hidden ${meta.border}`}>
                {/* Group header */}
                <div className={`px-5 py-3.5 border-b ${meta.bg} ${meta.border} flex items-center gap-2`}>
                  <span className={meta.textColor}>{meta.icon}</span>
                  <span className={`text-sm font-semibold ${meta.textColor}`}>{meta.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ml-auto ${meta.bg} ${meta.textColor}`}>
                    {items.length}
                  </span>
                </div>

                {/* Rows */}
                <div className="divide-y bg-card" style={{ borderColor: 'var(--border)' }}>
                  {items.map((item) => {
                    const isAcknowledged = acknowledged.has(item.cargo_id);
                    const isAssigning = assigningId === item.cargo_id;
                    const assignee = assignees[item.cargo_id];

                    return (
                      <div
                        key={item.cargo_id}
                        className={`px-5 py-3.5 transition-colors ${isAcknowledged ? 'opacity-50' : 'hover:bg-muted/20'}`}
                      >
                        {/* Top row — ID + client + priority */}
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                            <Package className="size-3.5 text-muted-foreground" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            {/* ID line */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setSelected(item.container)}
                                className="font-mono text-sm font-semibold hover:underline"
                              >
                                {item.cargo_id}
                              </button>
                              <span className="text-xs text-muted-foreground">{item.client_name}</span>
                              {item.bill_of_lading && (
                                <span className="font-mono text-xs text-muted-foreground/60">{item.bill_of_lading}</span>
                              )}
                              {isAcknowledged && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">
                                  ✓ Acknowledged
                                </span>
                              )}
                              {assignee && !isAssigning && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-400 font-medium">
                                  → {assignee}
                                </span>
                              )}
                            </div>

                            {/* Flag chips */}
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {item.flags.map((flag) => (
                                <span
                                  key={flag}
                                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${meta.border} ${meta.bg} ${meta.textColor}`}
                                >
                                  <ShieldAlert className="size-2.5" />
                                  {flag}
                                </span>
                              ))}
                            </div>

                            {/* Assign input (inline) */}
                            {isAssigning && (
                              <div className="mt-2 flex items-center gap-2 max-w-xs">
                                <input
                                  autoFocus
                                  value={assignDraft}
                                  onChange={(e) => setAssignDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') confirmAssign(item.cargo_id);
                                    if (e.key === 'Escape') setAssigningId(null);
                                  }}
                                  placeholder="Assignee name…"
                                  className="flex-1 px-2.5 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  style={{ borderColor: 'var(--border)' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => confirmAssign(item.cargo_id)}
                                  className="text-xs px-2.5 py-1.5 rounded-md border font-medium"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  Assign
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAssigningId(null)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Right side: priority chip + actions */}
                          <div className="flex items-center gap-2 shrink-0 ml-auto flex-wrap justify-end">
                            {/* Priority */}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${priority.className}`}>
                              {priority.label}
                            </span>

                            {/* View */}
                            <button
                              type="button"
                              onClick={() => setSelected(item.container)}
                              className="text-xs px-2.5 py-1.5 rounded-md border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                              style={{ borderColor: 'var(--border)' }}
                              title="Open container details"
                            >
                              View
                            </button>

                            {/* Assign */}
                            {!isAssigning && (
                              <button
                                type="button"
                                onClick={() => startAssign(item.cargo_id)}
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border hover:bg-sky-500/10 hover:border-sky-500/40 hover:text-sky-700 dark:hover:text-sky-400 transition-colors"
                                style={{ borderColor: 'var(--border)' }}
                                title="Assign to team member"
                              >
                                <UserPlus className="size-3" />
                                Assign
                              </button>
                            )}

                            {/* Acknowledge */}
                            <button
                              type="button"
                              onClick={() => acknowledge(item.cargo_id)}
                              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                                isAcknowledged
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                  : 'hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-700 dark:hover:text-emerald-400'
                              }`}
                              style={isAcknowledged ? {} : { borderColor: 'var(--border)' }}
                              title={isAcknowledged ? 'Unacknowledge' : 'Acknowledge'}
                            >
                              <CheckCircle2 className="size-3" />
                              {isAcknowledged ? 'Ack\u2019d' : 'Ack'}
                            </button>

                            {/* Snooze */}
                            <button
                              type="button"
                              onClick={() => snooze(item.cargo_id)}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                              style={{ borderColor: 'var(--border)' }}
                              title="Snooze — hide from list this session"
                            >
                              <BellOff className="size-3" />
                              Snooze
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Snoozed items (shown when toggled) */}
          {showSnoozed && snoozedCount > 0 && (
            <div className="border rounded-xl overflow-hidden border-muted">
              <div className="px-5 py-3.5 border-b bg-muted/30 flex items-center gap-2">
                <BellOff className="size-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-muted-foreground">Snoozed</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-auto bg-muted text-muted-foreground">{snoozedCount}</span>
              </div>
              <div className="divide-y bg-card" style={{ borderColor: 'var(--border)' }}>
                {riskItems.filter((i) => snoozed.has(i.cargo_id)).map((item) => (
                  <div key={item.cargo_id} className="px-5 py-3 flex items-center gap-3 opacity-50">
                    <Package className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono text-sm flex-1">{item.cargo_id}</span>
                    <span className="text-xs text-muted-foreground">{item.client_name}</span>
                    <button
                      type="button"
                      onClick={() => unsnooze(item.cargo_id)}
                      className="text-xs px-2.5 py-1.5 rounded-md border hover:bg-muted/50 transition-colors text-muted-foreground"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      Unsnooze
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <ContainerDetailDrawer
        container={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
