import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, RefreshCw, Search, X } from 'lucide-react';
import { getBillingCycles, getManagerReceivables, type BillingCycleRow, type ManagerReceivableRow } from '@/app/api/ops';

function money(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

function riskBadge(level: string) {
  const v = (level || '').toUpperCase();
  if (v === 'HIGH') return { label: 'HIGH', className: 'bg-red-500/15 text-red-700 dark:text-red-400' };
  if (v === 'MEDIUM') return { label: 'MEDIUM', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
  return { label: 'LOW', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function BillingCycleChip({ cycle }: { cycle: BillingCycleRow }) {
  const days = daysUntil(cycle.next_billing_date);
  const overdue = days < 0;
  const soon = days <= 3;

  return (
    <div
      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border"
      style={{
        borderColor: overdue ? 'var(--destructive)' : soon ? '#f59e0b' : 'var(--border)',
        backgroundColor: overdue
          ? 'color-mix(in srgb, var(--destructive) 8%, transparent)'
          : soon
            ? 'color-mix(in srgb, #f59e0b 8%, transparent)'
            : 'var(--muted)',
        color: overdue ? 'var(--destructive)' : soon ? '#92400e' : undefined,
      }}
    >
      <CalendarClock className="size-3 shrink-0" />
      <span className="font-medium">{cycle.next_billing_date}</span>
      <span className="opacity-60">·</span>
      <span className="opacity-70">{money(cycle.price_per_dmc)} RWF/DMC</span>
      {overdue && <span className="font-bold text-xs">(OVERDUE)</span>}
      {!overdue && days <= 7 && <span className="opacity-70">{days}d left</span>}
    </div>
  );
}

export function ReceivablesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ManagerReceivableRow[]>([]);
  const [cycles, setCycles] = useState<BillingCycleRow[]>([]);
  const [search, setSearch] = useState('');

  function reload() {
    setLoading(true);
    setError(null);
    Promise.all([getManagerReceivables(), getBillingCycles()])
      .then(([recv, cyc]) => {
        setRows(recv.rows ?? []);
        setCycles(cyc.cycles ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, []);

  // Index active (pending) cycles by client_id
  const activeCycleByClient = useMemo(() => {
    const map = new Map<string, BillingCycleRow>();
    for (const c of cycles) {
      if (c.status === 'pending') map.set(c.client_id, c);
    }
    return map;
  }, [cycles]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => r.client_name.toLowerCase().includes(q));
  }, [rows, search]);

  const totals = useMemo(() => {
    const totalRevenue = filtered.reduce((a, r) => a + (Number(r.total_revenue) || 0), 0);
    const paid = filtered.reduce((a, r) => a + (Number(r.paid) || 0), 0);
    const outstanding = filtered.reduce((a, r) => a + (Number(r.outstanding) || 0), 0);
    return { totalRevenue, paid, outstanding };
  }, [filtered]);

  const pendingCyclesCount = useMemo(
    () => cycles.filter((c) => c.status === 'pending').length,
    [cycles],
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Receivables</h1>
          <p className="text-sm text-muted-foreground mt-1">Daily control — who owes you, how much, next billing date</p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="shrink-0 p-2 rounded-lg border hover:bg-muted transition-colors disabled:opacity-40"
          style={{ borderColor: 'var(--border)' }}
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border rounded-xl px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs text-muted-foreground">Total revenue</div>
          <div className="text-xl font-bold tabular-nums">{money(totals.totalRevenue)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">RWF</div>
        </div>
        <div className="bg-card border rounded-xl px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs text-muted-foreground">Paid</div>
          <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{money(totals.paid)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">RWF</div>
        </div>
        <div className="bg-card border border-red-500/20 rounded-xl px-4 py-3">
          <div className="text-xs text-muted-foreground">Outstanding</div>
          <div className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{money(totals.outstanding)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">RWF</div>
        </div>
        <div
          className="bg-card border rounded-xl px-4 py-3"
          style={{ borderColor: pendingCyclesCount > 0 ? '#f59e0b' : 'var(--border)' }}
        >
          <div className="text-xs text-muted-foreground">Active billing cycles</div>
          <div className={`text-xl font-bold tabular-nums ${pendingCyclesCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
            {pendingCyclesCount}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">pending</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search client…"
          className="w-full pl-9 pr-9 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          style={{ borderColor: 'var(--border)' }}
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 bg-card border rounded-xl animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs text-muted-foreground"
                  style={{ backgroundColor: 'var(--muted)' }}
                >
                  <th className="px-5 py-3 font-semibold">Client</th>
                  <th className="px-5 py-3 font-semibold text-right">Total Revenue</th>
                  <th className="px-5 py-3 font-semibold text-right">Paid</th>
                  <th className="px-5 py-3 font-semibold text-right">Outstanding</th>
                  <th className="px-5 py-3 font-semibold">Oldest Invoice</th>
                  <th className="px-5 py-3 font-semibold">Next Billing Cycle</th>
                  <th className="px-5 py-3 font-semibold">Risk</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const badge = riskBadge(r.risk_level);
                  const cycle = activeCycleByClient.get(r.client_id);
                  return (
                    <tr
                      key={r.client_id}
                      className="border-t hover:bg-muted/40 transition-colors"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <td className="px-5 py-3">
                        <span className="font-medium">{r.client_name}</span>
                      </td>
                      <td className="px-5 py-3 tabular-nums text-right">{money(Number(r.total_revenue || 0))}</td>
                      <td className="px-5 py-3 tabular-nums text-right text-emerald-600 dark:text-emerald-400">
                        {money(Number(r.paid || 0))}
                      </td>
                      <td className="px-5 py-3 tabular-nums font-semibold text-right text-red-600 dark:text-red-400">
                        {money(Number(r.outstanding || 0))}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{r.oldest_due_date ?? '—'}</td>
                      <td className="px-5 py-3">
                        {cycle ? (
                          <BillingCycleChip cycle={cycle} />
                        ) : (
                          <span className="text-xs text-muted-foreground">No active cycle</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${badge.className}`}>
                          {badge.label}
                          {badge.label !== 'LOW' && <AlertTriangle className="size-3" />}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
