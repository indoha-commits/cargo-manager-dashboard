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

// ── SUCOMO: Summarized Container Movement ─────────────────────────────────────
// These are the 7 real operational milestones used in the logistics observatory.
// Stage numbers match the SUCOMO chart (1 = final delivery, 7 = earliest stage).

export const SUCOMO_STAGES = [
  { id: 'VESSEL_ARRIVAL_AWAITED', label: 'Vessel Arrival at Port Awaited', score: 7, accent: 'slate' },
  { id: 'AWAIT_DISCHARGE',        label: 'Await Discharge',                score: 6, accent: 'blue'  },
  { id: 'SCT_LOADING_AWAITED',    label: 'SCT Loading Awaited',            score: 5, accent: 'violet'},
  { id: 'UNDER_ICD_TRANSFER',     label: 'Under ICD Transfer',             score: 4, accent: 'amber' },
  { id: 'UNDER_PORT_CLEARANCE',   label: 'Under Port Clearance',           score: 3, accent: 'orange'},
  { id: 'LOADED_ON_WAY',          label: 'Loaded & On Way',                score: 2, accent: 'sky'   },
  { id: 'ARRIVED_AT_CONSIGNEE',   label: 'Arrived at Consignee',           score: 1, accent: 'green' },
] as const;

export type SucomoStageId = typeof SUCOMO_STAGES[number]['id'];

// Maps any event type (new SUCOMO or legacy) → canonical SUCOMO stage id
const EVENT_TO_SUCOMO: Record<string, SucomoStageId> = {
  // Native SUCOMO codes
  VESSEL_ARRIVAL_AWAITED: 'VESSEL_ARRIVAL_AWAITED',
  AWAIT_DISCHARGE:        'AWAIT_DISCHARGE',
  SCT_LOADING_AWAITED:    'SCT_LOADING_AWAITED',
  UNDER_ICD_TRANSFER:     'UNDER_ICD_TRANSFER',
  UNDER_PORT_CLEARANCE:   'UNDER_PORT_CLEARANCE',
  LOADED_ON_WAY:          'LOADED_ON_WAY',
  ARRIVED_AT_CONSIGNEE:   'ARRIVED_AT_CONSIGNEE',

  // Legacy event type aliases
  REGISTERED:            'VESSEL_ARRIVAL_AWAITED',
  DOCS_VERIFIED:         'AWAIT_DISCHARGE',
  PHYSICAL_VERIFICATION: 'UNDER_PORT_CLEARANCE',
  DEPARTED_PORT:         'SCT_LOADING_AWAITED',
  IN_ROUTE_RUSUMO:       'UNDER_ICD_TRANSFER',
  RELEASE:               'LOADED_ON_WAY',
  WAREHOUSE_ARRIVAL:     'ARRIVED_AT_CONSIGNEE',
  DISPATCH:              'ARRIVED_AT_CONSIGNEE',
};

export function toSucomoStage(eventType: string | null): SucomoStageId {
  if (!eventType) return 'VESSEL_ARRIVAL_AWAITED';
  return EVENT_TO_SUCOMO[eventType] ?? 'VESSEL_ARRIVAL_AWAITED';
}

export const MILESTONE_ORDER = [
  'VESSEL_ARRIVAL_AWAITED',
  'AWAIT_DISCHARGE',
  'SCT_LOADING_AWAITED',
  'UNDER_ICD_TRANSFER',
  'UNDER_PORT_CLEARANCE',
  'LOADED_ON_WAY',
  'ARRIVED_AT_CONSIGNEE',
] as const;

export function eventTypeLabel(eventType: string | null): string {
  if (!eventType) return 'Vessel Arrival Awaited';
  const stageId = EVENT_TO_SUCOMO[eventType] ?? eventType;
  const stage = SUCOMO_STAGES.find((s) => s.id === stageId);
  if (stage) return stage.label;
  return eventType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function milestoneProgress(eventType: string | null): number {
  const stageId = toSucomoStage(eventType);
  const idx = MILESTONE_ORDER.indexOf(stageId as typeof MILESTONE_ORDER[number]);
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
  const stage = toSucomoStage(latestEventType);
  if (stage === 'ARRIVED_AT_CONSIGNEE' || stage === 'LOADED_ON_WAY') return { arrival: 'arrived', release: 'released' };
  if (stage === 'UNDER_ICD_TRANSFER' || stage === 'SCT_LOADING_AWAITED') return { arrival: 'in_transit', release: 'not_released' };
  return { arrival: 'processing', release: 'not_released' };
}

export function decisionAction(daysToRelease: number | null, latestEventType: string | null): string {
  const stage = toSucomoStage(latestEventType);
  if (stage === 'ARRIVED_AT_CONSIGNEE') return 'Confirm delivery';
  if (stage === 'LOADED_ON_WAY') return 'Track shipment';
  if (stage === 'UNDER_PORT_CLEARANCE') return 'Monitor clearance';
  if (stage === 'UNDER_ICD_TRANSFER') return 'Monitor ICD';
  if (stage === 'SCT_LOADING_AWAITED') return 'Confirm SCT loading';
  if (stage === 'AWAIT_DISCHARGE') return 'Await discharge';
  if (daysToRelease !== null && daysToRelease <= 0) return 'Escalate — overdue';
  if (daysToRelease !== null && daysToRelease <= 2) return 'Pre-assign truck';
  return 'Wait — vessel en route';
}

export function pipelineState(latestEventType: string | null, daysToRelease: number | null): PipelineState {
  const stage = toSucomoStage(latestEventType);
  if (stage === 'ARRIVED_AT_CONSIGNEE') return 'ready_dispatch';
  if (stage === 'LOADED_ON_WAY' || stage === 'UNDER_ICD_TRANSFER') return 'in_transit';
  if (daysToRelease !== null && daysToRelease <= 2) return 'releasing_soon';
  return 'waiting';
}

export function priorityLevel(latestEventType: string | null, daysToRelease: number | null): PriorityLevel {
  const stage = toSucomoStage(latestEventType);
  if (stage === 'ARRIVED_AT_CONSIGNEE') return 'red'; // needs immediate truck assignment
  if (stage === 'LOADED_ON_WAY') return 'yellow';
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
          recommended_action: decisionAction(days, c.latest_event_type),
          pipeline_state: pipelineState(c.latest_event_type, days),
          priority_level: priorityLevel(c.latest_event_type, days),
          created_at: c.created_at,
        };
      })
    );
  }, [registry, validation]);

  return { loading, error, rows };
}
