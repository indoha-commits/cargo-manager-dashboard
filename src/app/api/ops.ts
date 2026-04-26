import { fetchJson } from './client';

export type MeResponse = {
  id: string;
  email: string;
  role: 'client' | 'ops' | 'admin' | 'manager';
  client_id: string | null;
  tenant_id?: string | null;
  dashboard_type?: string | null;
  membership_status?: string | null;
};

export async function getMe(): Promise<MeResponse> {
  return await fetchJson<MeResponse>('/me?prefer_dashboard=manager');
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
    bill_of_lading: string | null;
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
  groups: Array<{
    shipment_id?: string;
    bill_of_lading: string;
    client_id: string;
    client_name: string;
    category: string | null;
    container_count: number;
    origin: string | null;
    destination: string | null;
    route: string | null;
    vessel: string | null;
    expected_arrival_date: string | null;
    eta: string | null;
    dmc?: string | null;
    service_scope?: string | null;
    price?: number | null;
    revenue?: number | null;
    cost?: number | null;
    profit?: number | null;
    due_payment_date?: string | null;
    created_at: string;
    updated_at: string;
    cargos: Array<{
      cargo_id: string;
      cargo_uuid: string;
      created_at: string;
      latest_event_type: string | null;
      latest_event_time: string | null;
    }>;
  }>;
};

export async function getOpsCargoRegistry(): Promise<OpsCargoRegistryResponse> {
  return await fetchJson<OpsCargoRegistryResponse>('/ops/cargo-registry');
}

export type ManagerShipmentsRow = {
  shipment_id: string;
  shipment_ref: string;
  client_id: string;
  client_name: string;
  date: string;
  dmc: string | null;
  service_scope: 'LOGISTICS_AND_CLEARING' | 'CLEARING_ONLY' | string;
  price: number;
  revenue: number;
  cost: number;
  profit: number;
  status: string;
  expected_arrival_date: string | null;
  due_payment_date: string | null;
  paid_amount: number;
  outstanding_amount: number;
};

export async function getManagerShipments(): Promise<{ rows: ManagerShipmentsRow[] }> {
  return await fetchJson<{ rows: ManagerShipmentsRow[] }>('/ops/manager/shipments');
}

export type ManagerReceivableRow = {
  client_id: string;
  client_name: string;
  total_revenue: number;
  paid: number;
  outstanding: number;
  oldest_due_date: string | null;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | string;
};

export async function getManagerReceivables(): Promise<{ rows: ManagerReceivableRow[] }> {
  return await fetchJson<{ rows: ManagerReceivableRow[] }>('/ops/manager/receivables');
}

export type ManagerPaymentRow = {
  id: string;
  client_id: string;
  client_name: string;
  client_billing_email: string | null;
  cargo_group_id: string | null;
  invoice_number: string | null;
  shipment_ref: string | null;
  dmc: string | null;
  line_items: InvoiceLineItem[] | null;
  amount: number;
  currency: string;
  paid_at: string;
  next_billing_date: string | null;
  method: string;
  reference: string | null;
  notes: string | null;
  email_sent: boolean;
  created_at: string;
};

