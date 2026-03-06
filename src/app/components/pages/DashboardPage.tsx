import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { AlertCircle, FileText, Eye, XCircle } from 'lucide-react';
import { getOpsDashboard, getOpsDocumentSignedUrl, type OpsDashboardResponse } from '@/app/api/ops';
import { getSupabase } from '@/app/auth/supabase';

interface KPITileProps {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
}

function KPITile({ label, value, icon: Icon }: KPITileProps) {
  return (
    <div className="bg-card rounded-lg p-4 sm:p-5 lg:p-6 border" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between mb-3 sm:mb-4 gap-3">
        <div className="text-xs sm:text-sm opacity-60 leading-snug">{label}</div>
        <div
          className="w-9 h-9 sm:w-10 sm:h-10 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--muted)' }}
        >
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 opacity-60" />
        </div>
      </div>
      <div
        className="text-2xl sm:text-3xl lg:text-4xl"
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
      >
        {value}
      </div>
    </div>
  );
}

type UrgentDoc = OpsDashboardResponse['urgent_documents'][number];

function formatDocType(value?: string | null): string {
  if (!value) return 'Unknown';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (s) => s.toUpperCase());
}

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OpsDashboardResponse | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function refresh() {
    const res = await getOpsDashboard();
    setData(res);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getOpsDashboard();
        if (!cancelled) setData(res);
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

  const kpis = data?.kpis;
  const urgentDocs = useMemo<UrgentDoc[]>(() => data?.urgent_documents ?? [], [data]);

  function requireEnv(name: string): string {
    const v = (import.meta.env as any)[name] as string | undefined;
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
  }

  const handleView = async (doc: UrgentDoc) => {
    setBusy((m) => ({ ...m, [`view:${doc.id}`]: true }));
    try {
      // Prefer explicit drive link if present.
      if (doc.drive_url && doc.drive_url.startsWith('https://drive.google.com')) {
        window.open(doc.drive_url, '_blank', 'noreferrer');
        return;
      }

      const res = await getOpsDocumentSignedUrl(doc.id);
      window.open(res.url, '_blank', 'noreferrer');
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy((m) => ({ ...m, [`view:${doc.id}`]: false }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h1
        className="mb-6 sm:mb-8 text-xl sm:text-2xl md:text-3xl"
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
      >
        System Overview
      </h1>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-8 sm:mb-12">
        <KPITile label="Documents Awaiting Verification" value={kpis?.pending_documents ?? 0} icon={FileText} />
        <KPITile label="Pending Validation" value={kpis?.pending_validation ?? 0} icon={AlertCircle} />
        <KPITile label="Awaiting Upload" value={kpis?.awaiting_upload ?? 0} icon={FileText} />
        <KPITile label="Failed Validation" value={kpis?.failed_validation ?? 0} icon={XCircle} />
      </div>

      {/* Urgent Attention Section */}
      <div className="bg-card rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <div
          className="px-4 sm:px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <h2 className="text-base sm:text-lg" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
              Urgent Attention
            </h2>
          </div>
          <span className="text-xs sm:text-sm opacity-60 sm:ml-auto">Documents awaiting verification</span>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-sm opacity-60">Loading dashboard...</div>
        ) : error ? (
          <div className="px-6 py-8 text-sm" style={{ color: 'var(--destructive)' }}>
            {error}
          </div>
        ) : urgentDocs.length === 0 ? (
          <div className="px-6 py-8 text-sm opacity-60">No urgent documents.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {urgentDocs.map((doc) => {
              const pendingDays = daysSince(doc.uploaded_at);
              const viewing = Boolean(busy[`view:${doc.id}`]);

              return (
                <div key={doc.id} className="px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-6">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-sm" style={{ color: 'var(--primary)' }}>
                          {doc.cargo_id}
                        </span>
                        <span className="opacity-40 text-xs">·</span>
                        <span className="text-sm">{doc.client_name ?? 'Unknown Client'}</span>
                      </div>
                      <div className="text-sm opacity-60 mt-1">{formatDocType(doc.document_type)}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div
                          className="text-sm px-2.5 py-0.5 rounded inline-block"
                          style={{
                            backgroundColor: 'var(--accent)',
                            color: 'var(--accent-foreground)',
                            fontWeight: 500,
                          }}
                        >
                          {pendingDays}d pending
                        </div>
                        <div className="text-xs opacity-50 mt-1.5">
                          Uploaded {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : 'unknown'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          disabled={viewing}
                          onClick={() => void handleView(doc)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded border transition-colors disabled:opacity-60"
                          style={{
                            borderColor: 'var(--border)',
                          }}
                        >
                          <Eye className="w-4 h-4" />
                          <span className="text-sm">{viewing ? 'Opening...' : 'View'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
