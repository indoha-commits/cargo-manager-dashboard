import { ExternalLink, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  createOpsCargo,
  createOpsCargoBulk,
  deleteOpsCargo,
  deleteOpsCargoGroup,
  getOpsCargoRegistry,
  getOpsClients,
  type OpsCargoRegistryResponse,
} from '@/app/api/ops';
import { formatLabel, requiredDocsForCategory, type CargoCategory } from '@/app/api/categories';

interface CargoRegistryPageProps {
  onViewTimeline: (cargoId: string) => void;
  onCreateClient: () => void;
  onDeleteClient: () => void;
  autoOpenNewCargoWithClient?: { id: string; name: string } | null;
  onAutoOpenConsumed?: () => void;
}

type GroupRow = OpsCargoRegistryResponse['groups'][number];

type CargoGroup = {
  billOfLading: string;
  clientName: string;
  clientId: string;
  category: string | null;
  containerCount: number;
  origin: string | null;
  destination: string | null;
  route: string | null;
  vessel: string | null;
  expectedArrivalDate: string | null;
  eta: string | null;
  createdAt: string;
  updatedAt: string;
  cargos: Array<{
    cargoId: string;
    cargoUuid: string;
    createdAt: string;
    latestEvent: string | null;
    latestEventTime: string | null;
  }>;
};

function formatEvent(value: string | null): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (s) => s.toUpperCase());
}

