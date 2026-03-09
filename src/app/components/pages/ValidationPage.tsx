import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Clock, Upload, XCircle, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import {
  createOpsApprovalUploadUrl,
  createOpsCargoApproval,
  getOpsValidationQueue,
  type OpsValidationQueueItem,
} from '@/app/api/ops';
import { getOpsDocumentSignedUrl } from '@/app/api/client';
import { getOpsApprovalSignedUrl } from '@/app/api/ops';
import { formatLabel } from '@/app/api/categories';

type Item = OpsValidationQueueItem;

type Grouped = Array<{
  clientName: string;
  clientId: string;
  items: Item[];
}>;

async function uploadToSignedUrl(signedUrl: string, file: File): Promise<void> {
  const res = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'content-type': file.type || 'application/octet-stream',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`upload failed: ${res.status} ${text}`);
  }
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending_upload':
      return {
        bg: 'var(--accent)',
        color: 'var(--accent-foreground)',
        text: 'AWAITING UPLOAD',
        icon: Clock,
      };
    case 'pending_validation':
      return {
        bg: 'rgba(59, 130, 246, 0.15)',
        color: 'rgb(59, 130, 246)',
        text: 'PENDING VALIDATION',
        icon: Clock,
      };
    case 'validated':
      return {
        bg: 'rgba(34, 197, 94, 0.15)',
        color: 'rgb(34, 197, 94)',
        text: 'VALIDATED',
        icon: CheckCircle,
      };
    case 'failed':
      return {
        bg: 'rgba(239, 68, 68, 0.15)',
        color: 'rgb(239, 68, 68)',
        text: 'VALIDATION FAILED',
        icon: XCircle,
      };
    default:
      return {
        bg: 'var(--muted)',
        color: 'var(--muted-foreground)',
        text: String(status).toUpperCase(),
        icon: Clock,
      };
  }
};

