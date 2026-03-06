import { fetchJson } from './client';

export type MeResponse = {
  id: string;
  email: string;
  role: 'client' | 'ops' | 'admin';
  client_id: string | null;
};

export async function getMe(): Promise<MeResponse> {
  return await fetchJson<MeResponse>('/me');
}

export type ClaimInternalSessionResponse =
  | { ok: true; session_id: string; expires_at: string }
  | { ok: false; error: 'session_locked'; detail: string };

export async function claimInternalSession(sessionId: string): Promise<ClaimInternalSessionResponse> {
  return await fetchJson<ClaimInternalSessionResponse>('/ops/internal-session/claim', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function heartbeatInternalSession(sessionId: string): Promise<{ ok: true; expires_at: string }> {
  return await fetchJson<{ ok: true; expires_at: string }>('/ops/internal-session/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function releaseInternalSession(sessionId: string): Promise<{ ok: true }> {
  return await fetchJson<{ ok: true }>('/ops/internal-session/release', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export type OpsDashboardResponse = {
  kpis: {
    pending_documents: number;
    pending_validation: number;
    awaiting_upload: number;
    failed_validation: number;
  };
  urgent_documents: Array<{
    id: string;
    cargo_id: string;
    document_type: string;
    status: string;
    drive_url: string | null;
    uploaded_at: string | null;
    client_id: string | null;
    client_name: string | null;
  }>;
};

export async function getOpsDashboard(): Promise<OpsDashboardResponse> {
  return await fetchJson<OpsDashboardResponse>('/ops/dashboard');
}

export type OpsPendingDocumentsResponse = {
  documents: Array<{
    id: string;
    cargo_id: string;
    document_type: string;
    status: string;
    drive_url: string | null;
    uploaded_at: string | null;
    client_id: string | null;
    client_name: string | null;
    rejection_reason?: string | null;
  }>;
};

export async function getOpsPendingDocuments(): Promise<OpsPendingDocumentsResponse> {
  return await fetchJson<OpsPendingDocumentsResponse>('/ops/pending-documents');
}

export type OpsCargoRegistryResponse = {
  rows: Array<{
    client_id: string;
    client_name: string;
    cargo_id: string;
    created_at: string;
    latest_event_type: string | null;
    latest_event_time: string | null;
  }>;
};

export async function getOpsCargoRegistry(): Promise<OpsCargoRegistryResponse> {
  return await fetchJson<OpsCargoRegistryResponse>('/ops/cargo-registry');
}

export type OpsCargoTimelineResponse = {
  cargo: {
    id: string;
    client_id: string;
    client_name: string;
    category: string;
    created_at: string;
  };
  documents: Array<{
    id: string;
    document_type: string;
    status: string;
    uploaded_at: string | null;
    verified_at: string | null;
    drive_url: string | null;
  }>;
  events: Array<{
    id: string;
    event_type: string;
    event_time: string;
    notes: string | null;
    recorded_at: string;
  }>;
  approvals: Array<{
    id: string;
    kind: string;
    status: string;
    file_url: string | null;
    file_path: string | null;
    created_at: string;
    decided_at: string | null;
    rejection_reason: string | null;
  }>;
};

export async function getOpsCargoTimeline(cargoId: string): Promise<OpsCargoTimelineResponse> {
  return await fetchJson<OpsCargoTimelineResponse>(`/ops/cargo/${encodeURIComponent(cargoId)}/timeline`);
}

export type OpsActivityLogResponse = {
  rows: Array<{
    timestamp: string;
    action: string;
    cargoId?: string;
    eventType?: string;
    actorRole: string;
  }>;
};

export async function getOpsActivityLog(): Promise<OpsActivityLogResponse> {
  return await fetchJson<OpsActivityLogResponse>('/ops/activity-log');
}

export type OpsValidationQueueItem = {
  cargo_id: string;
  client_id: string;
  client_name: string;
  documents: Array<{
    id: string;
    document_type: string;
    uploaded_at: string | null;
    verified_at: string | null;
    status: 'REQUIRED' | 'UPLOADED' | 'VERIFIED';
    drive_url: string | null;
  }>;
  assessment: {
    id: string;
    cargo_id: string;
    kind: 'ASSESSMENT';
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    file_url: string | null;
    file_path: string | null;
    created_at: string;
    decided_at: string | null;
    rejection_reason: string | null;
  } | null;
  draft: {
    id: string;
    cargo_id: string;
    kind: 'DECLARATION_DRAFT';
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    file_url: string | null;
    file_path: string | null;
    created_at: string;
    decided_at: string | null;
    rejection_reason: string | null;
  } | null;
  validation_status: 'pending_upload' | 'pending_validation' | 'validated' | 'failed';
  wh7: {
    id: string;
    cargo_id: string;
    kind: 'WH7_DOC';
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    file_url: string | null;
    file_path: string | null;
    created_at: string;
    decided_at: string | null;
    rejection_reason: string | null;
  } | null;
  exit_note: {
    id: string;
    cargo_id: string;
    kind: 'EXIT_NOTE';
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    file_url: string | null;
    file_path: string | null;
    created_at: string;
    decided_at: string | null;
    rejection_reason: string | null;
  } | null;
  validation_created_at: string | null;
  validation_completed_at: string | null;
  failure_reason: string | null;
};

export type OpsValidationQueueResponse = {
  items: OpsValidationQueueItem[];
};

export async function getOpsValidationQueue(): Promise<OpsValidationQueueResponse> {
  return await fetchJson<OpsValidationQueueResponse>('/ops/validation-queue');
}

export type OpsVerifyDocumentRequest = {
  document_id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string;
};

export type OpsVerifyDocumentResponse = {
  ok: boolean;
};

export async function verifyDocument(payload: OpsVerifyDocumentRequest): Promise<OpsVerifyDocumentResponse> {
  return await fetchJson<OpsVerifyDocumentResponse>('/ops/verify-document', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type OpsSignedUrlResponse = {
  url: string;
  kind: 'drive' | 'storage';
  expires_in?: number;
};

export async function getOpsDocumentSignedUrl(documentId: string): Promise<OpsSignedUrlResponse> {
  return await fetchJson<OpsSignedUrlResponse>(`/ops/documents/${encodeURIComponent(documentId)}/signed-url`);
}

export async function getOpsApprovalSignedUrl(approvalId: string): Promise<OpsSignedUrlResponse> {
  return await fetchJson<OpsSignedUrlResponse>(`/ops/approvals/${encodeURIComponent(approvalId)}/signed-url`);
}

export type OpsClientsResponse = {
  clients: Array<{ id: string; name: string }>;
};

export async function getOpsClients(category?: string): Promise<OpsClientsResponse> {
  const path = category ? `/ops/clients?category=${encodeURIComponent(category)}` : '/ops/clients';
  return await fetchJson<OpsClientsResponse>(path);
}

export type OpsCreateClientRequest = {
  name: string;
  email: string;
  password: string;
};

export type OpsCreateClientResponse = {
  client: { id: string; name: string };
  user: { id: string; email: string };
};

export async function createOpsClient(payload: OpsCreateClientRequest): Promise<OpsCreateClientResponse> {
  return await fetchJson<OpsCreateClientResponse>('/ops/clients', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type OpsCreateCargoRequest = {
  client_id: string;
  container_id: string;
  expected_arrival_date: string;
  category: 'ELECTRONICS' | 'RAW_MATERIALS' | 'MEDS_BEVERAGE';
  required_documents: string[];
  container_count?: number;
  destination?: string | null;
  origin?: string | null;
};

export type OpsCreateCargoResponse = { cargo_id: string; container_id: string | null };

export async function createOpsCargo(payload: OpsCreateCargoRequest): Promise<OpsCreateCargoResponse> {
  return await fetchJson<OpsCreateCargoResponse>('/ops/cargo', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type OpsDeleteCargoResponse = { ok: boolean; cargo_id: string };

export async function deleteOpsCargo(cargoId: string): Promise<OpsDeleteCargoResponse> {
  return await fetchJson<OpsDeleteCargoResponse>(`/ops/cargo/${encodeURIComponent(cargoId)}`, {
    method: 'DELETE',
  });
}

export type OpsCreateApprovalUploadUrlRequest = {
  kind: 'ASSESSMENT' | 'DECLARATION_DRAFT' | 'WH7_DOC' | 'EXIT_NOTE';
  file_name: string;
};

export type OpsCreateApprovalUploadUrlResponse = {
  path: string;
  upload_url: string;
  expires_in?: number;
  approval_id?: string;
};

export async function createOpsApprovalUploadUrl(
  cargoId: string,
  payload: OpsCreateApprovalUploadUrlRequest
): Promise<OpsCreateApprovalUploadUrlResponse> {
  return await fetchJson<OpsCreateApprovalUploadUrlResponse>(
    `/ops/cargo/${encodeURIComponent(cargoId)}/approvals/upload-url`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export type OpsCreateCargoApprovalRequest = {
  kind: 'ASSESSMENT' | 'DECLARATION_DRAFT' | 'WH7_DOC' | 'EXIT_NOTE';
  file_url?: string | null;
  file_path?: string | null;
  notes?: string | null;
};

export type OpsCreateCargoApprovalResponse = {
  approval: {
    id: string;
    cargo_id: string;
    kind: 'ASSESSMENT' | 'DECLARATION_DRAFT' | 'WH7_DOC' | 'EXIT_NOTE';
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    file_url: string | null;
    file_path: string | null;
    notes: string | null;
    created_at: string;
    created_by: string;
    decided_at: string | null;
    decided_by: string | null;
    rejection_reason: string | null;
  };
};

export async function createOpsCargoApproval(
  cargoId: string,
  payload: OpsCreateCargoApprovalRequest
): Promise<OpsCreateCargoApprovalResponse> {
  return await fetchJson<OpsCreateCargoApprovalResponse>(`/ops/cargo/${encodeURIComponent(cargoId)}/approvals`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
