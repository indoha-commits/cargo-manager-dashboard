import { useEffect, useMemo, useState } from 'react';
import { getOpsCargoRegistry, getOpsValidationQueue, type OpsCargoRegistryResponse, type OpsValidationQueueResponse } from '@/app/api/ops';

export type PipelineState = 'ready_dispatch' | 'releasing_soon' | 'waiting' | 'in_transit';
export type PriorityLevel = 'red' | 'yellow' | 'green';

export type ManagerContainer = {
  cargo_id: string;
  cargo_uuid: string;
  client_name: string;
  client_id: string;
  bill_of_lading: string;
  category: string | null;
  origin: string | null;
  destination: string | null;
  route: string | null;
  vessel: string | null;
  latest_event_type: string | null;
  latest_event_time: string | null;
  expected_release_date: string | null;
  verification_status: 'validated' | 'pending_validation' | 'pending_upload' | 'failed' | 'unknown';
  days_to_release: number | null;
  recommended_action: string;
  pipeline_state: PipelineState;
  priority_level: PriorityLevel;
  created_at: string;
};

export const MILESTONE_ORDER = [
  'REGISTERED',
  'PHYSICAL_VERIFICATION',
  'DEPARTED_PORT',
  'IN_ROUTE_RUSUMO',
  'WAREHOUSE_ARRIVAL',
  'DISPATCH',
] as const;

export function eventTypeLabel(eventType: string | null): string {
  if (!eventType) return 'Not started';
  const map: Record<string, string> = {
    REGISTERED: 'Registered',
    PHYSICAL_VERIFICATION: 'Physical verification',
    DEPARTED_PORT: 'Departed port',
    IN_ROUTE_RUSUMO: 'In route — Rusumo',
    WAREHOUSE_ARRIVAL: 'Warehouse arrival',
    DISPATCH: 'Dispatched',
    DOCS_VERIFIED: 'Docs verified',
    RELEASE: 'Released',
  };
  return map[eventType] ?? eventType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function milestoneProgress(eventType: string | null): number {
  if (!eventType) return 0;
  const idx = MILESTONE_ORDER.indexOf(eventType as typeof MILESTONE_ORDER[number]);
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / MILESTONE_ORDER.length) * 100);
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - Date.parse(iso);
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function toDays(targetIso: string | null): number | null {
  if (!targetIso) return null;
  const now = Date.now();
  const target = Date.parse(targetIso);
  if (!Number.isFinite(target)) return null;
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export function deriveArrivalRelease(latestEventType: string | null): { arrival: string; release: string } {
  const event = latestEventType ?? '';
  if (event.includes('RELEASE') || event.includes('DISPATCH')) return { arrival: 'arrived', release: 'released' };
  if (event.includes('ARRIVAL') || event.includes('DEPARTED_PORT') || event.includes('IN_ROUTE')) return { arrival: 'in_transit', release: 'not_released' };
  return { arrival: 'processing', release: 'not_released' };
}

export function decisionAction(daysToRelease: number | null, releaseStatus: string): string {
  if (releaseStatus === 'released') return 'Dispatch NOW';
  if (daysToRelease === null) return 'Set release date';
  if (daysToRelease >= 3) return 'Wait';
  if (daysToRelease === 2) return 'Pre-assign truck';
  if (daysToRelease === 1) return 'Confirm truck';
  if (daysToRelease <= 0) return 'Escalate overdue release';
  return 'Monitor';
}

export function pipelineState(latestEventType: string | null, daysToRelease: number | null): PipelineState {
  const state = deriveArrivalRelease(latestEventType);
  if (state.release === 'released') return 'ready_dispatch';
  if (state.arrival === 'in_transit') return 'in_transit';
  if (daysToRelease !== null && daysToRelease <= 2) return 'releasing_soon';
  return 'waiting';
}

export function priorityLevel(latestEventType: string | null, daysToRelease: number | null): PriorityLevel {
  const state = deriveArrivalRelease(latestEventType);
  if (state.release === 'released') return 'red';
  if (daysToRelease !== null && daysToRelease <= 2) return 'yellow';
  return 'green';
}

export function useManagerData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registry, setRegistry] = useState<OpsCargoRegistryResponse | null>(null);
  const [validation, setValidation] = useState<OpsValidationQueueResponse | null>(null);

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

    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const rows = useMemo<ManagerContainer[]>(() => {
    const byCargoId = new Map((validation?.items ?? []).map((i) => [i.cargo_id, i]));
    return (registry?.groups ?? []).flatMap((g) =>
      g.cargos.map((c) => {
        const days = toDays(g.expected_arrival_date ?? g.eta ?? null);
        const release = deriveArrivalRelease(c.latest_event_type).release;
        return {
          cargo_id: c.cargo_id,
          cargo_uuid: c.cargo_uuid,
          client_name: g.client_name,
          client_id: g.client_id,
          bill_of_lading: g.bill_of_lading,
          category: g.category,
          origin: g.origin ?? null,
          destination: g.destination ?? null,
          route: g.route ?? null,
          vessel: g.vessel ?? null,
          latest_event_type: c.latest_event_type,
          latest_event_time: c.latest_event_time,
          expected_release_date: g.expected_arrival_date ?? g.eta ?? null,
          verification_status: (byCargoId.get(c.cargo_id)?.validation_status ?? 'unknown') as ManagerContainer['verification_status'],
          days_to_release: days,
          recommended_action: decisionAction(days, release),
          pipeline_state: pipelineState(c.latest_event_type, days),
          priority_level: priorityLevel(c.latest_event_type, days),
          created_at: c.created_at,
        };
      })
    );
  }, [registry, validation]);

  return { loading, error, rows };
}
