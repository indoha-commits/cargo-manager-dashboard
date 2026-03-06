import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

import { getOpsClients } from '@/app/api/ops';
import { fetchJson } from '@/app/api/client';

type Category = 'MEDS_BEVERAGE' | 'RAW_MATERIALS' | 'ELECTRONICS';

function requiredDocsForCategory(category: Category | ''): string[] {
  if (!category) return [];
  const base = ['BILL_OF_LADING', 'COMMERCIAL_INVOICE', 'PACKING_LIST'];
  if (category === 'MEDS_BEVERAGE') return [...base, 'IMPORT_LICENSE'];
  if (category === 'RAW_MATERIALS') return [...base, 'IMPORT_PERMIT'];
  return [...base, 'TYPE_APPROVAL'];
}

export function ImportCargoPage() {
  const [category, setCategory] = useState<Category | ''>('');

  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [cargos, setCargos] = useState<string[]>([]);
  const [loadingCargos, setLoadingCargos] = useState(false);
  const [selectedCargoId, setSelectedCargoId] = useState<string>('');

  const [docsVerifiedAt, setDocsVerifiedAt] = useState<string>('');
  const [importedAt, setImportedAt] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const requiredDocs = useMemo(() => requiredDocsForCategory(category), [category]);

  useEffect(() => {
    const load = async () => {
      if (!category) {
        setClients([]);
        setSelectedClientId('');
        setCargos([]);
        setSelectedCargoId('');
        setLoadingClients(false);
        return;
      }

      try {
        setLoadingClients(true);
        setError(null);
        const res = await getOpsClients(category);
        setClients(res.clients);
        setSelectedClientId('');
        setCargos([]);
        setSelectedCargoId('');
      } catch (e) {
        setError(String(e));
      } finally {
        setLoadingClients(false);
      }
    };

    void load();
  }, [category]);

  useEffect(() => {
    const loadCargos = async () => {
      if (!category || !selectedClientId) {
        setCargos([]);
        setSelectedCargoId('');
        return;
      }

      try {
        setLoadingCargos(true);
        setError(null);

        // We call the worker directly through the ops API base.
        // This endpoint is implemented in the worker.
        const data = await fetchJson<{ cargos: string[]; summary?: any }>(
          `/ops/drive/client/${encodeURIComponent(selectedClientId)}/cargos?category=${encodeURIComponent(category)}`,
          { method: 'GET' }
        );
        setCargos(data.cargos ?? []);
        if (data.summary) {
          setSuccess(
            `Sync: ${data.summary.docs_imported} docs imported across ${data.summary.cargos_found} cargos. Missing required docs for ${data.summary.cargos_missing_required_docs} cargos.`
          );
        }
      } catch (e) {
        setError(String(e));
        setCargos([]);
      } finally {
        setLoadingCargos(false);
      }
    };

    void loadCargos();
  }, [category, selectedClientId]);

  const onSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!category) return setError('Select a category');
    if (!selectedClientId) return setError('Select a client');
    if (!selectedCargoId) return setError('Select a cargo');

    setSubmitting(true);
    try {
      // Use worker endpoint directly (already implemented)
      const data = await fetchJson<{ cargo_id: string }>(`/ops/cargo/import-from-drive`, {
        method: 'POST',
        body: JSON.stringify({
          client_id: selectedClientId,
          cargo_id: selectedCargoId,
          category,
          docs_verified_at: docsVerifiedAt ? new Date(docsVerifiedAt).toISOString() : null,
          imported_at: importedAt ? new Date(importedAt).toISOString() : null,
        }),
      });
      setSuccess(`Imported cargo ${data.cargo_id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1>Import Cargo</h1>
        <p className="text-sm opacity-60 mt-2">
          Import an existing cargo from Google Drive using folder structure clientId/cargoId/DOC_TYPE.
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
              <div className="flex items-center gap-2 text-sm opacity-60">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading clients…
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={!category}
                  className="w-full px-4 py-2.5 rounded-md border text-sm appearance-none disabled:opacity-60"
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
              Cargo ID (from Drive)
            </label>
            {loadingCargos ? (
              <div className="flex items-center gap-2 text-sm opacity-60">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading cargos…
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedCargoId}
                  onChange={(e) => setSelectedCargoId(e.target.value)}
                  disabled={!category || !selectedClientId}
                  className="w-full px-4 py-2.5 rounded-md border text-sm appearance-none disabled:opacity-60"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
                >
                  <option value="">Select cargo</option>
                  {cargos.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 opacity-50 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-2" style={{ fontWeight: 500 }}>
              Docs Verified At (optional)
            </label>
            <input
              type="datetime-local"
              value={docsVerifiedAt}
              onChange={(e) => setDocsVerifiedAt(e.target.value)}
              className="w-full px-4 py-2.5 rounded-md border text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
            />
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-2" style={{ fontWeight: 500 }}>
              Imported At (optional)
            </label>
            <input
              type="datetime-local"
              value={importedAt}
              onChange={(e) => setImportedAt(e.target.value)}
              className="w-full px-4 py-2.5 rounded-md border text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
            />
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
            {submitting ? 'Importing…' : 'Import Cargo'}
          </button>
        </div>
      </div>
    </div>
  );
}
