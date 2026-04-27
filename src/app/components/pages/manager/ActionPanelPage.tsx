import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Package,
  Ship,
  PackageCheck,
  Truck,
  Activity,
  TrendingUp,
  Anchor,
  Container,
  MapPin,
} from 'lucide-react';
import { useManagerData, SUCOMO_STAGES, toSucomoStage, eventTypeLabel, formatRelativeTime } from './data';
import { Button } from '@/app/components/ui/button';

// ── SUCOMO milestone colours ───────────────────────────────────────────────────
const STAGE_COLORS: Record<string, { bar: string; badge: string; text: string; dot: string }> = {
  VESSEL_ARRIVAL_AWAITED: {
    bar:   'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    text:  'text-slate-600 dark:text-slate-400',
    dot:   'bg-slate-400',
  },
  AWAIT_DISCHARGE: {
    bar:   'bg-blue-400',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    text:  'text-blue-600 dark:text-blue-400',
    dot:   'bg-blue-400',
  },
  SCT_LOADING_AWAITED: {
    bar:   'bg-violet-400',
    badge: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    text:  'text-violet-600 dark:text-violet-400',
    dot:   'bg-violet-400',
  },
  UNDER_ICD_TRANSFER: {
    bar:   'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    text:  'text-amber-600 dark:text-amber-400',
    dot:   'bg-amber-400',
  },
  UNDER_PORT_CLEARANCE: {
    bar:   'bg-orange-400',
    badge: 'bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    text:  'text-orange-600 dark:text-orange-400',
    dot:   'bg-orange-400',
  },
  LOADED_ON_WAY: {
    bar:   'bg-sky-400',
    badge: 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    text:  'text-sky-600 dark:text-sky-400',
    dot:   'bg-sky-400',
  },
  ARRIVED_AT_CONSIGNEE: {
    bar:   'bg-emerald-400',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    text:  'text-emerald-600 dark:text-emerald-400',
    dot:   'bg-emerald-400',
  },
};

const STAGE_ICONS: Record<string, React.ReactNode> = {
  VESSEL_ARRIVAL_AWAITED: <Anchor className="size-3.5" />,
  AWAIT_DISCHARGE:        <Ship className="size-3.5" />,
  SCT_LOADING_AWAITED:    <Container className="size-3.5" />,
  UNDER_ICD_TRANSFER:     <Activity className="size-3.5" />,
  UNDER_PORT_CLEARANCE:   <PackageCheck className="size-3.5" />,
  LOADED_ON_WAY:          <Truck className="size-3.5" />,
  ARRIVED_AT_CONSIGNEE:   <MapPin className="size-3.5" />,
};