export function CargoRegistryPage({
  onViewTimeline,
  onCreateClient,
  onDeleteClient,
  autoOpenNewCargoWithClient,
  onAutoOpenConsumed,
}: CargoRegistryPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<CargoGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [showNewCargo, setShowNewCargo] = useState(false);
  const [showBulkCargo, setShowBulkCargo] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  // Destructive delete confirmation (GitHub/Cloudflare-style)
  const [deleteTarget, setDeleteTarget] = useState<{ cargoId: string; clientName: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{ billOfLading: string; clientName: string } | null>(null);
  const [deleteGroupConfirmText, setDeleteGroupConfirmText] = useState('');
  const [deleteGroupSubmitting, setDeleteGroupSubmitting] = useState(false);
  const [deleteGroupError, setDeleteGroupError] = useState<string | null>(null);

  const [form, setForm] = useState<{
    client_id: string;
    container_id: string;
    expected_arrival_date: string;
    container_count: number;
    category: CargoCategory;
    destination: string;
    origin: string;
  }>({
    client_id: '',
    container_id: '',
    expected_arrival_date: '',
    container_count: 1,
    category: 'ELECTRONICS',
    destination: '',
    origin: '',
  });

  const [bulkForm, setBulkForm] = useState<{
    client_id: string;
    bill_of_lading: string;
    expected_arrival_date: string;
    container_count: number;
    category: CargoCategory;
    destination: string;
    origin: string;
  }>({
    client_id: '',
    bill_of_lading: '',
    expected_arrival_date: '',
    container_count: 1,
    category: 'ELECTRONICS',
    destination: '',
    origin: '',
  });

  const refresh = async () => {
    const res = await getOpsCargoRegistry();
    const mapped = (res.groups ?? []).map((g) => ({
      billOfLading: g.bill_of_lading,
      clientId: g.client_id,
      clientName: g.client_name,
      category: g.category ?? null,
      containerCount: g.container_count,
      origin: g.origin ?? null,
      destination: g.destination ?? null,
      route: g.route ?? null,
      vessel: g.vessel ?? null,
      expectedArrivalDate: g.expected_arrival_date ?? null,
      eta: g.eta ?? null,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
      cargos: g.cargos.map((c) => ({
        cargoId: c.cargo_id,
        cargoUuid: c.cargo_uuid,
        createdAt: c.created_at,
        latestEvent: c.latest_event_type,
        latestEventTime: c.latest_event_time,
      })),
    }));
    setGroups(mapped);
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getOpsCargoRegistry();
        if (!cancelled) {
          const mapped = (res.groups ?? []).map((g) => ({
            billOfLading: g.bill_of_lading,
            clientId: g.client_id,
            clientName: g.client_name,
            category: g.category ?? null,
            containerCount: g.container_count,
            origin: g.origin ?? null,
            destination: g.destination ?? null,
            route: g.route ?? null,
            vessel: g.vessel ?? null,
            expectedArrivalDate: g.expected_arrival_date ?? null,
            eta: g.eta ?? null,
            createdAt: g.created_at,
            updatedAt: g.updated_at,
            cargos: g.cargos.map((c) => ({
              cargoId: c.cargo_id,
              cargoUuid: c.cargo_uuid,
              createdAt: c.created_at,
              latestEvent: c.latest_event_type,
              latestEventTime: c.latest_event_time,
            })),
          }));
          setGroups(mapped);
        }
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

  // If we just created a new client, reopen the New Cargo modal and preselect it.
  useEffect(() => {
    if (!autoOpenNewCargoWithClient) return;

    (async () => {
      await reloadClients();
      setShowNewCargo(true);
      setForm((f) => ({ ...f, client_id: autoOpenNewCargoWithClient.id }));
      onAutoOpenConsumed?.();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenNewCargoWithClient]);

  const grouped = useMemo<CargoGroup[]>(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = q
      ? groups.filter((g) => {
          const client = (g.clientName ?? '').toLowerCase();
          const bol = (g.billOfLading ?? '').toLowerCase();
          return client.includes(q) || bol.includes(q);
        })
      : groups;

    return filtered
      .slice()
      .sort((a, b) => a.clientName.localeCompare(b.clientName))
      .map((g) => ({
        ...g,
        cargos: g.cargos.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      }));
  }, [groups, searchTerm]);

  const toggleGroup = (billOfLading: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(billOfLading) ? next.delete(billOfLading) : next.add(billOfLading);
      return next;
    });
  };

  const reloadClients = async () => {
    setClientsLoading(true);
    setClientsError(null);
    try {
      const res = await getOpsClients();
      setClients(res.clients ?? []);
    } catch (e) {
      setClientsError(e instanceof Error ? e.message : String(e));
    } finally {
      setClientsLoading(false);
    }
  };

  const openNewCargo = async () => {
    setShowNewCargo(true);
    if (clients.length) return;
    await reloadClients();
  };

  const openBulkCargo = async () => {
    setShowBulkCargo(true);
    if (clients.length) return;
    await reloadClients();
  };

  const openDeleteCargo = (cargoId: string, clientName: string) => {
    setDeleteError(null);
    setDeleteConfirmText('');
    setDeleteTarget({ cargoId, clientName });
  };

  const openDeleteCargoGroup = (billOfLading: string, clientName: string) => {
    setDeleteGroupError(null);
    setDeleteGroupConfirmText('');
    setDeleteGroupTarget({ billOfLading, clientName });
  };

  const closeDeleteCargo = () => {
    setDeleteTarget(null);
    setDeleteConfirmText('');
    setDeleteError(null);
    setDeleteSubmitting(false);
  };

  const closeDeleteCargoGroup = () => {
    setDeleteGroupTarget(null);
    setDeleteGroupConfirmText('');
    setDeleteGroupError(null);
    setDeleteGroupSubmitting(false);
  };

  const confirmDeleteCargo = async () => {
    if (!deleteTarget) return;

    const expected = deleteTarget.cargoId;
    if (deleteConfirmText.trim() !== expected) {
      setDeleteError(`Please type "${expected}" to confirm.`);
      return;
    }

    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteOpsCargo(deleteTarget.cargoId);
      await refresh();
      closeDeleteCargo();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
      setDeleteSubmitting(false);
    }
  };

  const confirmDeleteCargoGroup = async () => {
    if (!deleteGroupTarget) return;

    const expected = deleteGroupTarget.billOfLading;
    if (deleteGroupConfirmText.trim() !== expected) {
      setDeleteGroupError(`Please type "${expected}" to confirm.`);
      return;
    }

    setDeleteGroupSubmitting(true);
    setDeleteGroupError(null);
    try {
      await deleteOpsCargoGroup(deleteGroupTarget.billOfLading);
      await refresh();
      closeDeleteCargoGroup();
    } catch (e) {
      setDeleteGroupError(e instanceof Error ? e.message : String(e));
      setDeleteGroupSubmitting(false);
    }
  };

  const submitNewCargo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.client_id) {
      alert('Please select a client');
      return;
    }
    if (!form.container_id.trim()) {
      alert('Please enter a container id');
      return;
    }
    if (!form.expected_arrival_date) {
      alert('Please select expected arrival date');
      return;
    }

    const required_documents = requiredDocsForCategory(form.category);

    setSubmitting(true);
    try {
      await createOpsCargo({
        client_id: form.client_id,
        container_id: form.container_id.trim(),
        container_number: form.container_id.trim(),
        expected_arrival_date: form.expected_arrival_date,
        category: form.category,
        required_documents,
        container_count: form.container_count,
        destination: form.destination.trim() || null,
        origin: form.origin.trim() || null,
      });
      setShowNewCargo(false);
      setForm({
        client_id: '',
        container_id: '',
        expected_arrival_date: '',
        container_count: 1,
        category: 'ELECTRONICS',
        destination: '',
        origin: '',
      });
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const submitBulkCargo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bulkForm.client_id) {
      alert('Please select a client');
      return;
    }
    if (!bulkForm.bill_of_lading.trim()) {
      alert('Please enter a container group ID');
      return;
    }
    if (!bulkForm.expected_arrival_date) {
      alert('Please select expected arrival date');
      return;
    }

    const required_documents = requiredDocsForCategory(bulkForm.category);

    setSubmitting(true);
    try {
      await createOpsCargoBulk({
        client_id: bulkForm.client_id,
        bill_of_lading: bulkForm.bill_of_lading.trim(),
        expected_arrival_date: bulkForm.expected_arrival_date,
        category: bulkForm.category,
        required_documents,
        container_count: bulkForm.container_count,
        destination: bulkForm.destination.trim() || null,
        origin: bulkForm.origin.trim() || null,
      });
      setShowBulkCargo(false);
      setBulkForm({
        client_id: '',
        bill_of_lading: '',
        expected_arrival_date: '',
        container_count: 1,
        category: 'ELECTRONICS',
        destination: '',
        origin: '',
      });
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const totalCargos = groups.reduce((sum, g) => sum + g.cargos.length, 0);

  const formatTimestamp = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
        <div>
          <h1>Cargo Registry</h1>
          <p className="text-sm opacity-60 mt-2">All cargos across clients (ops). “Create New Cargo” creates a single container.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={openNewCargo}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded border"
            style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
          >
            <Plus className="w-4 h-4" />
            New Cargo
          </button>
          <button
            onClick={openBulkCargo}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded border"
            style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
          >
            <Plus className="w-4 h-4" />
            Bulk Create
          </button>
          <button
            onClick={onDeleteClient}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded border"
            style={{ borderColor: 'rgb(239,68,68)', color: 'rgb(239,68,68)' }}
          >
            <Trash2 className="w-4 h-4" />
            Delete Client
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by client or cargo id"
            className="w-full pl-10 pr-4 py-2.5 rounded border bg-transparent"
            style={{ borderColor: 'var(--border)' }}
          />
        </div>
        <div className="text-sm opacity-60 sm:whitespace-nowrap">{totalCargos} containers • {grouped.length} groups</div>
      </div>

      <div className="bg-card rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        {loading ? (
          <div className="px-6 py-8 text-sm opacity-60">Loading…</div>
        ) : error ? (
          <div className="px-6 py-8 text-sm" style={{ color: 'var(--destructive)' }}>
            {error}
          </div>
        ) : grouped.length === 0 ? (
          <div className="px-6 py-8 text-sm opacity-60">No cargos found.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {grouped.map((group) => {
              const open = expandedGroups.has(group.billOfLading);

              return (
                <div key={group.billOfLading}>
                  <button
                    onClick={() => toggleGroup(group.billOfLading)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
                  >
                    <div className="text-left">
                      <div className="text-sm" style={{ fontWeight: 600 }}>
                        {group.billOfLading}
                      </div>
                      <div className="text-xs opacity-60 mt-1">
                        {group.clientName} • {group.cargos.length} containers
                      </div>
                    </div>
                    <div className="text-sm opacity-60">{open ? '−' : '+'}</div>
                  </button>

                  {open && (
                    <div className="px-6 pb-4">
                      {/* Mobile: card list */}
                      <div className="sm:hidden space-y-3">
                        {group.cargos.map((c) => (
                          <div
                            key={c.cargoId}
                            className="rounded-lg border p-3 sm:p-4"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <div className="min-w-0">
                              <div className="font-mono text-sm sm:text-base" style={{ color: 'var(--primary)' }}>
                                {c.cargoId}
                              </div>
                              <div className="text-xs opacity-60 mt-1">Last update {formatTimestamp(c.latestEventTime)}</div>
                              <div className="text-xs opacity-60 mt-1">Stage: {formatEvent(c.latestEvent)}</div>
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-2">
                              <button
                                onClick={() => onViewTimeline(c.cargoId)}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded border text-sm"
                                style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                              >
                                <ExternalLink className="w-4 h-4" />
                                View timeline
                              </button>

                              <button
                                onClick={() => openDeleteCargo(c.cargoId, group.clientName)}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded border text-sm"
                                style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}
                              >
                                Remove container
                              </button>

                              <button
                                onClick={() => openDeleteCargoGroup(group.billOfLading, group.clientName)}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded border text-sm"
                                style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}
                              >
                                Remove container group
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Tablet/Desktop: dense list */}
                      <div className="hidden sm:block rounded border" style={{ borderColor: 'var(--border)' }}>
                        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                          {group.cargos.map((c) => (
                            <div key={c.cargoId} className="px-4 py-3 flex items-center justify-between gap-4">
                              <div>
                                <div className="font-mono text-sm" style={{ color: 'var(--primary)' }}>
                                  {c.cargoId}
                                </div>
                                <div className="text-xs opacity-60 mt-1">Last update {formatTimestamp(c.latestEventTime)}</div>
                                <div className="text-xs opacity-60 mt-1">Stage: {formatEvent(c.latestEvent)}</div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => onViewTimeline(c.cargoId)}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded border text-sm"
                                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  View timeline
                                </button>

                                <button
                                  onClick={() => openDeleteCargo(c.cargoId, group.clientName)}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded border text-sm"
                                  style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}
                                >
                                  Remove container
                                </button>

                                <button
                                  onClick={() => openDeleteCargoGroup(group.billOfLading, group.clientName)}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded border text-sm"
                                  style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}
                                >
                                  Remove container group
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Cargo Confirmation (destructive) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6" style={{ backgroundColor: 'rgba(11, 28, 45, 0.85)' }}>
          <div className="bg-card rounded-lg border w-full max-w-2xl" style={{ borderColor: 'var(--border)' }}>
            <div className="px-6 py-4 border-b flex items-start justify-between" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h2 className="text-xl" style={{ fontFamily: 'var(--font-heading)', color: 'var(--destructive)' }}>
                  Delete container
                </h2>
                <p className="text-sm opacity-70 mt-1">
                  This will permanently delete <span className="font-mono">{deleteTarget.cargoId}</span> from Supabase and remove its
                  Google Drive folder.
                </p>
              </div>
              <button onClick={closeDeleteCargo} className="p-2 rounded border" style={{ borderColor: 'var(--border)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded border p-4" style={{ borderColor: 'var(--destructive)', background: 'rgba(239, 68, 68, 0.05)' }}>
                <div className="text-sm" style={{ fontWeight: 600, color: 'var(--destructive)' }}>
                  Warning
                </div>
                <div className="text-sm opacity-80 mt-1">
                  This action cannot be undone. It will delete:
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>All cargo records (events, documents, approvals) in Supabase</li>
                    <li>Related bucket objects (best-effort)</li>
                    <li>The cargo folder in Google Drive (best-effort)</li>
                  </ul>
                </div>
              </div>

              <div>
                <label className="block text-sm opacity-70 mb-1">
                  To confirm, type <span className="font-mono">{deleteTarget.cargoId}</span>
                </label>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 rounded border bg-transparent font-mono"
                  style={{ borderColor: 'var(--border)' }}
                  placeholder={deleteTarget.cargoId}
                  disabled={deleteSubmitting}
                />
              </div>

              {deleteError && (
                <div className="text-sm" style={{ color: 'var(--destructive)' }}>
                  {deleteError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDeleteCargo}
                  className="px-4 py-2 rounded border"
                  style={{ borderColor: 'var(--border)' }}
                  disabled={deleteSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteCargo}
                  className="px-4 py-2 rounded border disabled:opacity-60"
                  style={{ borderColor: 'var(--destructive)', color: 'white', backgroundColor: 'var(--destructive)' }}
                  disabled={deleteSubmitting || deleteConfirmText.trim() !== deleteTarget.cargoId}
                >
                  {deleteSubmitting ? 'Deleting…' : 'I understand, delete this container'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteGroupTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6" style={{ backgroundColor: 'rgba(11, 28, 45, 0.85)' }}>
          <div className="bg-card rounded-lg border w-full max-w-2xl" style={{ borderColor: 'var(--border)' }}>
            <div className="px-6 py-4 border-b flex items-start justify-between" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h2 className="text-xl" style={{ fontFamily: 'var(--font-heading)', color: 'var(--destructive)' }}>
                  Delete container group
                </h2>
                <p className="text-sm opacity-70 mt-1">
                  This will permanently delete all containers in <span className="font-mono">{deleteGroupTarget.billOfLading}</span>.
                </p>
              </div>
              <button onClick={closeDeleteCargoGroup} className="p-2 rounded border" style={{ borderColor: 'var(--border)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded border p-4" style={{ borderColor: 'var(--destructive)', background: 'rgba(239, 68, 68, 0.05)' }}>
                <div className="text-sm" style={{ fontWeight: 600, color: 'var(--destructive)' }}>
                  Warning
                </div>
                <div className="text-sm opacity-80 mt-1">
                  This action cannot be undone. It will delete every container in the group.
                </div>
              </div>

              <div>
                <label className="block text-sm opacity-70 mb-1">
                  To confirm, type <span className="font-mono">{deleteGroupTarget.billOfLading}</span>
                </label>
                <input
                  value={deleteGroupConfirmText}
                  onChange={(e) => setDeleteGroupConfirmText(e.target.value)}
                  className="w-full px-3 py-2 rounded border bg-transparent font-mono"
                  style={{ borderColor: 'var(--border)' }}
                  placeholder={deleteGroupTarget.billOfLading}
                  disabled={deleteGroupSubmitting}
                />
              </div>

              {deleteGroupError && (
                <div className="text-sm" style={{ color: 'var(--destructive)' }}>
                  {deleteGroupError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDeleteCargoGroup}
                  className="px-4 py-2 rounded border"
                  style={{ borderColor: 'var(--border)' }}
                  disabled={deleteGroupSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteCargoGroup}
                  className="px-4 py-2 rounded border disabled:opacity-60"
                  style={{ borderColor: 'var(--destructive)', color: 'white', backgroundColor: 'var(--destructive)' }}
                  disabled={deleteGroupSubmitting || deleteGroupConfirmText.trim() !== deleteGroupTarget.billOfLading}
                >
                  {deleteGroupSubmitting ? 'Deleting…' : 'I understand, delete this group'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Cargo Modal */}
      {showNewCargo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(11, 28, 45, 0.8)' }}
          onClick={() => setShowNewCargo(false)}
        >
          <div
            className="bg-card rounded-lg border w-full max-w-xl"
            style={{ borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h2 className="text-xl" style={{ fontFamily: 'var(--font-heading)' }}>
                  Create New Cargo
                </h2>
                <p className="text-sm opacity-60 mt-1">Creates cargo + required docs placeholders via backend.</p>
              </div>
              <button
                onClick={() => setShowNewCargo(false)}
                className="p-2 rounded border"
                style={{ borderColor: 'var(--border)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitNewCargo} className="p-6 space-y-4">
              {clientsError && (
                <div className="text-sm" style={{ color: 'var(--destructive)' }}>
                  {clientsError}
                </div>
              )}

              <div>
                <label className="block text-sm opacity-70 mb-1">Client</label>
                <select
                  value={form.client_id}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__add_new_client__') {
                      onCreateClient();
                      return;
                    }
                    setForm((f) => ({ ...f, client_id: v }));
                  }}
                  className="w-full px-3 py-2 rounded border bg-background text-foreground"
                  style={{ borderColor: 'var(--border)' }}
                  disabled={clientsLoading}
                >
                  <option value="">Select client…</option>
                  <option value="__add_new_client__">+ Add new client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {clientsLoading && <div className="text-xs opacity-60 mt-1">Loading clients…</div>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm opacity-70 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as CargoCategory }))}
                    className="w-full px-3 py-2 rounded border bg-background text-foreground"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <option value="ELECTRONICS">Electronics</option>
                    <option value="RAW_MATERIALS">Raw Materials</option>
                    <option value="MEDS_BEVERAGE">Meds & Beverage</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm opacity-70 mb-1">Container Count</label>
                  <input
                    type="number"
                    min={1}
                    value={form.container_count}
                    onChange={(e) => setForm((f) => ({ ...f, container_count: Number(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 rounded border bg-background text-foreground"
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm opacity-70 mb-1">Container ID</label>
                <input
                  value={form.container_id}
                  onChange={(e) => setForm((f) => ({ ...f, container_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded border bg-background text-foreground"
                  style={{ borderColor: 'var(--border)' }}
                  placeholder="e.g., CONTAINER-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm opacity-70 mb-1">Origin</label>
                <input
                  value={form.origin}
                  onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
                  className="w-full px-3 py-2 rounded border bg-background text-foreground"
                  style={{ borderColor: 'var(--border)' }}
                  placeholder="e.g., Mombasa, KN"
                />
                <div className="mt-2 text-xs text-muted-foreground">
                  Route: {form.origin || 'Origin'} → {form.destination || 'Destination'}
                </div>
              </div>

              <div>
                <label className="block text-sm opacity-70 mb-1">Destination</label>
                <input
                  value={form.destination}
                  onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                  className="w-full px-3 py-2 rounded border bg-background text-foreground"
                  style={{ borderColor: 'var(--border)' }}
                  placeholder="e.g., Kigali, RW"
                />
              </div>

              <div>
                <label className="block text-sm opacity-70 mb-1">Expected Arrival Date</label>
                <input
                  type="date"
                  value={form.expected_arrival_date}
                  onChange={(e) => setForm((f) => ({ ...f, expected_arrival_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded border bg-background text-foreground date-white-icon"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div>
                <div className="text-sm opacity-70 mb-1">Required documents (auto)</div>
                <div className="text-xs text-muted-foreground">
                  {requiredDocsForCategory(form.category)
                    .filter((doc) => !['WH7_DOC', 'EXIT_NOTE', 'IMPORT_PERMIT'].includes(doc))
                    .map(formatLabel)
                    .filter((label) => !['WH7', 'Exit Note', 'Exit note'].includes(label))
                    .join(', ')}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCargo(false)}
                  className="px-4 py-2 rounded border"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  type="submit"
                  className="px-4 py-2 rounded border disabled:opacity-60"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                >
                  {submitting ? 'Creating…' : 'Create Cargo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkCargo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(11, 28, 45, 0.8)' }}
          onClick={() => setShowBulkCargo(false)}
        >
          <div
            className="bg-card rounded-lg border w-full max-w-xl"
            style={{ borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h2 className="text-xl" style={{ fontFamily: 'var(--font-heading)' }}>
                  Bulk Create Cargo
                </h2>
                <p className="text-sm opacity-60 mt-1">Creates multiple containers under one Bill of Lading.</p>
              </div>
              <button
                onClick={() => setShowBulkCargo(false)}
                className="p-2 rounded border"
                style={{ borderColor: 'var(--border)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitBulkCargo} className="p-6 space-y-4">
              {clientsError && (
                <div className="text-sm" style={{ color: 'var(--destructive)' }}>
                  {clientsError}
                </div>
              )}

              <div>
                <label className="block text-sm opacity-70 mb-1">Client</label>
                <select
                  value={bulkForm.client_id}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__add_new_client__') {
                      onCreateClient();
                      return;
                    }
                    setBulkForm((f) => ({ ...f, client_id: v }));
                  }}
                  className="w-full px-3 py-2 rounded border bg-background text-foreground"
                  style={{ borderColor: 'var(--border)' }}
                  disabled={clientsLoading}
                >
                  <option value="">Select client…</option>
                  <option value="__add_new_client__">+ Add new client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {clientsLoading && <div className="text-xs opacity-60 mt-1">Loading clients…</div>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm opacity-70 mb-1">Category</label>
                  <select
                    value={bulkForm.category}
                    onChange={(e) => setBulkForm((f) => ({ ...f, category: e.target.value as CargoCategory }))}
                    className="w-full px-3 py-2 rounded border bg-background text-foreground"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <option value="ELECTRONICS">Electronics</option>
                    <option value="RAW_MATERIALS">Raw Materials</option>
                    <option value="MEDS_BEVERAGE">Meds & Beverage</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm opacity-70 mb-1">Number of Containers</label>
                  <input
                    type="number"
                    min={1}
                    value={bulkForm.container_count}
                    onChange={(e) => setBulkForm((f) => ({ ...f, container_count: Number(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 rounded border bg-background text-foreground"
                    style={{ borderColor: 'var(--border)' }}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Example: 5 will create GROUP123-001 to GROUP123-005
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm opacity-70 mb-1">Container Group Bill of Loading</label>
                <input
                  value={bulkForm.bill_of_lading}
                  onChange={(e) => setBulkForm((f) => ({ ...f, bill_of_lading: e.target.value }))}
                  className="w-full px-3 py-2 rounded border bg-background text-foreground"
                  style={{ borderColor: 'var(--border)' }}
                  placeholder="e.g., GROUP123"
                />
              </div>

              <div>
                <label className="block text-sm opacity-70 mb-1">Origin</label>
                <input
                  value={bulkForm.origin}
                  onChange={(e) => setBulkForm((f) => ({ ...f, origin: e.target.value }))}
                  className="w-full px-3 py-2 rounded border bg-background text-foreground"
                  style={{ borderColor: 'var(--border)' }}
                  placeholder="e.g., Mombasa, KN"
                />
                <div className="mt-2 text-xs text-muted-foreground">
                  Route: {bulkForm.origin || 'Origin'} → {bulkForm.destination || 'Destination'}
                </div>
              </div>

              <div>
                <label className="block text-sm opacity-70 mb-1">Destination</label>
                <input
                  value={bulkForm.destination}
                  onChange={(e) => setBulkForm((f) => ({ ...f, destination: e.target.value }))}
                  className="w-full px-3 py-2 rounded border bg-background text-foreground"
                  style={{ borderColor: 'var(--border)' }}
                  placeholder="e.g., Kigali, RW"
                />
              </div>

              <div>
                <label className="block text-sm opacity-70 mb-1">Expected Arrival Date</label>
                <input
                  type="date"
                  value={bulkForm.expected_arrival_date}
                  onChange={(e) => setBulkForm((f) => ({ ...f, expected_arrival_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded border bg-background text-foreground date-white-icon"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div>
                <div className="text-sm opacity-70 mb-1">Required documents (auto)</div>
                <div className="text-xs text-muted-foreground">
                  {requiredDocsForCategory(bulkForm.category)
                    .filter((doc) => !['WH7_DOC', 'EXIT_NOTE', 'IMPORT_PERMIT'].includes(doc))
                    .map(formatLabel)
                    .filter((label) => !['WH7', 'Exit Note', 'Exit note'].includes(label))
                    .join(', ')}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkCargo(false)}
                  className="px-4 py-2 rounded border"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  type="submit"
                  className="px-4 py-2 rounded border disabled:opacity-60"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                >
                  {submitting ? 'Creating…' : 'Create Containers'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
