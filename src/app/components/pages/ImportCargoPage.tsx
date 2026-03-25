import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { getOpsClients } from '@/app/api/ops';
import { fetchJson } from '@/app/api/client';

type Category = 'MEDS_BEVERAGE' | 'RAW_MATERIALS' | 'ELECTRONICS';

function requiredDocsForCategory(category: Category | ''): string[] {
  if (!category) return [];
  const base = ['BILL_OF_LADING', 'COMMERCIAL_INVOICE', 'PACKING_LIST'];
  if (category === 'MEDS_BEVERAGE') return [...base, 'IMPORT_LICENSE'];
  if (category === 'RAW_MATERIALS') return [...base];
  return [...base, 'TYPE_APPROVAL'];
}

export function ImportCargoPage() {
  const [category, setCategory] = useState<Category | ''>('');

  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedCargoId, setSelectedCargoId] = useState<string>('');

  const [milestoneCompletedAt, setMilestoneCompletedAt] = useState<string>('');
  const [startingMilestone, setStartingMilestone] = useState<'DOCS_UPLOADED' | 'DOCS_VERIFIED' | 'DEPARTED_PORT' | 'IN_ROUTE_RUSUMO' | 'PHYSICAL_VERIFICATION' | 'WAREHOUSE_ARRIVAL'>('DOCS_UPLOADED');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const requiredDocs = useMemo(() => requiredDocsForCategory(category), [category]);
  const cargoIdPlaceholder = category ? `Enter cargo ID (${category})` : 'Enter cargo ID';
  
  const milestoneDateLabel = useMemo(() => {
    switch (startingMilestone) {
      case 'DOCS_UPLOADED':
        return 'Docs Uploaded At (optional)';
      case 'DOCS_VERIFIED':
        return 'Docs Verified At (optional)';
      case 'DEPARTED_PORT':
        return 'Departed from Port At (optional)';
      case 'IN_ROUTE_RUSUMO':
        return 'Started Route to Rusumo At (optional)';
      case 'PHYSICAL_VERIFICATION':
        return 'Physical Verification At (optional)';
      case 'WAREHOUSE_ARRIVAL':
        return 'Warehouse Arrival At (optional)';
      default:
        return 'Milestone Completed At (optional)';
    }
  }, [startingMilestone]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingClients(true);
        setError(null);
        const res = await getOpsClients();
        setClients(res.clients);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoadingClients(false);
      }
    };

    void load();
  }, []);

  const onSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!category) return setError('Select a category');
    if (!selectedClientId) return setError('Select a client');
    if (!selectedCargoId.trim()) return setError('Enter a cargo ID');

    setSubmitting(true);
    try {
      // Use worker endpoint directly (already implemented)
      const data = await fetchJson<{ cargo_id: string }>(`/ops/cargo/import-from-drive`, {
        method: 'POST',
        body: JSON.stringify({
          client_id: selectedClientId,
          cargo_id: selectedCargoId,
          category,
          milestone_completed_at: milestoneCompletedAt ? new Date(milestoneCompletedAt).toISOString() : null,
          starting_milestone: startingMilestone,
        }),
      });
      setSuccess(`Saved cargo ${data.cargo_id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1>Register Cargo</h1>
        <p className="text-sm opacity-60 mt-2">
          Register a cargo that already started. Select which milestone is completed and upload documents later.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-md border px-4 py-3 text-sm" style={{ borderColor: 'rgb(239, 68, 68)' }}>
          <span style={{ fontWeight: 600 }}>Error:</span> {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-md border px-4 py-3 text-sm" style={{ borderColor: 'rgb(34, 197, 94)' }}>
          <span style={{ fontWeight: 600 }}>Success:</span> {success}
        </div>
      )}

      <div className="bg-card rounded-lg border p-6" style={{ borderColor: 'var(--border)' }}>
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2 text-xs opacity-70">
            Cargo IDs are provided by your shipment records. We no longer pull cargo IDs from Google Drive.
          </div>
          <div>
            <label className="block text-sm opacity-70 mb-2" style={{ fontWeight: 500 }}>
              Category
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as any);
                  setSelectedClientId('');
                  setSelectedCargoId('');
                  setCargos([]);
                }}
                className="w-full px-4 py-2.5 rounded-md border text-sm appearance-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
              >
                <option value="">Select category</option>
                <option value="MEDS_BEVERAGE">Meds &amp; Beverage</option>
                <option value="RAW_MATERIALS">Raw Materials</option>
                <option value="ELECTRONICS">Electronics</option>
              </select>
              <ChevronDown className="w-4 h-4 opacity-50 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-2" style={{ fontWeight: 500 }}>
              Client
            </label>
            {loadingClients ? (
              <div className="flex items-center gap-2 text-sm opacity-60">Loading clients…</div>
            ) : (
              <div className="relative">
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-md border text-sm appearance-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
                >
                  <option value="">Select client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 opacity-50 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-2" style={{ fontWeight: 500 }}>
              Cargo ID
            </label>
            <input
              type="text"
              value={selectedCargoId}
              onChange={(e) => setSelectedCargoId(e.target.value)}
              disabled={!selectedClientId}
              placeholder={cargoIdPlaceholder}
              className="w-full px-4 py-2.5 rounded-md border text-sm disabled:opacity-60"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
            />
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-2" style={{ fontWeight: 500 }}>
              {milestoneDateLabel}
            </label>
            <input
              type="datetime-local"
              value={milestoneCompletedAt}
              onChange={(e) => setMilestoneCompletedAt(e.target.value)}
              className="w-full px-4 py-2.5 rounded-md border text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
            />
            <p className="text-xs opacity-60 mt-1">Optional. Leave blank to use current date/time.</p>
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-2" style={{ fontWeight: 500 }}>
              Starting Milestone
            </label>
            <div className="relative">
              <select
                value={startingMilestone}
                onChange={(e) => setStartingMilestone(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-md border text-sm appearance-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
              >
                <option value="DOCS_UPLOADED">Docs Uploaded</option>
                <option value="DOCS_VERIFIED">Docs Verified</option>
                <option value="DEPARTED_PORT">Departed from Port</option>
                <option value="IN_ROUTE_RUSUMO">In Route to Rusumo</option>
                <option value="PHYSICAL_VERIFICATION">Physical Verification</option>
                <option value="WAREHOUSE_ARRIVAL">Warehouse Arrival</option>
              </select>
              <ChevronDown className="w-4 h-4 opacity-50 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="col-span-2">
            <div className="text-xs opacity-60 mb-2">Required document folders</div>
            <div className="flex flex-wrap gap-2">
              {requiredDocs.length === 0 ? (
                <span className="text-xs opacity-60">Select a category to preview required folders.</span>
              ) : (
                requiredDocs.map((d) => (
                  <span
                    key={d}
                    className="text-xs px-2 py-1 rounded-md border"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {d}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6">
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={submitting}
            className="px-5 py-2.5 rounded-md text-sm transition-colors duration-150 disabled:opacity-60"
            style={{ backgroundColor: 'var(--gold-accent)', color: 'var(--navy-deep)', fontWeight: 600 }}
          >
            {submitting ? 'Saving…' : 'Register Cargo'}
          </button>
        </div>
      </div>
    </div>
  );
}