export function ActionPanelPage() {
  const { loading, error, rows } = useManagerData();
  const navigate = useNavigate();

  // Count containers per SUCOMO stage
  const sucomo = useMemo(() => {
    const counts = new Map<string, number>(SUCOMO_STAGES.map((s) => [s.id, 0]));
    for (const r of rows) {
      const stage = toSucomoStage(r.latest_event_type);
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }
    return SUCOMO_STAGES.map((s) => ({ ...s, count: counts.get(s.id) ?? 0 }));
  }, [rows]);

  const total = rows.length;
  const maxCount = useMemo(() => Math.max(...sucomo.map((s) => s.count), 1), [sucomo]);

  // KPI counts derived from SUCOMO stages
  const arrivedCount   = useMemo(() => sucomo.find((s) => s.id === 'ARRIVED_AT_CONSIGNEE')?.count ?? 0, [sucomo]);
  const loadedCount    = useMemo(() => sucomo.find((s) => s.id === 'LOADED_ON_WAY')?.count ?? 0, [sucomo]);
  const clearanceCount = useMemo(() => sucomo.find((s) => s.id === 'UNDER_PORT_CLEARANCE')?.count ?? 0, [sucomo]);
  const atSeaCount     = useMemo(() => (sucomo.find((s) => s.id === 'VESSEL_ARRIVAL_AWAITED')?.count ?? 0)
    + (sucomo.find((s) => s.id === 'AWAIT_DISCHARGE')?.count ?? 0), [sucomo]);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Recent activity feed
  const recentActivity = useMemo(() =>
    [...rows]
      .filter((r) => r.latest_event_time)
      .sort((a, b) => Date.parse(b.latest_event_time!) - Date.parse(a.latest_event_time!))
      .slice(0, 6),
    [rows]
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">

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

      {/* Alert banner — arrived containers need truck assignment */}
      {!loading && !error && arrivedCount > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-3.5"
          role="alert"
        >
          <AlertTriangle className="size-5 text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {arrivedCount} container{arrivedCount > 1 ? 's' : ''} arrived at consignee
            </span>
            <span className="text-sm text-muted-foreground ml-2">— confirm delivery and close file.</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/pipeline')}
            className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            View <ArrowRight className="size-3 inline" />
          </button>
        </div>
      )}

      {/* ── SUCOMO Panel ──────────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              <span className="text-sm font-bold tracking-wide uppercase text-foreground">
                SUCOMO — Summarized Container Movement
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Live stage distribution across all active containers</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-black tabular-nums leading-none">
              {loading ? '—' : total}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">total containers</div>
          </div>
        </div>

        {/* Stage rows */}
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {loading ? (
            Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                <div className="w-5 h-5 rounded bg-muted animate-pulse shrink-0" />
                <div className="flex-1 h-3 rounded bg-muted animate-pulse" />
                <div className="w-8 h-5 rounded bg-muted animate-pulse shrink-0" />
              </div>
            ))
          ) : error ? (
            <div className="px-5 py-6 text-sm text-destructive">{error}</div>
          ) : (
            // Rendered highest score first (score 7 → 1, matching the SUCOMO chart)
            [...sucomo].sort((a, b) => b.score - a.score).map((stage) => {
              const colors = STAGE_COLORS[stage.id];
              const pct = total === 0 ? 0 : Math.round((stage.count / total) * 100);
              const barWidth = total === 0 ? 0 : Math.round((stage.count / maxCount) * 100);

              return (
                <div
                  key={stage.id}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => navigate('/pipeline')}
                >
                  {/* Score badge */}
                  <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 text-[10px] font-black text-muted-foreground group-hover:bg-background transition-colors">
                    {stage.score}
                  </div>

                  {/* Icon */}
                  <div className={`shrink-0 ${colors.text}`}>
                    {STAGE_ICONS[stage.id]}
                  </div>

                  {/* Label + bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold truncate">{stage.label}</span>
                      <span className={`text-xs font-bold tabular-nums shrink-0 ${stage.count > 0 ? colors.text : 'text-muted-foreground'}`}>
                        {stage.count}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>

                  {/* % label */}
                  <div className="text-xs text-muted-foreground tabular-nums w-9 text-right shrink-0">
                    {pct}%
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: <MapPin className="size-5" />,
            label: 'Arrived at consignee',
            sub: 'Confirm delivery & close file',
            value: arrivedCount,
            accent: 'emerald' as const,
            action: 'Confirm deliveries',
            route: '/pipeline',
          },
          {
            icon: <Truck className="size-5" />,
            label: 'Loaded & on way',
            sub: 'Containers in final leg',
            value: loadedCount,
            accent: 'sky' as const,
            action: 'Monitor',
            route: '/monitoring',
          },
          {
            icon: <PackageCheck className="size-5" />,
            label: 'Under port clearance',
            sub: 'Customs & documentation',
            value: clearanceCount,
            accent: 'orange' as const,
            action: 'Check docs',
            route: '/risk-center',
          },
          {
            icon: <Ship className="size-5" />,
            label: 'At sea / awaiting',
            sub: 'Vessel arrival + discharge',
            value: atSeaCount,
            accent: 'slate' as const,
            action: 'View ETA',
            route: '/pipeline',
          },
        ].map(({ icon, label, sub, value, accent, action, route }) => {
          const colorMap = {
            emerald: { border: 'border-emerald-500/30', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500', val: 'text-emerald-600 dark:text-emerald-400', btn: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
            sky:     { border: 'border-sky-500/30',     iconBg: 'bg-sky-500/10',     iconColor: 'text-sky-500',     val: 'text-sky-600 dark:text-sky-400',         btn: 'bg-sky-500 hover:bg-sky-600 text-white' },
            orange:  { border: 'border-orange-500/30',  iconBg: 'bg-orange-500/10',  iconColor: 'text-orange-500',  val: 'text-orange-600 dark:text-orange-400',   btn: 'bg-orange-500 hover:bg-orange-600 text-white' },
            slate:   { border: 'border-slate-500/30',   iconBg: 'bg-slate-500/10',   iconColor: 'text-slate-500',   val: 'text-slate-600 dark:text-slate-400',     btn: 'bg-slate-500 hover:bg-slate-600 text-white' },
          };
          const c = colorMap[accent];
          return (
            <div key={label} className={`bg-card border rounded-xl p-5 flex flex-col gap-3 ${c.border}`}>
              <div className="flex items-start justify-between gap-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.iconBg}`}>
                  <span className={c.iconColor}>{icon}</span>
                </div>
                <div className={`text-3xl font-bold tabular-nums ${c.val}`}>{loading ? '—' : value}</div>
              </div>
              <div>
                <div className="font-semibold text-sm leading-snug">{label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
              </div>
              <button
                type="button"
                disabled={loading || value === 0}
                onClick={() => navigate(route)}
                className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${c.btn}`}
              >
                {action} <ArrowRight className="size-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Quick stats strip ──────────────────────────────────────────────────── */}
      {!loading && !error && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {sucomo.map((stage) => {
            const colors = STAGE_COLORS[stage.id];
            return (
              <div
                key={stage.id}
                className="bg-muted/40 rounded-lg px-2 py-2.5 text-center cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => navigate('/pipeline')}
                title={stage.label}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                  <div className="text-[10px] text-muted-foreground font-bold">{stage.score}</div>
                </div>
                <div className={`text-lg font-bold tabular-nums leading-none ${stage.count > 0 ? colors.text : 'text-muted-foreground/40'}`}>
                  {stage.count}
                </div>
                <div className="text-[9px] text-muted-foreground mt-1 leading-tight line-clamp-2">
                  {stage.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Recent activity ────────────────────────────────────────────────────── */}
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
            {recentActivity.map((r) => {
              const stage = toSucomoStage(r.latest_event_type);
              const colors = STAGE_COLORS[stage];
              return (
                <div key={r.cargo_id} className="px-5 py-3 flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${colors?.badge ?? 'bg-muted'}`}>
                    {STAGE_ICONS[stage] ?? <Package className="size-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold">{r.cargo_id}</span>
                      <span className="text-xs text-muted-foreground">{r.client_name}</span>
                    </div>
                    <div className={`text-xs mt-0.5 flex items-center gap-1 ${colors?.text ?? 'text-muted-foreground'}`}>
                      <CheckCircle2 className="size-3" />
                      {eventTypeLabel(r.latest_event_type)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeTime(r.latest_event_time)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
