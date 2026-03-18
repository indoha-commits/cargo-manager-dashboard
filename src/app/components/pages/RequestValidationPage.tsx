import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { getSupabase } from '@/app/auth/supabase';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { fetchJson } from '@/app/api/client';

interface RequestRow {
  id: string;
  client_id: string;
  client_name: string;
  status: string;
  file_path: string;
  file_name: string | null;
  created_at: string;
  approved_at: string | null;
  rejection_reason: string | null;
}

async function getOpsRequests(): Promise<{ requests: RequestRow[] }> {
  return await fetchJson<{ requests: RequestRow[] }>(`/ops/requests`, { method: 'GET' });
}

async function approveRequest(requestId: string): Promise<void> {
  await fetchJson(`/ops/requests/approve`, { method: 'POST', body: JSON.stringify({ request_id: requestId }) });
}

async function rejectRequest(requestId: string, reason: string): Promise<void> {
  await fetchJson(`/ops/requests/reject`, { method: 'POST', body: JSON.stringify({ request_id: requestId, rejection_reason: reason }) });
}

async function getSignedUrl(path: string): Promise<string> {
  const res = await fetchJson<{ url: string }>(`/ops/request-file-signed-url`, {
    method: 'POST',
    body: JSON.stringify({ file_path: path }),
  });
  return res.url;
}

export function RequestValidationPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [rejectDialog, setRejectDialog] = useState<{ request: RequestRow; reason: string } | null>(null);

  const refresh = async () => {
    const res = await getOpsRequests();
    setRequests(res.requests ?? []);
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getOpsRequests();
        if (!cancelled) setRequests(res.requests ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();

    const supabase = getSupabase();
    const requestSub = supabase
      .channel('validation_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mt_request_on_validation' }, () => {
        refresh();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(requestSub);
    };
  }, []);

  const pendingRequests = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);

  const handleApprove = async (request: RequestRow) => {
    setBusy((m) => ({ ...m, [request.id]: true }));
    try {
      await approveRequest(request.id);
      await refresh();
      navigate('/cargo-registry');
    } finally {
      setBusy((m) => ({ ...m, [request.id]: false }));
    }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    setBusy((m) => ({ ...m, [rejectDialog.request.id]: true }));
    try {
      await rejectRequest(rejectDialog.request.id, rejectDialog.reason);
      await refresh();
      setRejectDialog(null);
    } finally {
      setBusy((m) => ({ ...m, [rejectDialog.request.id]: false }));
    }
  };

  const openDocument = async (request: RequestRow) => {
    const url = await getSignedUrl(request.file_path);
    window.open(url, '_blank');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl">Validation Requests</h2>
        <p className="text-sm opacity-60 mt-1">Review Bill of Lading uploads before creating cargo.</p>
      </div>

      <div className="bg-card rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        {loading ? (
          <div className="px-6 py-8 text-sm opacity-60">Loading…</div>
        ) : error ? (
          <div className="px-6 py-8 text-sm" style={{ color: 'var(--destructive)' }}>{error}</div>
        ) : pendingRequests.length === 0 ? (
          <div className="px-6 py-8 text-sm opacity-60">No pending requests.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {pendingRequests.map((req) => {
              const busyReq = Boolean(busy[req.id]);
              return (
                <div key={req.id} className="px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm" style={{ fontWeight: 600 }}>{req.client_name}</div>
                    <div className="text-xs opacity-60">
                      {req.file_name ?? 'Bill of Lading'} · {new Date(req.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openDocument(req)}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View file
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyReq}
                      onClick={() => handleApprove(req)}
                      className="bg-green-600 text-white hover:bg-green-700"
                    >
                      {busyReq ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span className="ml-2">Approve & create cargo</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyReq}
                      onClick={() => setRejectDialog({ request: req, reason: '' })}
                      className="border-red-600 text-red-600"
                    >
                      {busyReq ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      <span className="ml-2">Reject</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6" style={{ backgroundColor: 'rgba(11, 28, 45, 0.85)' }}>
          <div className="bg-card rounded-lg border w-full max-w-lg" style={{ borderColor: 'var(--border)' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-lg">Reject request</h3>
              <p className="text-sm opacity-60">Provide a reason for rejection.</p>
            </div>
            <div className="p-6 space-y-4">
              <Input
                value={rejectDialog.reason}
                onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
                placeholder="Reason"
                className="bg-background text-foreground"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
                <Button onClick={handleReject} disabled={!rejectDialog.reason.trim()}>Reject</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