export type InvoiceLineItem = {
  description: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type CreatePaymentPayload = {
  client_id: string;
  cargo_group_id?: string;
  invoice_number?: string;
  shipment_ref?: string;
  dmc?: string;
  line_items?: InvoiceLineItem[];
  amount: number;
  currency?: string;
  paid_at?: string;
  next_billing_date?: string;
  method?: string;
  reference?: string;
  notes?: string;
};

export async function getManagerPayments(): Promise<{ rows: ManagerPaymentRow[] }> {
  return await fetchJson<{ rows: ManagerPaymentRow[] }>('/ops/manager/payments');
}

export type BillingCycleRow = {
  id: string;
  client_id: string;
  client_name: string;
  client_tin: string | null;
  cycle_start_date: string;
  next_billing_date: string;
  price_per_dmc: number;
  status: 'pending' | 'billed' | 'cancelled';
  billed_at: string | null;
  billed_container_count: number | null;
  billed_invoice_amount: number | null;
};

export async function getBillingCycles(): Promise<{ cycles: BillingCycleRow[] }> {
  return await fetchJson<{ cycles: BillingCycleRow[] }>('/ops/manager/billing-cycles');
}

export async function openInvoiceWindow(paymentId: string): Promise<void> {
  // Fetches the printable invoice HTML (with auth headers) and opens it in a new tab.
  const { getBaseUrl, getAuthHeader } = await import('./client');
  const url = `${getBaseUrl()}/ops/manager/payments/${encodeURIComponent(paymentId)}/invoice`;
  const res = await fetch(url, { headers: getAuthHeader() });
  if (!res.ok) throw new Error(`invoice_fetch_failed:${res.status}`);
  const html = await res.text();
  const blob = new Blob([html], { type: 'text/html' });
  const objectUrl = URL.createObjectURL(blob);
  const win = window.open(objectUrl, '_blank');
  // Revoke after a short delay so the tab has time to load
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  if (!win) throw new Error('popup_blocked');
}

export async function sendPaymentInvoice(
  paymentId: string,
  email: string,
  saveEmail: boolean
): Promise<{ ok: true; email_sent_to: string; billing_email_saved: boolean }> {
  return await fetchJson(`/ops/manager/payments/${encodeURIComponent(paymentId)}/send-invoice`, {
    method: 'POST',
    body: JSON.stringify({ email, save_email: saveEmail }),
  });
}

export async function createManagerPayment(
  payload: CreatePaymentPayload
): Promise<{ payment: ManagerPaymentRow; email_sent: boolean }> {
  return await fetchJson('/ops/manager/payments/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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

export async function recordOpsCargoEvent(cargoId: string, eventType: string): Promise<{ event: any }> {
  return await fetchJson<{ event: any }>(`/ops/cargo/${encodeURIComponent(cargoId)}/timeline`, {
    method: 'POST',
    body: JSON.stringify({ event_type: eventType }),
  });
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
  im8: {
    id: string;
    cargo_id: string;
    kind: 'IM8';
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

export async function deleteOpsClient(clientId: string): Promise<{ ok: true }> {
  return await fetchJson<{ ok: true }>(`/ops/clients/${encodeURIComponent(clientId)}`, {
    method: 'DELETE',
  });
}

export async function addOpsClientUser(clientId: string, email: string, password: string): Promise<{ ok: true; userId: string; email: string }> {
  return await fetchJson<{ ok: true; userId: string; email: string }>(`/ops/clients/${encodeURIComponent(clientId)}/users`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function createOpsClient(payload: OpsCreateClientRequest): Promise<OpsCreateClientResponse> {
  return await fetchJson<OpsCreateClientResponse>('/ops/clients', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type OpsCreateCargoRequest = {
  client_id: string;
  container_id: string;
  container_number: string;
  expected_arrival_date: string;
  category: 'ELECTRONICS' | 'RAW_MATERIALS' | 'MEDS_BEVERAGE';
  clearance_pathway?: 'PORT_CLEARANCE' | 'T1_TRANSIT';
  required_documents: string[];
  container_count?: number;
  destination?: string | null;
  origin?: string | null;
  bill_of_lading?: string | null;
};

export type OpsBulkCreateCargoRequest = {
  client_id: string;
  bill_of_lading: string;
  expected_arrival_date: string;
  category: 'ELECTRONICS' | 'RAW_MATERIALS' | 'MEDS_BEVERAGE';
  clearance_pathway?: 'PORT_CLEARANCE' | 'T1_TRANSIT';
  required_documents: string[];
  container_count: number;
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

export async function createOpsCargoBulk(payload: OpsBulkCreateCargoRequest): Promise<{ cargos: { id: string }[]; bill_of_lading: string }> {
  return await fetchJson<{ cargos: { id: string }[]; bill_of_lading: string }>('/ops/cargo/bulk', {
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

export async function deleteOpsCargoGroup(billOfLading: string): Promise<{ ok: boolean; bill_of_lading: string; deleted: number }> {
  return await fetchJson<{ ok: boolean; bill_of_lading: string; deleted: number }>(
    `/ops/cargo-group/${encodeURIComponent(billOfLading)}`,
    {
      method: 'DELETE',
    }
  );
}

export type OpsCreateApprovalUploadUrlRequest = {
  kind: 'ASSESSMENT' | 'DECLARATION_DRAFT' | 'WH7_DOC' | 'EXIT_NOTE' | 'IM8';
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
  kind: 'ASSESSMENT' | 'DECLARATION_DRAFT' | 'WH7_DOC' | 'EXIT_NOTE' | 'IM8';
  file_url?: string | null;
  file_path?: string | null;
  notes?: string | null;
};

export type OpsCreateCargoApprovalResponse = {
  approval: {
    id: string;
    cargo_id: string;
    kind: 'ASSESSMENT' | 'DECLARATION_DRAFT' | 'WH7_DOC' | 'EXIT_NOTE' | 'IM8';
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