export function ValidationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [expandedCargo, setExpandedCargo] = useState<Record<string, boolean>>({});

  const assessmentInputRef = useRef<HTMLInputElement | null>(null);
  const draftInputRef = useRef<HTMLInputElement | null>(null);
  const wh7InputRef = useRef<HTMLInputElement | null>(null);
  const exitNoteInputRef = useRef<HTMLInputElement | null>(null);
  const pendingPickRef = useRef<{ cargoId: string; kind: ApprovalKind } | null>(null);

  const refresh = async () => {
    const res = await getOpsValidationQueue();
    setItems(res.items ?? []);
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getOpsValidationQueue();
        if (!cancelled) setItems(res.items ?? []);
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
    const byClient = new Map<string, { clientName: string; clientId: string; items: Item[] }>();
    for (const it of items) {
      const clientName = it.client_name ?? 'Unknown Client';
      const clientId = it.client_id ?? 'unknown';
      const key = `${clientId}::${clientName}`;
      const g = byClient.get(key) ?? { clientName, clientId, items: [] };
      g.items.push(it);
      byClient.set(key, g);
    }

    return Array.from(byClient.values())
      .sort((a, b) => a.clientName.localeCompare(b.clientName))
      .map((g) => ({
        ...g,
        items: g.items.slice().sort((a, b) => a.cargo_id.localeCompare(b.cargo_id)),
      }));
  }, [items]);

  type ApprovalKind = 'ASSESSMENT' | 'DECLARATION_DRAFT' | 'WH7_DOC' | 'EXIT_NOTE';

  const handleUpload = async (
    cargoId: string,
    kind: ApprovalKind,
    file: File
  ) => {
    const key = `${cargoId}:${kind}`;
    setBusy((m) => ({ ...m, [key]: true }));
    try {
      const upload = await createOpsApprovalUploadUrl(cargoId, {
        kind,
        file_name: file.name,
      });

      await uploadToSignedUrl(upload.upload_url, file);

      await createOpsCargoApproval(cargoId, {
        kind,
        file_path: upload.path,
        notes: 'Uploaded from internal dashboard',
      });

      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy((m) => ({ ...m, [key]: false }));
    }
  };

  const summary = useMemo(() => {
    const pendingUpload = items.filter((i) => i.validation_status === 'pending_upload').length;
    const pendingValidation = items.filter((i) => i.validation_status === 'pending_validation').length;
    const validated = items.filter((i) => i.validation_status === 'validated').length;
    const failed = items.filter((i) => i.validation_status === 'failed').length;
    return { pendingUpload, pendingValidation, validated, failed };
  }, [items]);

  const pickFile = (cargoId: string, kind: ApprovalKind) => {
    pendingPickRef.current = { cargoId, kind };
    if (kind === 'ASSESSMENT') assessmentInputRef.current?.click();
    else if (kind === 'DECLARATION_DRAFT') draftInputRef.current?.click();
    else if (kind === 'WH7_DOC') wh7InputRef.current?.click();
    else exitNoteInputRef.current?.click();
  };

  const onFilePicked = async (file: File | null) => {
    const pending = pendingPickRef.current;
    pendingPickRef.current = null;
    if (!pending || !file) return;
    await handleUpload(pending.cargoId, pending.kind, file);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1>Validation Queue</h1>
        <p className="text-sm opacity-60 mt-2">Upload assessments and draft validations</p>
      </div>

      {/* hidden file inputs */}
      <input
        ref={assessmentInputRef}
        type="file"
        className="hidden"
        onChange={(e) => void onFilePicked(e.target.files?.[0] ?? null)}
      />
      <input
        ref={draftInputRef}
        type="file"
        className="hidden"
        onChange={(e) => void onFilePicked(e.target.files?.[0] ?? null)}
      />
      <input
        ref={wh7InputRef}
        type="file"
        className="hidden"
        onChange={(e) => void onFilePicked(e.target.files?.[0] ?? null)}
      />
      <input
        ref={exitNoteInputRef}
        type="file"
        className="hidden"
        onChange={(e) => void onFilePicked(e.target.files?.[0] ?? null)}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-card rounded-lg p-5 border" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <div className="text-sm opacity-60">Awaiting Upload</div>
          </div>
          <div className="text-3xl" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
            {summary.pendingUpload}
          </div>
        </div>
        <div className="bg-card rounded-lg p-5 border" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5" style={{ color: 'rgb(59, 130, 246)' }} />
            <div className="text-sm opacity-60">Pending Validation</div>
          </div>
          <div className="text-3xl" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
            {summary.pendingValidation}
          </div>
        </div>
        <div className="bg-card rounded-lg p-5 border" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5" style={{ color: 'rgb(34, 197, 94)' }} />
            <div className="text-sm opacity-60">Validated / Failed</div>
          </div>
          <div className="text-3xl" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
            {summary.validated + summary.failed}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        {loading ? (
          <div className="px-6 py-8 text-sm opacity-60">Loading…</div>
        ) : error ? (
          <div className="px-6 py-8 text-sm" style={{ color: 'var(--destructive)' }}>
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-8 text-sm opacity-60">No cargos ready for validation.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {grouped.map((g) => {
              const expanded = expandedClients[g.clientId] ?? true;

              return (
                <div key={g.clientId} className="px-6 py-4">
                  <button
                    className="w-full flex items-center justify-between"
                    onClick={() => setExpandedClients((m) => ({ ...m, [g.clientId]: !expanded }))}
                  >
                    <div className="flex items-center gap-2">
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 opacity-60" />
                      ) : (
                        <ChevronRight className="w-4 h-4 opacity-60" />
                      )}
                      <div>
                        <div className="text-sm" style={{ fontWeight: 600 }}>
                          {g.clientName}
                        </div>
                        <div className="text-xs opacity-60">{g.items.length} cargos</div>
                      </div>
                    </div>
                  </button>

                  {expanded && (
                    <div className="mt-4 space-y-3">
                      {g.items.map((it) => {
                        const assessmentKey = `${it.cargo_id}:ASSESSMENT`;
                        const draftKey = `${it.cargo_id}:DECLARATION_DRAFT`;
                        const wh7Key = `${it.cargo_id}:WH7_DOC`;
                        const exitNoteKey = `${it.cargo_id}:EXIT_NOTE`;

                        const badge = getStatusBadge(it.validation_status);
                        const Icon = badge.icon;

                        const cargoExpanded = expandedCargo[it.cargo_id] ?? false;

                        const canUpload = it.validation_status === 'pending_upload' || it.validation_status === 'pending_validation';
                        const canSend =
                          Boolean(it.assessment) &&
                          Boolean(it.draft) &&
                          Boolean(it.wh7) &&
                          Boolean(it.exit_note) &&
                          it.validation_status === 'pending_upload';

                        return (
                          <div key={it.cargo_id} className="rounded border" style={{ borderColor: 'var(--border)' }}>
                            <div className="px-4 py-3 flex items-start justify-between gap-4">
                              <button
                                className="flex items-start gap-3"
                                onClick={() => setExpandedCargo((m) => ({ ...m, [it.cargo_id]: !cargoExpanded }))}
                              >
                                {cargoExpanded ? (
                                  <ChevronDown className="w-4 h-4 opacity-60 mt-0.5" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 opacity-60 mt-0.5" />
                                )}
                                <div>
                                  <div className="font-mono text-sm" style={{ color: 'var(--primary)' }}>
                                    {it.cargo_id}
                                  </div>
                                  <div className="text-xs opacity-60 mt-1">Client: {it.client_name}</div>
                                  <div className="text-xs opacity-60">
                                    Created:{' '}
                                    {it.validation_created_at ? new Date(it.validation_created_at).toLocaleString() : '—'}
                                  </div>
                                </div>
                              </button>

                              <div className="flex items-center gap-3">
                                <div
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                                  style={{ backgroundColor: badge.bg, color: badge.color, fontWeight: 700 }}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  {badge.text}
                                </div>
                              </div>
                            </div>

                            {cargoExpanded && (
                              <div className="px-4 pb-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="border rounded-lg p-4" style={{ borderColor: 'var(--border)' }}>
                                    <div
                                      className="text-sm mb-2"
                                      style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
                                    >
                                      Verified Documents
                                    </div>
                                    <div className="space-y-2">
                                      {(it.documents ?? []).map((d) => (
                                        <div
                                          key={d.document_type}
                                          className="flex items-center justify-between px-3 py-2 rounded border"
                                          style={{ borderColor: 'var(--border)' }}
                                        >
                                          <div>
                                            <div className="text-sm" style={{ fontWeight: 600 }}>
                                              {d.document_type}
                                            </div>
                                            <div className="text-xs opacity-60">
                                              Uploaded {d.uploaded_at ?? '—'}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <button
                                              type="button"
                                              className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded border disabled:opacity-50"
                                              style={{ borderColor: 'var(--border)' }}
                                              disabled={!d.id && !(d.status === 'VERIFIED' && d.drive_url)}
                                              onClick={async () => {
                                                try {
                                                  // IMPORTANT:
                                                  // - Before VERIFIED, the file lives in the bucket. Use signed-url (requires document id).
                                                  // - After VERIFIED, drive_url is a Google Drive URL.
                                                  if (d.status === 'VERIFIED' && d.drive_url) {
                                                    window.open(d.drive_url, '_blank', 'noreferrer');
                                                    return;
                                                  }

                                                  const { url } = await getOpsDocumentSignedUrl(d.id);
                                                  window.open(url, '_blank', 'noreferrer');
                                                } catch (e) {
                                                  alert(String(e));
                                                }
                                              }}
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                              View
                                            </button>
                                            <div className="text-xs opacity-70">{formatLabel(d.status)}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="border rounded-lg p-4" style={{ borderColor: 'var(--border)' }}>
                                    <div
                                      className="text-sm mb-3"
                                      style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
                                    >
                                      Actions
                                    </div>

                                    <div className="space-y-3">
                                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <div>
                                          <div className="text-sm" style={{ fontWeight: 600 }}>
                                            Assessment
                                          </div>
                                          <div className="text-xs opacity-60">
                                            {it.assessment
                                              ? `Status: ${formatLabel(it.assessment.status)}`
                                              : 'Not uploaded'}
                                          </div>
                                          {it.assessment?.status === 'REJECTED' && it.assessment?.rejection_reason && (
                                            <div className="text-xs text-red-500 mt-1">
                                              Failure Reason: {it.assessment.rejection_reason}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {it.assessment && (it.assessment.file_path || it.assessment.file_url) && (
                                            <button
                                              type="button"
                                              className="inline-flex items-center gap-2 px-3 py-2.5 rounded border text-sm"
                                              style={{ borderColor: 'var(--border)' }}
                                              onClick={async () => {
                                                try {
                                                  const { url } = await getOpsApprovalSignedUrl(it.assessment!.id);
                                                  window.open(url, '_blank', 'noreferrer');
                                                } catch (e) {
                                                  alert(String(e));
                                                }
                                              }}
                                            >
                                              <Eye className="w-4 h-4" />
                                              View
                                            </button>
                                          )}

                                          <button
                                            type="button"
                                            onClick={() => pickFile(it.cargo_id, 'ASSESSMENT')}
                                            disabled={!canUpload || Boolean(busy[assessmentKey]) || (it.assessment && it.assessment.status !== 'REJECTED')}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded border transition-colors disabled:opacity-50"
                                            style={{ borderColor: 'var(--border)' }}
                                          >
                                            <Upload className="w-4 h-4" />
                                            <span className="text-sm">
                                              {busy[assessmentKey]
                                                ? 'Uploading Assessment…'
                                                : it.assessment
                                                  ? 'Uploaded'
                                                  : 'Upload Assessment'}
                                            </span>
                                          </button>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="text-sm" style={{ fontWeight: 600 }}>
                                            Draft Validation
                                          </div>
                                          <div className="text-xs opacity-60">
                                            {it.draft ? `Status: ${formatLabel(it.draft.status)}` : 'Not uploaded'}
                                          </div>
                                          {it.draft?.status === 'REJECTED' && it.draft?.rejection_reason && (
                                            <div className="text-xs text-red-500 mt-1">
                                              Failure Reason: {it.draft.rejection_reason}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {it.draft && (it.draft.file_path || it.draft.file_url) && (
                                            <button
                                              type="button"
                                              className="inline-flex items-center gap-2 px-3 py-2.5 rounded border text-sm"
                                              style={{ borderColor: 'var(--border)' }}
                                              onClick={async () => {
                                                try {
                                                  const { url } = await getOpsApprovalSignedUrl(it.draft!.id);
                                                  window.open(url, '_blank', 'noreferrer');
                                                } catch (e) {
                                                  alert(String(e));
                                                }
                                              }}
                                            >
                                              <Eye className="w-4 h-4" />
                                              View
                                            </button>
                                          )}

                                          <button
                                            type="button"
                                            onClick={() => pickFile(it.cargo_id, 'DECLARATION_DRAFT')}
                                            disabled={!canUpload || Boolean(busy[draftKey]) || (it.draft && it.draft.status !== 'REJECTED')}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded border transition-colors disabled:opacity-50"
                                            style={{ borderColor: 'var(--border)' }}
                                          >
                                            <Upload className="w-4 h-4" />
                                            <span className="text-sm">
                                              {busy[draftKey]
                                                ? 'Uploading Draft…'
                                                : it.draft
                                                  ? 'Uploaded'
                                                  : 'Upload Draft'}
                                            </span>
                                          </button>
                                        </div>
                                      </div>


                                      {it.validation_status === 'failed' && (
                                        <div
                                          className="px-4 py-3 rounded border"
                                          style={{
                                            borderColor: 'rgb(239, 68, 68)',
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                          }}
                                        >
                                          <div className="flex items-start gap-3">
                                            <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                                            <div className="flex-1">
                                              <div className="text-sm text-red-600" style={{ fontWeight: 600 }}>
                                                Validation Failed
                                              </div>
                                              <div className="text-xs opacity-70 mt-0.5 mb-2">
                                                Failed {it.validation_completed_at ?? ''}
                                              </div>
                                              {it.failure_reason && (
                                                <div
                                                  className="text-sm mt-2 px-3 py-2 rounded"
                                                  style={{ background: 'rgba(239, 68, 68, 0.08)' }}
                                                >
                                                  <div className="text-xs opacity-70 mb-1">Failure Reason:</div>
                                                  <div>{it.failure_reason}</div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
