import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { deleteOpsClient } from '@/app/api/ops';
import { fetchJson } from '@/app/api/ops';

interface Client {
  id: string;
  company_name: string;
  subdomain?: string;
}

interface DeleteClientPageProps {
  onDeleted: () => void;
  onCancel: () => void;
}

export function DeleteClientPage({ onDeleted, onCancel }: DeleteClientPageProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingClients, setLoadingClients] = useState(true);

  // Load client list
  useEffect(() => {
    fetchJson<{ tenants: Client[] }>('/admin/clients')
      .then((res) => setClients(res.tenants ?? []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingClients(false));
  }, []);

  const selectedClient = clients.find((c) => c.id === selectedId);

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedId) {
      setError('Please select a client to delete.');
      return;
    }
    if (!selectedClient) {
      setError('Selected client not found.');
      return;
    }
    if (confirmName.trim().toLowerCase() !== selectedClient.company_name.trim().toLowerCase()) {
      setError(`Type the client name exactly to confirm: "${selectedClient.company_name}"`);
      return;
    }

    setSubmitting(true);
    try {
      await deleteOpsClient(selectedId);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1>Delete Client</h1>
        <p className="text-sm opacity-60 mt-2">
          Permanently removes the client and all their cargo, documents, and billing records. This action cannot be undone.
        </p>
      </div>

      <div
        className="rounded-lg border mb-4 px-4 py-3 flex items-start gap-3"
        style={{ borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.06)' }}
      >
        <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'rgb(239,68,68)' }} />
        <div className="text-sm" style={{ color: 'rgb(239,68,68)' }}>
          <strong>Warning:</strong> All cargo shipments, documents, approvals, events, invoices, and subscriptions linked
          to this client will be permanently deleted.
        </div>
      </div>

      <div className="bg-card rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <form onSubmit={handleDelete} className="p-6 space-y-4">
          {error && (
            <div className="text-sm" style={{ color: 'var(--destructive)' }}>
              {error}
            </div>
          )}

          {/* Client selector */}
          <div>
            <label className="block text-sm opacity-70 mb-1">Select client to delete</label>
            {loadingClients ? (
              <div className="text-sm opacity-50">Loading clients…</div>
            ) : (
              <select
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setConfirmName('');
                  setError(null);
                }}
                className="w-full px-3 py-2 rounded border bg-transparent"
                style={{ borderColor: 'var(--border)' }}
              >
                <option value="">— Choose a client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}{c.subdomain ? ` (${c.subdomain})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Confirmation input */}
          {selectedClient && (
            <div>
              <label className="block text-sm opacity-70 mb-1">
                Type <strong>{selectedClient.company_name}</strong> to confirm deletion
              </label>
              <input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="w-full px-3 py-2 rounded border bg-transparent"
                style={{ borderColor: 'rgba(239,68,68,0.5)' }}
                placeholder={selectedClient.company_name}
                autoComplete="off"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded border"
              style={{ borderColor: 'var(--border)' }}
            >
              Cancel
            </button>
            <button
              disabled={submitting || !selectedId || confirmName.trim().toLowerCase() !== (selectedClient?.company_name ?? '').trim().toLowerCase()}
              type="submit"
              className="px-4 py-2 rounded border flex items-center gap-2 disabled:opacity-40"
              style={{ borderColor: 'rgb(239,68,68)', color: 'rgb(239,68,68)' }}
            >
              <Trash2 className="w-4 h-4" />
              {submitting ? 'Deleting…' : 'Delete Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
