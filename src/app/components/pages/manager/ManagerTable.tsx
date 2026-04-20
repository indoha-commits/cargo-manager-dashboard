import { useState } from 'react';
import type { ManagerContainer } from './data';
import { eventTypeLabel, formatRelativeTime, milestoneProgress } from './data';
import { ContainerDetailDrawer } from './ContainerDetailDrawer';
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Package,
  TrendingUp,
} from 'lucide-react';

function PriorityBar({ priority }: { priority: ManagerContainer['priority_level'] }) {
  const color =
    priority === 'red'
      ? 'bg-red-500'
      : priority === 'yellow'
        ? 'bg-amber-400'
        : 'bg-emerald-500';
  return <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${color}`} />;
}

function VerifBadge({ status }: { status: ManagerContainer['verification_status'] }) {
  const configs: Record<ManagerContainer['verification_status'], { label: string; className: string }> = {
    validated: { label: 'Verified', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    pending_validation: { label: 'Pending review', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' },
    pending_upload: { label: 'Awaiting docs', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
    failed: { label: 'Failed', className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
    unknown: { label: 'Unknown', className: 'bg-muted text-muted-foreground' },
  };
  const cfg = configs[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function EtaChip({ days }: { days: number | null }) {
  if (days === null)
    return <span className="text-xs text-muted-foreground">No ETA</span>;
  if (days <= 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
        <Clock className="size-3" />
        Overdue
      </span>
    );
  if (days === 1)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <Clock className="size-3" />
        Tomorrow
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="size-3" />
      {days}d
    </span>
  );
}

function MiniProgressBar({ value }: { value: number }) {
  const color =
    value === 100
      ? 'bg-emerald-500'
      : value > 60
        ? 'bg-sky-500'
        : 'bg-amber-400';
  return (
    <div className="h-1 rounded-full bg-muted overflow-hidden w-16">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export function ManagerTable({ rows }: { rows: ManagerContainer[] }) {
  const [selected, setSelected] = useState<ManagerContainer | null>(null);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
        <Package className="size-8 opacity-30" />
        <p className="text-sm">No containers in this stage.</p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {rows.map((r) => {
          const progress = milestoneProgress(r.latest_event_type);
          return (
            <button
              key={r.cargo_id}
              type="button"
              onClick={() => setSelected(r)}
              className="relative w-full text-left px-5 py-4 hover:bg-muted/30 transition-colors group"
            >
              <PriorityBar priority={r.priority_level} />
              <div className="pl-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start">
                {/* Left: Container + client */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold tracking-tight">
                      {r.cargo_id}
                    </span>
                    <VerifBadge status={r.verification_status} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="font-medium text-foreground/70">{r.client_name}</span>
                    {r.bill_of_lading && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="font-mono opacity-70">{r.bill_of_lading}</span>
                      </>
                    )}
                    {r.category && (
                      <>
                        <span className="opacity-40">·</span>
                        <span>{r.category}</span>
                      </>
                    )}
                  </div>
                  {/* Route line (mobile only shows inline) */}
                  {(r.origin || r.destination) && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                      <span>{r.origin ?? '?'}</span>
                      <ArrowRight className="size-3 shrink-0" />
                      <span>{r.destination ?? '?'}</span>
                    </div>
                  )}
                </div>

                {/* Center: milestone + action */}
                <div className="min-w-0 hidden sm:block">
                  <div className="text-xs font-medium text-foreground/80 mb-1.5">
                    {eventTypeLabel(r.latest_event_type)}
                  </div>
                  <MiniProgressBar value={progress} />
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    {formatRelativeTime(r.latest_event_time)}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs font-semibold" style={{ color: r.priority_level === 'red' ? 'rgb(220,38,38)' : r.priority_level === 'yellow' ? 'rgb(180,83,9)' : 'rgb(22,163,74)' }}>
                    <TrendingUp className="size-3" />
                    {r.recommended_action}
                  </div>
                </div>

                {/* Right: ETA + chevron */}
                <div className="flex flex-col items-end gap-2 shrink-0 self-center">
                  <EtaChip days={r.days_to_release} />
                  <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                </div>
              </div>

              {/* Mobile-only: milestone row */}
              <div className="sm:hidden pl-2 mt-2 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/70">{eventTypeLabel(r.latest_event_type)}</span>
                  <span className="opacity-50 mx-1">·</span>
                  <span>{formatRelativeTime(r.latest_event_time)}</span>
                </div>
                <div className="text-xs font-semibold" style={{ color: r.priority_level === 'red' ? 'rgb(220,38,38)' : r.priority_level === 'yellow' ? 'rgb(180,83,9)' : 'rgb(22,163,74)' }}>
                  {r.recommended_action}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <ContainerDetailDrawer
        container={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
