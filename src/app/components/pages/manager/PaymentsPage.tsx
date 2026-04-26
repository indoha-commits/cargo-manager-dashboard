import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CreditCard,
  Loader2,
  Mail,
  Minus,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  createManagerPayment,
  getManagerPayments,
  type CreatePaymentPayload,
  type InvoiceLineItem,
  type ManagerPaymentRow,
} from '@/app/api/ops';
import { fetchJson } from '@/app/api/client';

/* ── helpers ── */
function money(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

function fmtMethod(m: string) {
  return m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, ' ');
}

const METHOD_OPTIONS = ['bank', 'cash', 'momo', 'mpesa', 'cheque', 'other'];

/* ── New Payment drawer ── */
type ClientOption = { id: string; name: string; email?: string };

function NewPaymentDrawer({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (row: ManagerPaymentRow) => void;
}) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [clientId, setClientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dmc, setDmc] = useState('');
  const [shipmentRef, setShipmentRef] = useState('');
  const [method, setMethod] = useState('bank');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { description: '', unit: '1', quantity: 1, unit_price: 0, total_price: 0 },
  ]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchJson<{ clients: ClientOption[] }>('/ops/clients?limit=500')
      .then((r) => setClients(r.clients ?? []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, [open]);

  const total = useMemo(
    () => lineItems.reduce((s, l) => s + (Number(l.total_price) || 0), 0),
    [lineItems],
  );

  function updateLine(idx: number, field: keyof InvoiceLineItem, val: string | number) {
    setLineItems((prev) => {
      const next = prev.map((l, i) => {
        if (i !== idx) return l;
        const updated = { ...l, [field]: val };
        if (field === 'quantity' || field === 'unit_price') {
          updated.total_price = Number(updated.quantity) * Number(updated.unit_price);
        }
        return updated;
      });
      return next;
    });
  }

  function addLine() {
    setLineItems((p) => [...p, { description: '', unit: '1', quantity: 1, unit_price: 0, total_price: 0 }]);
  }

  function removeLine(idx: number) {
    setLineItems((p) => p.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError('Select a client'); return; }
    if (total <= 0) { setError('Total amount must be greater than 0'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: CreatePaymentPayload = {
        client_id: clientId,
        invoice_number: invoiceNumber || undefined,
        dmc: dmc || undefined,
        shipment_ref: shipmentRef || undefined,
        line_items: lineItems.filter((l) => l.description.trim()),
        amount: total,
        currency: 'RWF',
        paid_at: date,
        next_billing_date: nextBillingDate || undefined,
        method,
        reference: reference || undefined,
        notes: notes || undefined,
      };
      const res = await createManagerPayment(payload);
      setSavedOk(true);
      setEmailSent(res.email_sent);
      onSaved(res.payment);
      setTimeout(() => {
        setSavedOk(false);
        setEmailSent(false);
        handleReset();
        onClose();
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setClientId(''); setInvoiceNumber(''); setDmc(''); setShipmentRef('');
    setMethod('bank'); setDate(new Date().toISOString().slice(0, 10));
    setNextBillingDate(''); setReference(''); setNotes('');
    setLineItems([{ description: '', unit: '1', quantity: 1, unit_price: 0, total_price: 0 }]);
    setError(null); setSavedOk(false);
  }

  if (!open) return null;

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl flex flex-col shadow-2xl"
        style={{ backgroundColor: 'var(--background)', borderLeft: '1px solid var(--border)' }}
      >
        {/* header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <h2 className="text-lg font-bold">New Payment</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Records payment and emails a Galaxy invoice to the client</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-muted transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {savedOk ? (
          /* ── Success state ── */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <Check className="size-7 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-lg font-bold">Payment recorded</p>
              <p className="text-sm text-muted-foreground mt-1">
                {emailSent ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Mail className="size-4" /> Invoice emailed to client
                  </span>
                ) : (
                  'Invoice email could not be sent (email not configured).'
                )}
              </p>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Client */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
                Client *
              </label>
              {loading ? (
                <div className="h-10 rounded-lg bg-muted animate-pulse" />
              ) : (
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ borderColor: 'var(--border)' }}
                  required
                >
                  <option value="">Select client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Row: invoice # + DMC */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
                  Invoice No
                </label>
                <input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Auto-generated"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
                  DMC
                </label>
                <input
                  value={dmc}
                  onChange={(e) => setDmc(e.target.value)}
                  placeholder="e.g. 6661"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
            </div>

            {/* Shipment ref */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
                Bill of Lading / Shipment Ref
              </label>
              <input
                value={shipmentRef}
                onChange={(e) => setShipmentRef(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>

            {/* Row: date + next billing date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
                  Date *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-lg border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
                  Next Billing Date
                </label>
                <input
                  type="date"
                  value={nextBillingDate}
                  onChange={(e) => setNextBillingDate(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
            </div>

            {/* Method */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
                Payment Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                style={{ borderColor: 'var(--border)' }}
              >
                {METHOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>{fmtMethod(m)}</option>
                ))}
              </select>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Line Items (for invoice)
                </label>
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="size-3.5" /> Add line
                </button>
              </div>

              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: 'var(--border)' }}
              >
                {/* table header */}
                <div
                  className="grid text-xs font-semibold text-muted-foreground px-3 py-2"
                  style={{
                    gridTemplateColumns: '1fr 52px 80px 80px 28px',
                    backgroundColor: 'var(--muted)',
                  }}
                >
                  <span>Description</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Unit Price</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>

                {lineItems.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid items-center gap-2 px-3 py-2 border-t"
                    style={{
                      gridTemplateColumns: '1fr 52px 80px 80px 28px',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <input
                      value={line.description}
                      onChange={(e) => updateLine(idx, 'description', e.target.value)}
                      placeholder="e.g. Import clearing fee"
                      className="rounded-md border px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 w-full"
                      style={{ borderColor: 'var(--border)' }}
                    />
                    <input
                      type="number"
                      value={line.quantity}
                      min={1}
                      onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                      className="rounded-md border px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 w-full text-center"
                      style={{ borderColor: 'var(--border)' }}
                    />
                    <input
                      type="number"
                      value={line.unit_price}
                      min={0}
                      onChange={(e) => updateLine(idx, 'unit_price', Number(e.target.value))}
                      className="rounded-md border px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 w-full text-right"
                      style={{ borderColor: 'var(--border)' }}
                    />
                    <div className="text-xs text-right font-semibold tabular-nums text-foreground">
                      {money(line.total_price)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={lineItems.length <= 1}
                      className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-20"
                    >
                      <Minus className="size-3" />
                    </button>
                  </div>
                ))}

                {/* Total row */}
                <div
                  className="grid px-3 py-2.5 border-t font-bold"
                  style={{
                    gridTemplateColumns: '1fr 52px 80px 80px 28px',
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--muted)',
                  }}
                >
                  <span className="text-sm col-span-3 text-right pr-2 text-muted-foreground">TOTAL (RWF)</span>
                  <span className="text-sm text-right tabular-nums">{money(total)}</span>
                  <span />
                </div>
              </div>
            </div>

            {/* Reference + notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
                  Reference
                </label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Bank ref, receipt no…"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
                  Notes
                </label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</div>
            )}
          </form>
        )}

        {/* footer actions */}
        {!savedOk && (
          <div
            className="px-6 py-4 border-t shrink-0 flex gap-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              style={{ borderColor: 'var(--border)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="new-payment-form"
              onClick={(e) => {
                // proxy to the form's submit — form is inside the overflow div
                e.currentTarget.closest('.fixed')?.querySelector('form')?.requestSubmit();
              }}
              disabled={saving}
              className="flex-1 rounded-xl bg-foreground text-background px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? (
                <><Loader2 className="size-4 animate-spin" /> Saving…</>
              ) : (
                <><Mail className="size-4" /> Save &amp; Send Invoice</>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Main PaymentsPage ── */
export function PaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ManagerPaymentRow[]>([]);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  function reload() {
    setLoading(true);
    setError(null);
    getManagerPayments()
      .then((r) => setRows(r.rows ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (r.client_name ?? '').toLowerCase().includes(q) ||
      (r.invoice_number ?? '').toLowerCase().includes(q) ||
      (r.shipment_ref ?? '').toLowerCase().includes(q) ||
      (r.dmc ?? '').toLowerCase().includes(q) ||
      (r.method ?? '').toLowerCase().includes(q) ||
      (r.reference ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const total = useMemo(() => filtered.reduce((a, r) => a + (Number(r.amount) || 0), 0), [filtered]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">Cash control ledger — money → shipment → client</p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="shrink-0 flex items-center gap-2 rounded-xl bg-foreground text-background px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="size-4" /> New Payment
        </button>
      </div>

      {/* Total KPI */}
      <div
        className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <CreditCard className="size-4" />
          Total (filtered)
        </div>
        <div className="text-xl font-bold tabular-nums">{money(total)} <span className="text-sm font-normal text-muted-foreground">RWF</span></div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by client, invoice, shipment ref, DMC, method…"
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
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 bg-card border rounded-xl animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <CreditCard className="size-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No payments yet. Click <strong>New Payment</strong> to record one.</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs text-muted-foreground"
                  style={{ backgroundColor: 'var(--muted)' }}
                >
                  <th className="px-5 py-3 font-semibold">Invoice</th>
                  <th className="px-5 py-3 font-semibold">Client</th>
                  <th className="px-5 py-3 font-semibold">DMC</th>
                  <th className="px-5 py-3 font-semibold">Shipment</th>
                  <th className="px-5 py-3 font-semibold text-right">Amount (RWF)</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Next Billing</th>
                  <th className="px-5 py-3 font-semibold">Method</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t hover:bg-muted/40 transition-colors"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-5 py-3 font-mono text-xs">
                      {r.invoice_number ?? <span className="opacity-40">{r.id.slice(0, 8)}…</span>}
                    </td>
                    <td className="px-5 py-3 font-medium">{r.client_name}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{r.dmc ?? '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs">{r.shipment_ref ?? '—'}</td>
                    <td className="px-5 py-3 tabular-nums font-semibold text-right">{money(Number(r.amount || 0))}</td>
                    <td className="px-5 py-3 text-xs">{r.paid_at}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{r.next_billing_date ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-muted rounded px-2 py-0.5">{fmtMethod(r.method)}</span>
                    </td>
                    <td className="px-5 py-3">
                      {r.email_sent ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <Check className="size-3" /> Sent
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Payment Drawer */}
      <NewPaymentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={(row) => {
          setRows((prev) => [row, ...prev]);
          setDrawerOpen(false);
        }}
      />
    </div>
  );
}
