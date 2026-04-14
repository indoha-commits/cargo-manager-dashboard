import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Clock3, PackageSearch, Siren } from 'lucide-react';
import { getOpsCargoRegistry, getOpsValidationQueue, type OpsCargoRegistryResponse, type OpsValidationQueueResponse } from '@/app/api/ops';

type ManagerContainer = {
  cargo_id: string;
  client_name: string;
  category: string | null;
  created_at: string;
  latest_event_type: string | null;
  latest_event_time: string | null;
  expected_release_date: string | null;
  verification_status: 'validated' | 'pending_validation' | 'pending_upload' | 'failed' | 'unknown';
  validation_created_at: string | null;
};

type PipelineState = 'ready_dispatch' | 'releasing_soon' | 'waiting' | 'in_transit';
type PriorityLevel = 'red' | 'yellow' | 'green';

type EnrichedContainer = ManagerContainer & {
  arrival_state: string;
  release_state: string;
  days_to_release: number | null;
  recommended_action: string;
  pipeline_state: PipelineState;
  priority_level: PriorityLevel;
};

function formatLabel(value?: string | null): string {
  if (!value) return 'Unknown';
  return value.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (s) => s.toUpperCase());
}

function toDays(targetIso: string | null): number | null {
  if (!targetIso) return null;
  const now = Date.now();
  const target = Date.parse(targetIso);
  if (!Number.isFinite(target)) return null;
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function deriveArrivalRelease(latestEventType: string | null): { arrival: string; release: string } {
  const event = latestEventType ?? '';
  if (event.includes('RELEASE') || event.includes('DISPATCH')) return { arrival: 'arrived', release: 'released' };
  if (event.includes('ARRIVAL') || event.includes('DEPARTED_PORT') || event.includes('IN_ROUTE')) return { arrival: 'in_transit', release: 'not_released' };
  return { arrival: 'processing', release: 'not_released' };
}

function decisionAction(daysToRelease: number | null, releaseStatus: string): string {
  if (releaseStatus === 'released') return 'Dispatch / Partner';
  if (daysToRelease === null) return 'Set release date';
  if (daysToRelease >= 3) return 'Do nothing';
  if (daysToRelease === 2) return 'Pre-assign';
  if (daysToRelease === 1) return 'Confirm';
  if (daysToRelease <= 0) return 'Escalate overdue release';
  return 'Monitor';
}

function pipelineState(row: ManagerContainer): PipelineState {
  const state = deriveArrivalRelease(row.latest_event_type);
  const days = toDays(row.expected_release_date);
  if (state.release === 'released') return 'ready_dispatch';
  if (state.arrival === 'in_transit') return 'in_transit';
  if (days !== null && days <= 2) return 'releasing_soon';
  return 'waiting';
}

function priorityLevel(row: ManagerContainer): PriorityLevel {
  const state = deriveArrivalRelease(row.latest_event_type);
  const days = toDays(row.expected_release_date);
  if (state.release === 'released') return 'red';
  if (days !== null && days <= 2) return 'yellow';
  return 'green';
}

function priorityBadge(level: PriorityLevel): { label: string; bg: string; color: string } {
  if (level === 'red') return { label: 'ACTION NOW', bg: 'rgba(239,68,68,0.15)', color: 'rgb(220,38,38)' };
  if (level === 'yellow') return { label: 'PREPARE', bg: 'rgba(245,158,11,0.18)', color: 'rgb(180,83,9)' };
  return { label: 'STABLE', bg: 'rgba(34,197,94,0.15)', color: 'rgb(22,163,74)' };
}

function priorityScore(row: ManagerContainer): number {
  const { release } = deriveArrivalRelease(row.latest_event_type);
  const days = toDays(row.expected_release_date);
  let score = 0;
  if (release === 'released') score += 100;
  if (row.verification_status === 'pending_upload') score += 60;
  if (row.verification_status === 'failed') score += 50;
  if (row.client_name.toLowerCase().includes('vip') || row.client_name.toLowerCase().includes('priority')) score += 40;
  if (days !== null && days <= 1) score += 30;
  if (days !== null && days < 0) score += 50;
  return score;
}

function riskFlags(row: ManagerContainer): string[] {
  const flags: string[] = [];
  const days = toDays(row.expected_release_date);
  if (days !== null && days < 0) flags.push('Overdue release date');
  if (row.verification_status === 'pending_upload' && days !== null && days <= 1) flags.push('Missing verification close to release');
  if (row.verification_status === 'failed') flags.push('Validation failed');
  if (!row.latest_event_time) flags.push('No timeline activity yet');
  return flags;
}

export function ManagerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registry, setRegistry] = useState<OpsCargoRegistryResponse | null>(null);
  const [validation, setValidation] = useState<OpsValidationQueueResponse | null>(null);

  const refresh = async () => {
    const [r1, r2] = await Promise.all([getOpsCargoRegistry(), getOpsValidationQueue()]);
    setRegistry(r1);
    setValidation(r2);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [r1, r2] = await Promise.all([getOpsCargoRegistry(), getOpsValidationQueue()]);
        if (cancelled) return;
        setRegistry(r1);
        setValidation(r2);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const id = window.setInterval(() => {
      void refresh().catch(() => {
        // silent background refresh failures
      });
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const rows = useMemo<ManagerContainer[]>(() => {
    const byCargoId = new Map((validation?.items ?? []).map((i) => [i.cargo_id, i]));
    const flat = (registry?.groups ?? []).flatMap((g) =>
      g.cargos.map((c) => ({
        cargo_id: c.cargo_id,
        client_name: g.client_name,
        category: g.category,
        created_at: c.created_at,
        latest_event_type: c.latest_event_type,
        latest_event_time: c.latest_event_time,
        expected_release_date: g.expected_arrival_date ?? g.eta ?? null,
        verification_status: (byCargoId.get(c.cargo_id)?.validation_status ?? 'unknown') as ManagerContainer['verification_status'],
        validation_created_at: byCargoId.get(c.cargo_id)?.validation_created_at ?? null,
      }))
    );
    return flat;
  }, [registry, validation]);

  const enrichedRows = useMemo<EnrichedContainer[]>(() => {
    return rows.map((r) => {
      const state = deriveArrivalRelease(r.latest_event_type);
      const days = toDays(r.expected_release_date);
      return {
        ...r,
        arrival_state: state.arrival,
        release_state: state.release,
        days_to_release: days,
        recommended_action: decisionAction(days, state.release),
        pipeline_state: pipelineState(r),
        priority_level: priorityLevel(r),
      };
    });
  }, [rows]);

  const topPriority = useMemo(() => {
    return enrichedRows
      .map((r) => ({ ...r, score: priorityScore(r) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [enrichedRows]);

  const risks = useMemo(() => {
    return enrichedRows
      .flatMap((r) => riskFlags(r).map((flag) => ({ cargo_id: r.cargo_id, client_name: r.client_name, flag })))
      .slice(0, 20);
  }, [enrichedRows]);

  const grouped = useMemo(() => {
    return {
      ready_dispatch: enrichedRows.filter((r) => r.pipeline_state === 'ready_dispatch'),
      releasing_soon: enrichedRows.filter((r) => r.pipeline_state === 'releasing_soon'),
      waiting: enrichedRows.filter((r) => r.pipeline_state === 'waiting'),
      in_transit: enrichedRows.filter((r) => r.pipeline_state === 'in_transit'),
    };
  }, [enrichedRows]);

  const actionPanel = useMemo(() => {
    const releasedCount = grouped.ready_dispatch.length;
    const releasingTomorrowCount = enrichedRows.filter((r) => r.days_to_release === 1).length;
    const delayedVerificationCount = enrichedRows.filter((r) => r.verification_status === 'failed').length;
    return { releasedCount, releasingTomorrowCount, delayedVerificationCount };
  }, [grouped.ready_dispatch.length, enrichedRows]);

  const renderPipelineTable = (title: string, items: EnrichedContainer[]) => (
    <div className="bg-card border rounded-lg" style={{ borderColor: 'var(--border)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2>{title}</h2>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-4 text-sm opacity-60">No containers in this stage.</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left opacity-70">
                <th className="px-4 py-3">Container</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const badge = priorityBadge(r.priority_level);
                const statusLabel = r.release_state === 'released'
                  ? 'Released'
                  : r.days_to_release === null
                    ? 'Not released'
                    : `Release in ${r.days_to_release} day${r.days_to_release === 1 ? '' : 's'}`;
                return (
                  <tr key={`${title}-${r.cargo_id}`} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-3 font-mono">{r.cargo_id}</td>
                    <td className="px-4 py-3">{r.client_name}</td>
                    <td className="px-4 py-3">{statusLabel}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: badge.bg, color: badge.color, fontWeight: 700 }}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ fontWeight: 600 }}>{r.recommended_action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1>Manager Dashboard</h1>
        <p className="text-sm opacity-60 mt-2">Single-company monitoring for all client cargo activity (real-time refresh every 30s)</p>
      </div>

      {loading ? (
        <div className="bg-card rounded-lg border p-6 text-sm opacity-60" style={{ borderColor: 'var(--border)' }}>Loading manager dashboard...</div>
      ) : error ? (
        <div className="bg-card rounded-lg border p-6 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--destructive)' }}>{error}</div>
      ) : (
        <>
          <div className="bg-card border rounded-lg p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Siren className="w-4 h-4" style={{ color: 'rgb(220, 38, 38)' }} />
              <h2>ACTION REQUIRED</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div>🚛 {actionPanel.releasedCount} containers released → assign trucks</div>
              <div>⚠️ {actionPanel.releasingTomorrowCount} containers releasing tomorrow → pre-assign</div>
              <div>❗ {actionPanel.delayedVerificationCount} delayed verification → fix</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border rounded-lg p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs opacity-60">Total Containers</div>
              <div className="text-3xl mt-2">{enrichedRows.length}</div>
            </div>
            <div className="bg-card border rounded-lg p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs opacity-60">Validated</div>
              <div className="text-3xl mt-2">{enrichedRows.filter((r) => r.verification_status === 'validated').length}</div>
            </div>
            <div className="bg-card border rounded-lg p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs opacity-60">Pending Upload</div>
              <div className="text-3xl mt-2">{enrichedRows.filter((r) => r.verification_status === 'pending_upload').length}</div>
            </div>
            <div className="bg-card border rounded-lg p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs opacity-60">Risk Alerts</div>
              <div className="text-3xl mt-2">{risks.length}</div>
            </div>
          </div>

          <div className="bg-card border rounded-lg" style={{ borderColor: 'var(--border)' }}>
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
              <PackageSearch className="w-4 h-4" />
              <h2>Monitoring Layer</h2>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left opacity-70">
                    <th className="px-4 py-3">Container</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Arrival</th>
                    <th className="px-4 py-3">Verification</th>
                    <th className="px-4 py-3">Release</th>
                    <th className="px-4 py-3">Expected Release</th>
                    <th className="px-4 py-3">Days Left</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedRows.map((r) => {
                    const state = deriveArrivalRelease(r.latest_event_type);
                    const days = toDays(r.expected_release_date);
                    const badge = priorityBadge(r.priority_level);
                    return (
                      <tr key={r.cargo_id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-4 py-3 font-mono">{r.cargo_id}</td>
                        <td className="px-4 py-3">{r.client_name}</td>
                        <td className="px-4 py-3">{formatLabel(state.arrival)}</td>
                        <td className="px-4 py-3">{formatLabel(r.verification_status)}</td>
                        <td className="px-4 py-3">{formatLabel(state.release)}</td>
                        <td className="px-4 py-3">{r.expected_release_date ? new Date(r.expected_release_date).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: badge.bg, color: badge.color, fontWeight: 700 }}>
                            {days === null ? '—' : days}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border rounded-lg" style={{ borderColor: 'var(--border)' }}>
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
                <Clock3 className="w-4 h-4" />
                <h2>Decision Engine</h2>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {enrichedRows.slice(0, 12).map((r) => {
                  return (
                    <div key={`decision-${r.cargo_id}`} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-sm">{r.cargo_id}</div>
                        <div className="text-xs opacity-60">{r.client_name}</div>
                      </div>
                      <div className="text-sm">{r.recommended_action}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-card border rounded-lg" style={{ borderColor: 'var(--border)' }}>
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
                <ArrowUpRight className="w-4 h-4" />
                <h2>Priority Queue</h2>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {topPriority.map((r) => (
                  <div key={`prio-${r.cargo_id}`} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm">{r.cargo_id}</div>
                      <div className="text-xs opacity-60">{r.client_name} · {formatLabel(r.verification_status)}</div>
                    </div>
                    <div className="text-sm">Score {r.score}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {renderPipelineTable('🚨 Ready to Dispatch', grouped.ready_dispatch)}
          {renderPipelineTable('⚠️ Releasing Soon', grouped.releasing_soon)}
          {renderPipelineTable('🕒 Waiting', grouped.waiting)}
          {renderPipelineTable('🚛 In Transit', grouped.in_transit)}

          <div className="bg-card border rounded-lg" style={{ borderColor: 'var(--border)' }}>
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
              <AlertTriangle className="w-4 h-4" />
              <h2>Risk Detection</h2>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {risks.length === 0 ? (
                <div className="px-4 py-4 text-sm opacity-60">No active risks detected.</div>
              ) : (
                risks.map((r, idx) => (
                  <div key={`${r.cargo_id}-${idx}`} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm">{r.cargo_id}</div>
                      <div className="text-xs opacity-60">{r.client_name}</div>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--destructive)' }}>{r.flag}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
