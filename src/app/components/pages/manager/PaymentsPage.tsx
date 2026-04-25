import { useEffect, useMemo, useState } from 'react';
import { Search, X, CreditCard } from 'lucide-react';
import { getManagerPayments, type ManagerPaymentRow } from '@/app/api/ops';

function money(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

export function PaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ManagerPaymentRow[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getManagerPayments()
      .then((r) => { if (!cancelled) setRows(r.rows ?? []); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (r.client_name ?? '').toLowerCase().includes(q) ||
      (r.shipment_ref ?? '').toLowerCase().includes(q) ||
      (r.method ?? '').toLowerCase().includes(q) ||
      (r.reference ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const total = useMemo(() => filtered.reduce((a, r) => a + (Number(r.amount) || 0), 0), [filtered]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-sm text-muted-foreground mt-1">Money → shipment → client (cash control ledger)</p>
      </div>

      <div className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <CreditCard className="size-4" />
          Total (filtered)
        </div>
        <div className="text-xl font-bold tabular-nums">{money(total)}</div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by client, shipment ref, method, reference…"
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
                  <th className="px-5 py-3">Payment ID</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Shipment</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Reference</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-5 py-3 font-mono text-xs opacity-70">{r.id.slice(0, 8)}…</td>
                    <td className="px-5 py-3">{r.client_name}</td>
                    <td className="px-5 py-3 font-mono">{r.shipment_ref ?? '—'}</td>
                    <td className="px-5 py-3 tabular-nums font-semibold">{money(Number(r.amount || 0))}</td>
                    <td className="px-5 py-3">{r.paid_at}</td>
                    <td className="px-5 py-3">{r.method}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{r.reference ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

