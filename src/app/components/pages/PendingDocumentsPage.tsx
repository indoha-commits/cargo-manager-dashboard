import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, Search, Loader2 } from 'lucide-react';
import {
  getOpsDocumentSignedUrl,
  getOpsPendingDocuments,
  verifyDocument,
  type OpsPendingDocumentsResponse,
} from '@/app/api/ops';

type PendingDoc = OpsPendingDocumentsResponse['documents'][number];

type Grouped = Array<{
  clientName: string;
  cargos: Array<{
    cargoId: string;
    documents: PendingDoc[];
  }>;
}>;

function formatDocType(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (s) => s.toUpperCase());
}

export function PendingDocumentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [search, setSearch] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedCargos, setExpandedCargos] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [verifyState, setVerifyState] = useState<Record<string, 'idle' | 'loading' | 'done'>>({});

  const refresh = async () => {
    const res = await getOpsPendingDocuments();
    setDocs(res.documents ?? []);
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getOpsPendingDocuments();
        if (!cancelled) setDocs(res.documents ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo<Grouped>(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? docs.filter((d) => {
          const cargo = d.cargo_id?.toLowerCase() ?? '';
          const client = (d.client_name ?? '').toLowerCase();
          const type = d.document_type?.toLowerCase() ?? '';
          return cargo.includes(q) || client.includes(q) || type.includes(q);
        })
      : docs;

    const byClient = new Map<string, Map<string, PendingDoc[]>>();
    for (const d of filtered) {
      const clientName = d.client_name ?? 'Unknown Client';
      const cargoId = d.cargo_id;
      const cargos = byClient.get(clientName) ?? new Map<string, PendingDoc[]>();
      const list = cargos.get(cargoId) ?? [];
      list.push(d);
      cargos.set(cargoId, list);
      byClient.set(clientName, cargos);
    }

    return Array.from(byClient.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clientName, cargos]) => ({
        clientName,
        cargos: Array.from(cargos.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([cargoId, documents]) => ({
            cargoId,
            documents: documents.slice().sort((a, b) => String(a.document_type).localeCompare(String(b.document_type))),
          })),
      }));
  }, [docs, search]);

  const toggleClient = (clientName: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      next.has(clientName) ? next.delete(clientName) : next.add(clientName);
      return next;
    });
  };

  const toggleCargo = (cargoId: string) => {
    setExpandedCargos((prev) => {
      const next = new Set(prev);
      next.has(cargoId) ? next.delete(cargoId) : next.add(cargoId);
      return next;
    });
  };

  const [rejectDialog, setRejectDialog] = useState<{ doc: PendingDoc; reason: string } | null>(null);

  const handleVerify = async (doc: PendingDoc, action: 'approve' | 'reject', rejectionReason?: string) => {
    setBusy((m) => ({ ...m, [doc.id]: true }));
    setVerifyState((s) => ({ ...s, [doc.id]: 'loading' }));
    try {
      await verifyDocument({ document_id: doc.id, action, rejection_reason: rejectionReason });
      await refresh();
      setVerifyState((s) => ({ ...s, [doc.id]: 'done' }));
      window.setTimeout(() => {
        setVerifyState((s) => {
          if (s[doc.id] !== 'done') return s;
          const next = { ...s };
          delete next[doc.id];
          return next;
        });
      }, 2000);
    } catch (e) {
      setVerifyState((s) => {
        const next = { ...s };
        delete next[doc.id];
        return next;
      });
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy((m) => ({ ...m, [doc.id]: false }));
    }
  };

  const submitReject = async () => {
    if (!rejectDialog) return;
    const reason = rejectDialog.reason.trim();
    if (!reason) return;
    await handleVerify(rejectDialog.doc, 'reject', reason);
    setRejectDialog(null);
  };

  const handleOpenSignedUrl = async (doc: PendingDoc) => {
    setBusy((m) => ({ ...m, [`open:${doc.id}`]: true }));
    try {
      const res = await getOpsDocumentSignedUrl(doc.id);
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy((m) => ({ ...m, [`open:${doc.id}`]: false }));
    }
  };

  const totalDocs = docs.length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1>Pending Documents</h1>
        <p className="text-sm opacity-60 mt-2">Documents awaiting ops verification</p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client, cargo id, or document type"
            className="w-full pl-10 pr-4 py-2.5 rounded border bg-transparent"
            style={{ borderColor: 'var(--border)' }}
          />
        </div>
        <div className="text-sm opacity-60 sm:whitespace-nowrap">{totalDocs} pending</div>
      </div>

      <div className="bg-card rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        {loading ? (
          <div className="px-6 py-8 text-sm opacity-60">Loading…</div>
        ) : error ? (
          <div className="px-6 py-8 text-sm" style={{ color: 'var(--destructive)' }}>
            {error}
          </div>
        ) : grouped.length === 0 ? (
          <div className="px-6 py-8 text-sm opacity-60">No pending documents found.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {grouped.map((client) => {
              const clientOpen = expandedClients.has(client.clientName);
              return (
                <div key={client.clientName}>
                  <button
                    onClick={() => toggleClient(client.clientName)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <div className="text-sm" style={{ fontWeight: 600 }}>
                          {client.clientName}
                        </div>
                        <div className="text-xs opacity-60 mt-1">{client.cargos.length} cargos</div>
                      </div>
                    </div>
                    <div className="text-sm opacity-60">{clientOpen ? '−' : '+'}</div>
                  </button>

                  {clientOpen && (
                    <div className="px-6 pb-4">
                      <div className="space-y-3">
                        {client.cargos.map((cargo) => {
                          const cargoOpen = expandedCargos.has(cargo.cargoId);
                          return (
                            <div
                              key={cargo.cargoId}
                              className="rounded border"
                              style={{ borderColor: 'var(--border)' }}
                            >
                              <button
                                onClick={() => toggleCargo(cargo.cargoId)}
                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-sm" style={{ color: 'var(--primary)' }}>
                                    {cargo.cargoId}
                                  </span>
                                  <span className="text-xs opacity-60">({cargo.documents.length} docs)</span>
                                </div>
                                <div className="text-sm opacity-60">{cargoOpen ? '−' : '+'}</div>
                              </button>

                              {cargoOpen && (
                                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                                  {cargo.documents.map((doc) => {
                                    const verifying = Boolean(busy[doc.id]);
                                    const opening = Boolean(busy[`open:${doc.id}`]);
                                    return (
                                      <div key={doc.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                                        <div>
                                          <div className="text-sm" style={{ fontWeight: 500 }}>
                                            {formatDocType(doc.document_type)}
                                          </div>
                                          <div className="text-xs opacity-60 mt-1">
                                            Uploaded {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : 'unknown'}
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2">
                                          <button
                                            disabled={opening}
                                            onClick={() => handleOpenSignedUrl(doc)}
                                            className="min-w-0 flex-1 inline-flex items-center justify-center gap-2 px-2 sm:px-3 py-2 sm:py-2.5 rounded border text-xs sm:text-sm disabled:opacity-60"
                                            style={{ borderColor: 'var(--border)' }}
                                          >
                                            <ExternalLink className="w-4 h-4" />
                                            Open
                                          </button>
                                          <button
                                            disabled={verifying}
                                            onClick={() => handleVerify(doc, 'approve')}
                                            className="min-w-0 flex-1 inline-flex items-center justify-center gap-2 px-2 sm:px-3 py-2 sm:py-2.5 rounded border text-xs sm:text-sm disabled:opacity-60"
                                            style={
                                              verifyState[doc.id] === 'done'
                                                ? { borderColor: 'rgb(34, 197, 94)', color: 'rgb(34, 197, 94)' }
                                                : { borderColor: 'var(--primary)', color: 'var(--primary)' }
                                            }
                                          >
                                            {verifyState[doc.id] === 'loading' ? (
                                              <Loader2 className="w-4 h-4 animate-spin" aria-label="Loading" />
                                            ) : (
                                              <CheckCircle2 className="w-4 h-4" />
                                            )}
                                            {verifyState[doc.id] === 'loading'
                                              ? 'Approving…'
                                              : verifyState[doc.id] === 'done'
                                                ? 'Approved'
                                                : 'Approve'}
                                          </button>
                                          <button
                                            disabled={verifying}
                                            onClick={() => setRejectDialog({ doc, reason: '' })}
                                            className="min-w-0 flex-1 inline-flex items-center justify-center gap-2 px-2 sm:px-3 py-2 sm:py-2.5 rounded border text-xs sm:text-sm disabled:opacity-60"
                                            style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}
                                          >
                                            {verifyState[doc.id] === 'loading' ? (
                                              <Loader2 className="w-4 h-4 animate-spin" aria-label="Loading" />
                                            ) : null}
                                            {verifyState[doc.id] === 'loading' ? 'Rejecting…' : 'Reject'}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rejectDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg rounded-lg border bg-card" style={{ borderColor: 'var(--border)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ fontWeight: 600 }}>
                Rejection reason
              </div>
            </div>
            <div className="p-4 space-y-3">
              <label className="text-sm opacity-70" htmlFor="reject-reason">
                Provide a reason for rejection
              </label>
              <textarea
                id="reject-reason"
                value={rejectDialog.reason}
                onChange={(e) => setRejectDialog((prev) => (prev ? { ...prev, reason: e.target.value } : prev))}
                rows={4}
                className="w-full rounded border bg-background px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)' }}
                placeholder="Explain what needs to be updated"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectDialog(null)}
                  className="px-3 py-2 rounded border text-xs"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitReject()}
                  disabled={!rejectDialog.reason.trim()}
                  className="px-3 py-2 rounded text-xs text-white"
                  style={{ backgroundColor: 'var(--destructive)' }}
                >
                  Submit rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
