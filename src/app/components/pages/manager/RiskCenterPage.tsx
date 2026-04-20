import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  Package,
  ShieldAlert,
  ArrowRight,
  XCircle,
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

export function RiskCenterPage() {
  const { loading, error, rows } = useManagerData();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ManagerContainer | null>(null);

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
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [riskItems]);

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
        <button
          type="button"
          onClick={() => navigate('/pipeline')}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          Full pipeline <ArrowRight className="size-3" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-card border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : riskItems.length === 0 ? (
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
            return (
              <div key={cat} className={`border rounded-xl overflow-hidden ${meta.border}`}>
                <div className={`px-5 py-3.5 border-b ${meta.bg} ${meta.border} flex items-center gap-2`}>
                  <span className={meta.textColor}>{meta.icon}</span>
                  <span className={`text-sm font-semibold ${meta.textColor}`}>{meta.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ml-auto ${meta.bg} ${meta.textColor}`}>
                    {items.length}
                  </span>
                </div>
                <div className="divide-y bg-card" style={{ borderColor: 'var(--border)' }}>
                  {items.map((item) => (
                    <button
                      key={item.cargo_id}
                      type="button"
                      onClick={() => setSelected(item.container)}
                      className="w-full text-left px-5 py-3.5 hover:bg-muted/30 transition-colors group flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <Package className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold">{item.cargo_id}</span>
                          <span className="text-xs text-muted-foreground">{item.client_name}</span>
                          {item.bill_of_lading && (
                            <span className="font-mono text-xs text-muted-foreground/60">{item.bill_of_lading}</span>
                          )}
                        </div>
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
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
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
