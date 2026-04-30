import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Calendar, CheckCircle2, DollarSign, Search, X } from 'lucide-react';
import { getManagerShipments, type ManagerShipmentsRow } from '@/app/api/ops';
import { ContainerDetailDrawer } from './ContainerDetailDrawer';
import type { ManagerContainer } from './data';
import { Button } from '@/app/components/ui/button';

function money(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

/** Render a cell value: zero → dimmed dash, positive → formatted number */
function cellMoney(raw: number | null | undefined) {
  const v = Number(raw ?? 0);
  if (!v) return <span className="text-muted-foreground/50">—</span>;
  return <span>{money(v)}</span>;
}

function riskChip(outstanding: number, due: string | null) {
  if (outstanding <= 0) return { label: 'Paid', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
  if (!due) return { label: 'Outstanding', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
  const days = Math.floor((Date.now() - Date.parse(due)) / (1000 * 60 * 60 * 24));
  if (days > 30) return { label: `Overdue ${days}d`, className: 'bg-red-500/15 text-red-700 dark:text-red-400' };
  if (days > 7) return { label: `Due ${days}d`, className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
  return { label: 'Due soon', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' };
}

export function ShipmentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ManagerShipmentsRow[]>([]);
  const [search, setSearch] = useState('');

  // Reuse existing container drawer for “details per container” from shipment rows
  // (we’ll open the first container via the pipeline dataset later; for now drawer needs a ManagerContainer)
  const [selectedContainer, setSelectedContainer] = useState<ManagerContainer | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getManagerShipments()
      .then((r) => { if (!cancelled) setRows(r.rows ?? []); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      r.shipment_ref.toLowerCase().includes(q) ||
      r.client_name.toLowerCase().includes(q) ||
      (r.dmc ?? '').toLowerCase().includes(q) ||
      String(r.status ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    const revenue = filtered.reduce((a, r) => a + (Number(r.revenue) || 0), 0);
    const cost = filtered.reduce((a, r) => a + (Number(r.cost) || 0), 0);
    const profit = revenue - cost;
    const outstanding = filtered.reduce((a, r) => a + (Number(r.outstanding_amount) || 0), 0);
    return { revenue, cost, profit, outstanding };
  }, [filtered]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Shipments</h1>
          <p className="text-sm text-muted-foreground mt-1">1 row = 1 shipment (BoL). Not grouped by client.</p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0">
          <Calendar className="size-4" />
          Export
        </Button>
      </div>

      {/* ── Summary cards ── */}
      {totals.revenue === 0 && totals.cost === 0 && totals.outstanding === 0 ? (
        /* Empty financial state */
        <div className="bg-card border rounded-xl px-6 py-5 flex items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-sm font-medium text-muted-foreground">No financials recorded yet</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Add revenue, cost and due dates when registering or editing each shipment.
            </p>
          </div>
          <DollarSign className="size-8 text-muted-foreground/20 shrink-0" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Revenue */}
          <div className="bg-card border rounded-xl px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs text-muted-foreground mb-1">Revenue</div>
            {totals.revenue === 0
              ? <div className="text-xl font-bold text-muted-foreground/40">—</div>
              : <div className="text-xl font-bold tabular-nums">{money(totals.revenue)}</div>
            }
          </div>
          {/* Cost */}
          <div className="bg-card border rounded-xl px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs text-muted-foreground mb-1">Cost</div>
            {totals.cost === 0
              ? <div className="text-xl font-bold text-muted-foreground/40">—</div>
              : <div className="text-xl font-bold tabular-nums">{money(totals.cost)}</div>
            }
          </div>
          {/* Profit */}
          <div className="bg-card border rounded-xl px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs text-muted-foreground mb-1">Profit</div>
            {totals.profit === 0
              ? <div className="text-xl font-bold text-muted-foreground/40">—</div>
              : (
                <div className={`text-xl font-bold tabular-nums ${totals.profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {money(totals.profit)}
                </div>
              )
            }
          </div>
          {/* Outstanding */}
          <div className="bg-card border rounded-xl px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs text-muted-foreground mb-1">Outstanding</div>
            {totals.outstanding === 0
              ? (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">Settled</div>
                </div>
              )
              : <div className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{money(totals.outstanding)}</div>
            }
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shipment (BoL), client, DMC, status…"
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
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-card border rounded-xl animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {filtered.length} shipment{filtered.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-muted-foreground">Click a row to open container details</span>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3">Shipment ID</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">DMC</th>
                  <th className="px-5 py-3">Scope</th>
                  <th className="px-5 py-3">Revenue</th>
                  <th className="px-5 py-3">Cost</th>
                  <th className="px-5 py-3">Profit</th>
                  <th className="px-5 py-3">Receivable</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const chip = riskChip(Number(r.outstanding_amount || 0), r.due_payment_date ?? null);
                  return (
                    <tr
                      key={r.shipment_id}
                      className="border-t hover:bg-muted/30 cursor-pointer"
                      style={{ borderColor: 'var(--border)' }}
                      onClick={() => setSelectedContainer(null)}
                    >
                      <td className="px-5 py-3 font-mono">{r.shipment_ref}</td>
                      <td className="px-5 py-3">{r.client_name}</td>
                      <td className="px-5 py-3">{r.dmc ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {r.service_scope === 'CLEARING_ONLY' ? 'Clearing only' : 'Logistics + Clearing'}
                        </span>
                      </td>
                      <td className="px-5 py-3 tabular-nums">{cellMoney(r.revenue)}</td>
                      <td className="px-5 py-3 tabular-nums">{cellMoney(r.cost)}</td>
                      <td className="px-5 py-3 tabular-nums font-semibold">{cellMoney(r.profit)}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${chip.className}`}>
                          {chip.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <DollarSign className="size-3" />
                          {String(r.status ?? 'open')}
                          <ArrowRight className="size-3 opacity-40 ml-1" />
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

      <ContainerDetailDrawer container={selectedContainer} open={!!selectedContainer} onClose={() => setSelectedContainer(null)} />
    </div>
  );
}

