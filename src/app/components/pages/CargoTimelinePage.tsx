import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { getOpsCargoTimeline, getOpsDocumentSignedUrl, getOpsApprovalSignedUrl, type OpsCargoTimelineResponse } from '@/app/api/ops';
import { requiredDocsForCategory, type CargoCategory, formatLabel as formatCategoryLabel } from '@/app/api/categories';
import { getSupabase } from '@/app/auth/supabase';

interface CargoTimelinePageProps {
  preselectedCargoId?: string;
}

function formatLabel(value?: string | null): string {
  if (!value) return 'Unknown';
  return value.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (s) => s.toUpperCase());
}

function approvalKindForDocType(docType: string): string | null {
  if (docType === 'DRAFT_DECLARATION') return 'DECLARATION_DRAFT';
  if (docType === 'WH7') return 'WH7_DOC';
  return docType;
}

type DerivedTimelineEvent = {
  key: string;
  label: string;
  at: string;
  detail?: string;
};

function buildDerivedTimeline(data: OpsCargoTimelineResponse): DerivedTimelineEvent[] {
  const events: DerivedTimelineEvent[] = [];

  // 1) Cargo created
  events.push({
    key: 'CARGO_CREATED',
    label: 'Cargo created',
    at: data.cargo.created_at,
  });

  // 2) Document-based milestones (bucket evidence)
  const uploadedDocs = data.documents.filter((d) => d.status === 'UPLOADED' && d.uploaded_at);
  const verifiedDocs = data.documents.filter((d) => d.status === 'VERIFIED' && d.verified_at);

  const earliestUpload = uploadedDocs
    .map((d) => d.uploaded_at as string)
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];

  const latestUpload = uploadedDocs
    .map((d) => d.uploaded_at as string)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  const latestVerified = verifiedDocs
    .map((d) => d.verified_at as string)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  if (earliestUpload) {
    events.push({
      key: 'DOCS_UPLOADED',
      label: 'Documents uploaded',
      at: earliestUpload,
      detail: 'Files detected in bucket (pre-validation).',
    });
  }

  // 3) Validation step (explicit when we see bucket uploads without verification)
  // If there are uploaded docs and not all are verified, we are effectively in validation.
  const hasUploaded = data.documents.some((d) => d.status === 'UPLOADED');
  const hasAnyVerified = data.documents.some((d) => d.status === 'VERIFIED');
  const hasPendingValidation = hasUploaded && !hasAnyVerified;

  if (hasPendingValidation) {
    events.push({
      key: 'VALIDATION',
      label: 'Validation in progress',
      at: latestUpload ?? earliestUpload ?? data.cargo.created_at,
      detail: 'Documents are present in the bucket and awaiting verification.',
    });
  }

  if (latestVerified) {
    events.push({
      key: 'DOCS_VERIFIED',
      label: 'Documents verified',
      at: latestVerified,
    });
  }

  // 4) Approvals (draft/assessment) visibility
  for (const a of data.approvals) {
    events.push({
      key: `APPROVAL_${a.kind}_${a.id}`,
      label: `${formatLabel(a.kind)} ${formatLabel(a.status)}`,
      at: a.decided_at ?? a.created_at,
      detail: a.decided_at ? `Decided ${new Date(a.decided_at).toLocaleString()}` : 'Awaiting decision',
    });
  }

  // Sort chronologically
  return events
    .filter((e) => !Number.isNaN(Date.parse(e.at)))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function CargoTimelinePage({ preselectedCargoId = '' }: CargoTimelinePageProps) {
  const [searchQuery, setSearchQuery] = useState(preselectedCargoId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OpsCargoTimelineResponse | null>(null);
  const requiredDocs = data?.cargo.category
    ? requiredDocsForCategory(data.cargo.category as CargoCategory)
    : [];
  const documentsByType = data?.documents.reduce<Record<string, typeof data.documents>>((acc, doc) => {
    acc[doc.document_type] = acc[doc.document_type] ? [...acc[doc.document_type], doc] : [doc];
    return acc;
  }, {}) ?? {};
  const approvalsByKind = data?.approvals.reduce<Record<string, typeof data.approvals>>((acc, approval) => {
    acc[approval.kind] = acc[approval.kind] ? [...acc[approval.kind], approval] : [approval];
    return acc;
  }, {}) ?? {};

  const load = async (cargoId: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await getOpsCargoTimeline(cargoId);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (preselectedCargoId) {
      load(preselectedCargoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedCargoId]);

  // Real-time subscriptions for cargo timeline updates
  useEffect(() => {
    if (!data?.cargo.id) return;

    const supabase = getSupabase();
    const cargoId = data.cargo.id;

    const refreshTimeline = () => {
      load(cargoId);
    };

    // Subscribe to cargo_events table (timeline updates)
    const eventsSubscription = supabase
      .channel(`cargo_timeline_events_${cargoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cargo_events',
          filter: `cargo_id=eq.${cargoId}`,
        },
        () => {
          refreshTimeline();
        }
      )
      .subscribe();

    // Subscribe to client_documents table (document updates)
    const documentsSubscription = supabase
      .channel(`cargo_timeline_documents_${cargoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_documents',
          filter: `cargo_id=eq.${cargoId}`,
        },
        () => {
          refreshTimeline();
        }
      )
      .subscribe();

    // Subscribe to cargo_client_approvals table (approval updates)
    const approvalsSubscription = supabase
      .channel(`cargo_timeline_approvals_${cargoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cargo_client_approvals',
          filter: `cargo_id=eq.${cargoId}`,
        },
        () => {
          refreshTimeline();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventsSubscription);
      supabase.removeChannel(documentsSubscription);
      supabase.removeChannel(approvalsSubscription);
    };
  }, [data?.cargo.id]);

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    load(q);
  };

  const [actionError, setActionError] = useState<string | null>(null);

  const openDoc = async (documentId: string) => {
    setActionError(null);
    try {
      const res = await getOpsDocumentSignedUrl(documentId);
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  const openApproval = async (approval: OpsCargoTimelineResponse['approvals'][number]) => {
    setActionError(null);
    try {
      const res = await getOpsApprovalSignedUrl(approval.id);
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1>Cargo Timeline</h1>
        <p className="text-sm opacity-60 mt-2">Authoritative event history per cargo</p>
      </div>

      <div className="mb-8 flex gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Cargo ID"
            className="w-full pl-10 pr-4 py-2.5 rounded border bg-transparent"
            style={{ borderColor: 'var(--border)' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
          />
        </div>

        <button
          onClick={handleSearch}
          className="px-6 py-2.5 rounded border transition-colors"
          style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary)';
            e.currentTarget.style.color = 'var(--primary-foreground)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--primary)';
          }}
        >
          Search
        </button>
      </div>

      {actionError && (
        <div
          className="mb-6 bg-card rounded-lg border p-4 text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--destructive)' }}
        >
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="bg-card rounded-lg border p-8 text-sm opacity-60" style={{ borderColor: 'var(--border)' }}>
          Loading…
        </div>
      ) : error ? (
        <div className="bg-card rounded-lg border p-8 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--destructive)' }}>
          {error}
        </div>
      ) : !data ? (
        <div className="bg-card rounded-lg border p-8" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm opacity-60">Enter a Cargo ID to view timeline.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-card rounded-lg border p-6" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm opacity-60">Cargo</div>
                <div className="font-mono text-lg" style={{ color: 'var(--primary)' }}>
                  {data.cargo.id}
                </div>
                <div className="text-sm opacity-60 mt-1">Client: {data.cargo.client_name}</div>
                <div className="text-sm opacity-60">Category: {formatLabel(data.cargo.category)}</div>
              </div>
              <div className="text-xs opacity-60">Created {new Date(data.cargo.created_at).toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-card rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2>Required Documents</h2>
              <p className="text-sm opacity-60">
                {data.cargo.category ? `Category: ${formatCategoryLabel(data.cargo.category)}` : 'Category not set'}
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {requiredDocs.length === 0 ? (
                <div className="px-6 py-6 text-sm opacity-60">No required documents configured for this cargo.</div>
              ) : (
                requiredDocs.map((docType) => {
                  const docs = documentsByType[docType] ?? [];
                  const approvals = approvalsByKind[approvalKindForDocType(docType) ?? docType] ?? [];
                  const latestDoc = docs[0];
                  const latestApproval = approvals[0];
                  const status = latestDoc?.status === 'VERIFIED'
                    ? 'Validated'
                    : latestDoc?.status === 'UPLOADED'
                    ? 'Uploaded'
                    : latestApproval?.status
                    ? formatLabel(latestApproval.status)
                    : 'Pending';
                  const uploadedAt = latestDoc?.uploaded_at ?? latestApproval?.created_at ?? null;
                  const verifiedAt = latestDoc?.verified_at ?? latestApproval?.decided_at ?? null;

                  return (
                    <div key={docType} className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-sm" style={{ fontWeight: 500 }}>
                          {formatLabel(docType)}
                        </div>
                        <div className="text-xs opacity-60 mt-1">{status}</div>
                        {uploadedAt && (
                          <div className="text-xs opacity-60">Uploaded {new Date(uploadedAt).toLocaleString()}</div>
                        )}
                        {verifiedAt && (
                          <div className="text-xs opacity-60">Validated {new Date(verifiedAt).toLocaleString()}</div>
                        )}
                      </div>
                      <div>
                        {latestDoc ? (
                          <button
                            onClick={() => openDoc(latestDoc.id)}
                            className="px-4 py-2 rounded border text-sm"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            Open
                          </button>
                        ) : latestApproval ? (
                          <button
                            onClick={() => void openApproval(latestApproval)}
                            className="px-4 py-2 rounded border text-sm"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            Open
                          </button>
                        ) : (
                          <span className="text-xs opacity-50">No file</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-card rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2>Validation Queue Documents</h2>
              <p className="text-sm opacity-60">Assessment, Draft, WH7, Exit Note, IM8, and pathway approvals</p>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {data.approvals.length === 0 ? (
                <div className="px-6 py-6 text-sm opacity-60">No validation queue documents yet.</div>
              ) : (
                data.approvals.map((a) => (
                  <div key={a.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-baseline gap-3">
                        <div className="text-sm" style={{ fontWeight: 500 }}>
                          {formatLabel(a.kind)}
                        </div>
                        <div className="text-xs opacity-60">{formatLabel(a.status)}</div>
                      </div>
                      <div className="text-xs opacity-60 mt-1">Uploaded {new Date(a.created_at).toLocaleString()}</div>
                      {a.decided_at && <div className="text-xs opacity-60">Validated {new Date(a.decided_at).toLocaleString()}</div>}
                    </div>

                    <button
                      onClick={() => void openApproval(a)}
                      className="px-4 py-2 rounded border text-sm"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      Open
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-card rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2>Events</h2>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {data.events.length === 0 ? (
                (() => {
                  const derived = buildDerivedTimeline(data);
                  if (derived.length === 0) {
                    return <div className="px-6 py-6 text-sm opacity-60">No events.</div>;
                  }

                  return (
                    <div className="px-6 py-6">
                      <div className="text-xs opacity-60 mb-3">
                        No cargo milestone events recorded for this cargo. Showing a derived timeline from documents/approvals.
                      </div>
                      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                        {derived.map((ev) => (
                          <div key={ev.key} className="py-3">
                            <div className="flex items-baseline justify-between gap-4">
                              <div className="text-sm" style={{ fontWeight: 500 }}>
                                {ev.label}
                              </div>
                              <div className="text-xs opacity-60">{new Date(ev.at).toLocaleString()}</div>
                            </div>
                            {ev.detail && <div className="text-sm opacity-60 mt-1">{ev.detail}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : (
                data.events.map((ev) => (
                  <div key={ev.id} className="px-6 py-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="text-sm" style={{ fontWeight: 500 }}>
                        {formatLabel(ev.event_type)}
                      </div>
                      <div className="text-xs opacity-60">{new Date(ev.event_time).toLocaleString()}</div>
                    </div>
                    {ev.notes && <div className="text-sm opacity-60 mt-1">{ev.notes}</div>}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
