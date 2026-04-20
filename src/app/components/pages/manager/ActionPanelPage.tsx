import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Package,
  PackageCheck,
  ShieldAlert,
  Truck,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { useManagerData } from './data';
import { eventTypeLabel, formatRelativeTime } from './data';
import { Button } from '@/app/components/ui/button';

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  onClick,
  actionLabel,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  accent: 'red' | 'amber' | 'blue' | 'green';
  onClick?: () => void;
  actionLabel?: string;
  disabled?: boolean;
}) {
  const accentMap = {
    red: {
      border: 'border-red-500/30',
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-500',
      actionClass: 'bg-red-500 hover:bg-red-600 text-white',
      valueColor: 'text-red-600 dark:text-red-400',
    },
    amber: {
      border: 'border-amber-500/30',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
      actionClass: 'bg-amber-500 hover:bg-amber-600 text-white',
      valueColor: 'text-amber-600 dark:text-amber-400',
    },
    blue: {
      border: 'border-sky-500/30',
      iconBg: 'bg-sky-500/10',
      iconColor: 'text-sky-500',
      actionClass: 'bg-sky-500 hover:bg-sky-600 text-white',
      valueColor: 'text-sky-600 dark:text-sky-400',
    },
    green: {
      border: 'border-emerald-500/30',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
      actionClass: 'bg-emerald-500 hover:bg-emerald-600 text-white',
      valueColor: 'text-emerald-600 dark:text-emerald-400',
    },
  };
  const colors = accentMap[accent];

  return (
    <div
      className={`bg-card border rounded-xl p-5 flex flex-col gap-4 ${colors.border}`}
      style={{ borderColor: undefined }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.iconBg}`}>
          <span className={colors.iconColor}>{icon}</span>
        </div>
        <div className={`text-3xl font-bold tabular-nums ${colors.valueColor}`}>
          {value}
        </div>
      </div>
      <div>
        <div className="font-semibold text-sm">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      {actionLabel && onClick && (
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${colors.actionClass}`}
        >
          {actionLabel}
          <ArrowRight className="size-3" />
        </button>
      )}
    </div>
  );
}

export function ActionPanelPage() {
  const { loading, error, rows } = useManagerData();
  const navigate = useNavigate();

  const released = useMemo(() => rows.filter((r) => r.pipeline_state === 'ready_dispatch'), [rows]);
  const releasingTomorrow = useMemo(() => rows.filter((r) => r.days_to_release === 1), [rows]);
  const releasingSoon = useMemo(() => rows.filter((r) => r.pipeline_state === 'releasing_soon'), [rows]);
  const delayedVerification = useMemo(() => rows.filter((r) => r.verification_status === 'failed'), [rows]);
  const inTransit = useMemo(() => rows.filter((r) => r.pipeline_state === 'in_transit'), [rows]);
  const totalActive = rows.length;

  // Recent activity feed: containers with latest events, sorted by time
  const recentActivity = useMemo(() => {
    return [...rows]
      .filter((r) => r.latest_event_time)
      .sort((a, b) => Date.parse(b.latest_event_time!) - Date.parse(a.latest_event_time!))
      .slice(0, 6);
  }, [rows]);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Operations Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">{today}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/pipeline')} className="shrink-0">
          <TrendingUp className="size-4" />
          Full pipeline
        </Button>
      </div>

      {/* Alert banner */}
      {!loading && !error && released.length > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-3.5"
          role="alert"
        >
          <AlertTriangle className="size-5 text-red-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-red-700 dark:text-red-400">
              {released.length} container{released.length > 1 ? 's' : ''} ready to dispatch
            </span>
            <span className="text-sm text-muted-foreground ml-2">— assign trucks now to avoid delays.</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/pipeline?stage=ready_dispatch')}
            className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
          >
            View
          </button>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border rounded-xl p-5 h-36 animate-pulse" />
          ))
        ) : error ? (
          <div className="col-span-4 text-sm text-destructive">{error}</div>
        ) : (
          <>
            <StatCard
              icon={<Truck className="size-5" />}
              label="Ready to dispatch"
              value={released.length}
              sub="Awaiting truck assignment"
              accent="red"
              actionLabel="Assign trucks"
              onClick={() => navigate('/pipeline?stage=ready_dispatch')}
              disabled={released.length === 0}
            />
            <StatCard
              icon={<PackageCheck className="size-5" />}
              label="Releasing tomorrow"
              value={releasingTomorrow.length}
              sub="Pre-assign now to avoid gaps"
              accent="amber"
              actionLabel="Pre-assign"
              onClick={() => navigate('/pipeline?stage=releasing_soon')}
              disabled={releasingTomorrow.length === 0}
            />
            <StatCard
              icon={<Activity className="size-5" />}
              label="In transit"
              value={inTransit.length}
              sub="Containers en route"
              accent="blue"
              actionLabel="Monitor"
              onClick={() => navigate('/monitoring')}
              disabled={inTransit.length === 0}
            />
            <StatCard
              icon={<ShieldAlert className="size-5" />}
              label="Validation issues"
              value={delayedVerification.length}
              sub="Failed or blocked documents"
              accent="green"
              actionLabel="Review"
              onClick={() => navigate('/risk-center')}
              disabled={delayedVerification.length === 0}
            />
          </>
        )}
      </div>

      {/* Summary row */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[
            { label: 'Total active', value: totalActive },
            { label: 'Ready dispatch', value: released.length },
            { label: 'Releasing ≤2d', value: releasingSoon.length },
            { label: 'In transit', value: inTransit.length },
            { label: 'Awaiting docs', value: rows.filter((r) => r.verification_status === 'pending_upload').length },
            { label: 'Validated', value: rows.filter((r) => r.verification_status === 'validated').length },
          ].map(({ label, value }) => (
            <div key={label} className="bg-muted/40 rounded-lg px-3 py-2.5 text-center">
              <div className="text-lg font-bold tabular-nums">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recent activity */}
      {!loading && !error && recentActivity.length > 0 && (
        <div className="bg-card border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Recent activity</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/monitoring')}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="size-3" />
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {recentActivity.map((r) => (
              <div key={r.cargo_id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Package className="size-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold">{r.cargo_id}</span>
                    <span className="text-xs text-muted-foreground">{r.client_name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-sky-500" />
                    {eventTypeLabel(r.latest_event_type)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {formatRelativeTime(r.latest_event_time)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
