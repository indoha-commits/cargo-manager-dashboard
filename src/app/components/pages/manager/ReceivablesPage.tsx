import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import {
  createManagerPayment,
  getBillingCycles,
  getManagerReceivables,
  getManagerShipments,
  type BillingCycleRow,
  type ManagerReceivableRow,
  type ManagerShipmentsRow,
} from '@/app/api/ops';

/* ── helpers ── */
function money(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

function riskBadge(level: string) {
  const v = (level || '').toUpperCase();
  if (v === 'HIGH') return { label: 'HIGH', cls: 'bg-red-500/15 text-red-700 dark:text-red-400' };
  if (v === 'MEDIUM') return { label: 'MEDIUM', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
  return { label: 'LOW', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr).getTime() - today.getTime()) / 86_400_000);
}

const METHOD_OPTIONS = ['bank', 'cash', 'momo', 'mpesa', 'cheque', 'other'] as const;

/* ─────────────────────────────────────────────────────────────────────
   Mark as Paid dialog
───────────────────────────────────────────────────────────────────── */
function MarkPaidDialog({
  shipment,
  onClose,
  onPaid,
}: {
  shipment: ManagerShipmentsRow;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [amount, setAmount] = useState(String(Math.round(shipment.outstanding_amount)));
  const [method, setMethod] = useState<string>('bank');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    setSaving(true);
    setError(null);
    try {
      await createManagerPayment({
        client_id: shipment.client_id,
        cargo_group_id: shipment.shipment_id,
        shipment_ref: shipment.shipment_ref,
        dmc: shipment.dmc ?? undefined,
        line_items: [{
          description: `Payment for shipment ${shipment.shipment_ref ?? shipment.shipment_id}`,
          unit: 'shipment',
          quantity: 1,
          unit_price: amt,
          total_price: amt,
        }],
        amount: amt,
        currency: 'RWF',
        paid_at: date,
        method,
      });
      setDone(true);
      setTimeout(() => { onPaid(); onClose(); }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-2xl shadow-2xl p-6"
        style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
      >
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-10 text-green-500" />
            <p className="font-semibold">Payment recorded!</p>
            <p className="text-xs text-muted-foreground">{shipment.client_name} — {money(Number(amount))} RWF</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">Mark as Paid</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {shipment.client_name} · {shipment.shipment_ref ?? shipment.shipment_id.slice(0, 8)}
                </p>
              </div>
              <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>

            {/* Outstanding indicator */}
            <div
              className="flex items-center justify-between text-xs px-3 py-2 rounded-lg"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <span className="text-muted-foreground">Outstanding</span>
              <span className="font-bold text-red-600 dark:text-red-400">
                {money(shipment.outstanding_amount)} RWF
              </span>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
                Amount received (RWF) *
              </label>
              <input
                ref={inputRef}
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={1}
                required
                className="w-full rounded-lg border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>

            {/* Date + Method row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
                >
                  {METHOD_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border px-3 py-2.5 text-sm hover:bg-muted transition-colors"
                style={{ borderColor: 'var(--border)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-foreground text-background px-3 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving
                  ? <><Loader2 className="size-4 animate-spin" /> Saving…</>
                  : <><CheckCircle2 className="size-4" /> Confirm</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Billing cycle chip
───────────────────────────────────────────────────────────────────── */
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
          : soon ? 'color-mix(in srgb, #f59e0b 8%, transparent)' : 'var(--muted)',
        color: overdue ? 'var(--destructive)' : soon ? '#92400e' : undefined,
      }}
    >
      <CalendarClock className="size-3 shrink-0" />
      <span className="font-medium">{cycle.next_billing_date}</span>
      <span className="opacity-60">·</span>
      <span className="opacity-70">{money(cycle.price_per_dmc)} RWF/DMC</span>
      {overdue && <span className="font-bold">(OVERDUE)</span>}
      {!overdue && days <= 7 && <span className="opacity-70">{days}d left</span>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Main ReceivablesPage
───────────────────────────────────────────────────────────────────── */
export function ReceivablesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<ManagerReceivableRow[]>([]);
  const [shipments, setShipments] = useState<ManagerShipmentsRow[]>([]);
  const [cycles, setCycles] = useState<BillingCycleRow[]>([]);

  const [search, setSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [markingShipment, setMarkingShipment] = useState<ManagerShipmentsRow | null>(null);

  function reload() {
    setLoading(true);
    setError(null);
    Promise.all([getManagerReceivables(), getManagerShipments(), getBillingCycles()])
      .then(([recv, ship, cyc]) => {
        setRows(recv.rows ?? []);
        setShipments(ship.rows ?? []);
        setCycles(cyc.cycles ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, []);

  // Active billing cycles indexed by client_id
  const activeCycleByClient = useMemo(() => {
    const map = new Map<string, BillingCycleRow>();
    for (const c of cycles) { if (c.status === 'pending') map.set(c.client_id, c); }
    return map;
  }, [cycles]);

  // Pending shipments = outstanding_amount > 0
  const pendingShipments = useMemo(() => {
    const base = shipments.filter((s) => Number(s.outstanding_amount) > 0);
    if (!pendingSearch.trim()) return base;
    const q = pendingSearch.trim().toLowerCase();
    return base.filter((s) =>
      s.client_name.toLowerCase().includes(q) ||
      (s.shipment_ref ?? '').toLowerCase().includes(q) ||
      (s.dmc ?? '').toLowerCase().includes(q),
    );
  }, [shipments, pendingSearch]);

  const totalPendingOutstanding = useMemo(
    () => pendingShipments.reduce((a, s) => a + (Number(s.outstanding_amount) || 0), 0),
    [pendingShipments],
  );

  // Client summary table
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => r.client_name.toLowerCase().includes(q));
  }, [rows, search]);

  const totals = useMemo(() => ({
    totalRevenue: filteredRows.reduce((a, r) => a + (Number(r.total_revenue) || 0), 0),
    paid: filteredRows.reduce((a, r) => a + (Number(r.paid) || 0), 0),
    outstanding: filteredRows.reduce((a, r) => a + (Number(r.outstanding) || 0), 0),
  }), [filteredRows]);

  const pendingCyclesCount = useMemo(() => cycles.filter((c) => c.status === 'pending').length, [cycles]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Receivables</h1>
          <p className="text-sm text-muted-foreground mt-1">Daily control — who owes you, how much, next billing</p>
        </div>
        <button
          type="button" onClick={reload} disabled={loading}
          className="shrink-0 p-2 rounded-lg border hover:bg-muted transition-colors disabled:opacity-40"
          style={{ borderColor: 'var(--border)' }}
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── KPI bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total revenue', value: totals.totalRevenue, cls: '' },
          { label: 'Paid', value: totals.paid, cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Outstanding', value: totals.outstanding, cls: 'text-red-600 dark:text-red-400', border: 'border-red-500/20' },
          { label: 'Active billing cycles', value: pendingCyclesCount, cls: pendingCyclesCount > 0 ? 'text-amber-600 dark:text-amber-400' : '', isCycles: true, border: pendingCyclesCount > 0 ? 'border-amber-400/40' : '' },
        ].map((k) => (
          <div key={k.label} className={`bg-card border rounded-xl px-4 py-3 ${k.border ?? ''}`} style={{ borderColor: k.border ? undefined : 'var(--border)' }}>
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className={`text-xl font-bold tabular-nums ${k.cls}`}>{money(k.value)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.isCycles ? 'pending' : 'RWF'}</div>
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════
          SECTION 1 — Pending shipments (manual mark-as-paid)
      ════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-4">
          <div>
            <h2 className="text-base font-bold">Pending Payments</h2>
            <p className="text-xs text-muted-foreground">
              {pendingShipments.length} shipment{pendingShipments.length !== 1 ? 's' : ''} with outstanding balance · {money(totalPendingOutstanding)} RWF total
            </p>
          </div>
          {/* pending search */}
          <div className="relative w-56 shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              placeholder="Search…"
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              style={{ borderColor: 'var(--border)' }}
            />
            {pendingSearch && (
              <button type="button" onClick={() => setPendingSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-card border rounded-xl animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : pendingShipments.length === 0 ? (
          <div
            className="flex items-center gap-3 px-5 py-4 rounded-xl border"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
          >
            <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
            <p className="text-sm text-muted-foreground">No outstanding balances — all shipments are settled.</p>
          </div>
        ) : (
          <div className="bg-card border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground" style={{ backgroundColor: 'var(--muted)' }}>
                    <th className="px-5 py-2.5 font-semibold">Client</th>
                    <th className="px-5 py-2.5 font-semibold">Shipment ref</th>
                    <th className="px-5 py-2.5 font-semibold">DMC</th>
                    <th className="px-5 py-2.5 font-semibold">Due date</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Revenue</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Paid</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Outstanding</th>
                    <th className="px-5 py-2.5 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingShipments.map((s) => {
                    const overdue = s.due_payment_date && new Date(s.due_payment_date) < new Date();
                    return (
                      <tr
                        key={s.shipment_id}
                        className="border-t hover:bg-muted/40 transition-colors"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <td className="px-5 py-3 font-medium">{s.client_name}</td>
                        <td className="px-5 py-3 font-mono text-xs">{s.shipment_ref ?? '—'}</td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">{s.dmc ?? '—'}</td>
                        <td className="px-5 py-3 text-xs">
                          {s.due_payment_date
                            ? <span className={overdue ? 'font-semibold text-red-600 dark:text-red-400' : ''}>{s.due_payment_date}{overdue ? ' ⚠' : ''}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-5 py-3 tabular-nums text-right">{money(Number(s.revenue || 0))}</td>
                        <td className="px-5 py-3 tabular-nums text-right text-emerald-600 dark:text-emerald-400">{money(Number(s.paid_amount || 0))}</td>
                        <td className="px-5 py-3 tabular-nums font-bold text-right text-red-600 dark:text-red-400">
                          {money(Number(s.outstanding_amount || 0))}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setMarkingShipment(s)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                          >
                            <CheckCircle2 className="size-3.5" /> Mark Paid
                          </button>
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

      {/* ════════════════════════════════════════════════════════
          SECTION 2 — Client summary table
      ════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-4">
          <h2 className="text-base font-bold">By Client</h2>
          <div className="relative w-56 shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client…"
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              style={{ borderColor: 'var(--border)' }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-card border rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="bg-card border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground" style={{ backgroundColor: 'var(--muted)' }}>
                    <th className="px-5 py-2.5 font-semibold">Client</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Total Revenue</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Paid</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Outstanding</th>
                    <th className="px-5 py-2.5 font-semibold">Oldest Invoice</th>
                    <th className="px-5 py-2.5 font-semibold">Next Billing Cycle</th>
                    <th className="px-5 py-2.5 font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const badge = riskBadge(r.risk_level);
                    const cycle = activeCycleByClient.get(r.client_id);
                    return (
                      <tr key={r.client_id} className="border-t hover:bg-muted/40 transition-colors" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-5 py-3 font-medium">{r.client_name}</td>
                        <td className="px-5 py-3 tabular-nums text-right">{money(Number(r.total_revenue || 0))}</td>
                        <td className="px-5 py-3 tabular-nums text-right text-emerald-600 dark:text-emerald-400">{money(Number(r.paid || 0))}</td>
                        <td className="px-5 py-3 tabular-nums font-semibold text-right text-red-600 dark:text-red-400">{money(Number(r.outstanding || 0))}</td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">{r.oldest_due_date ?? '—'}</td>
                        <td className="px-5 py-3">
                          {cycle
                            ? <BillingCycleChip cycle={cycle} />
                            : <span className="text-xs text-muted-foreground">No active cycle</span>}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${badge.cls}`}>
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

      {/* ── Mark as Paid dialog ── */}
      {markingShipment && (
        <MarkPaidDialog
          shipment={markingShipment}
          onClose={() => setMarkingShipment(null)}
          onPaid={() => { setMarkingShipment(null); reload(); }}
        />
      )}
    </div>
  );
}
