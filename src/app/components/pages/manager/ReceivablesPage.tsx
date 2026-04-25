import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Search, X } from 'lucide-react';
import { getManagerReceivables, type ManagerReceivableRow } from '@/app/api/ops';

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

export function ReceivablesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ManagerReceivableRow[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getManagerReceivables()
      .then((r) => { if (!cancelled) setRows(r.rows ?? []); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Receivables</h1>
        <p className="text-sm text-muted-foreground mt-1">Daily control dashboard (who owes you, how much, how risky)</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-card border rounded-xl px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs text-muted-foreground">Total revenue</div>
          <div className="text-xl font-bold tabular-nums">{money(totals.totalRevenue)}</div>
        </div>
        <div className="bg-card border rounded-xl px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs text-muted-foreground">Paid</div>
          <div className="text-xl font-bold tabular-nums">{money(totals.paid)}</div>
        </div>
        <div className="bg-card border border-red-500/20 rounded-xl px-4 py-3">
          <div className="text-xs text-muted-foreground">Outstanding</div>
          <div className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{money(totals.outstanding)}</div>
        </div>
      </div>

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

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 bg-card border rounded-xl animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Total revenue</th>
                  <th className="px-5 py-3">Paid</th>
                  <th className="px-5 py-3">Outstanding</th>
                  <th className="px-5 py-3">Oldest invoice</th>
                  <th className="px-5 py-3">Risk</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const badge = riskBadge(r.risk_level);
                  return (
                    <tr key={r.client_id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-5 py-3 font-medium">{r.client_name}</td>
                      <td className="px-5 py-3 tabular-nums">{money(Number(r.total_revenue || 0))}</td>
                      <td className="px-5 py-3 tabular-nums">{money(Number(r.paid || 0))}</td>
                      <td className="px-5 py-3 tabular-nums font-semibold text-red-600 dark:text-red-400">
                        {money(Number(r.outstanding || 0))}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {r.oldest_due_date ?? '—'}
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

