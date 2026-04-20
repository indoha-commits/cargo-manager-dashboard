import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet';
import { Badge } from '@/app/components/ui/badge';
import { getOpsCargoTimeline, type OpsCargoTimelineResponse } from '@/app/api/ops';
import type { ManagerContainer } from './data';
import { eventTypeLabel, MILESTONE_ORDER, milestoneProgress } from './data';
import {
  Package,
  Ship,
  MapPin,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Calendar,
  User,
  Anchor,
} from 'lucide-react';

interface ContainerDetailDrawerProps {
  container: ManagerContainer | null;
  open: boolean;
  onClose: () => void;
}

function DocStatusIcon({ status }: { status: string }) {
  if (status === 'VERIFIED') return <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />;
  if (status === 'UPLOADED') return <Clock className="size-4 text-amber-500 shrink-0" />;
  if (status === 'REJECTED') return <XCircle className="size-4 text-red-500 shrink-0" />;
  return <AlertCircle className="size-4 text-muted-foreground/60 shrink-0" />;
}

function docTypeLabel(dt: string): string {
  const map: Record<string, string> = {
    BILL_OF_LADING: 'Bill of Lading',
    PACKING_LIST: 'Packing List',
    COMMERCIAL_INVOICE: 'Commercial Invoice',
    CERTIFICATE_OF_ORIGIN: 'Certificate of Origin',
    CUSTOMS_DECLARATION: 'Customs Declaration',
    ASSESSMENT: 'Assessment',
    DECLARATION_DRAFT: 'Declaration Draft',
    WH7_DOC: 'WH7 Document',
    EXIT_NOTE: 'Exit Note',
    CHANGE_OF_OWNERSHIP: 'Change of Ownership',
    IM8: 'IM8',
  };
  return map[dt] ?? dt.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function approvalStatusBadge(status: string): { label: string; className: string } {
  if (status === 'APPROVED') return { label: 'Approved', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
  if (status === 'REJECTED') return { label: 'Rejected', className: 'bg-red-500/15 text-red-700 dark:text-red-400' };
  if (status === 'PENDING') return { label: 'Pending', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
  return { label: status, className: 'bg-muted text-muted-foreground' };
}

export function ContainerDetailDrawer({ container, open, onClose }: ContainerDetailDrawerProps) {
  const [timeline, setTimeline] = useState<OpsCargoTimelineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!container || !open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTimeline(null);
    getOpsCargoTimeline(container.cargo_id)
      .then((data) => {
        if (!cancelled) setTimeline(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [container, open]);

  const progress = milestoneProgress(container?.latest_event_type ?? null);
  const progressIdx = container?.latest_event_type
    ? MILESTONE_ORDER.indexOf(container.latest_event_type as typeof MILESTONE_ORDER[number])
    : -1;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col overflow-hidden"
      >
        {container && (
          <>
            {/* Header */}
            <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                  <Package className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="font-mono text-base font-semibold leading-tight">
                    {container.cargo_id}
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    BoL: <span className="font-mono">{container.bill_of_lading}</span>
                  </p>
                </div>
                <PriorityChip priority={container.priority_level} />
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              {/* Meta info cards */}
              <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <MetaItem icon={<User className="size-3.5" />} label="Client" value={container.client_name} />
                <MetaItem icon={<FileText className="size-3.5" />} label="Category" value={container.category ?? '—'} />
                <MetaItem icon={<Anchor className="size-3.5" />} label="Vessel" value={container.vessel ?? '—'} />
                <MetaItem
                  icon={<Calendar className="size-3.5" />}
                  label="ETA"
                  value={
                    container.expected_release_date
                      ? new Date(container.expected_release_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'
                  }
                />
                {container.origin && (
                  <MetaItem icon={<MapPin className="size-3.5" />} label="Origin" value={container.origin} />
                )}
                {container.destination && (
                  <MetaItem icon={<MapPin className="size-3.5" />} label="Destination" value={container.destination} />
                )}
              </div>

              {/* Route */}
              {(container.origin || container.destination) && (
                <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 text-sm">
                    <Ship className="size-4 text-muted-foreground" />
                    <span className="font-medium">{container.origin ?? '?'}</span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <span className="font-medium">{container.destination ?? '?'}</span>
                    {container.route && (
                      <span className="text-muted-foreground text-xs">via {container.route}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Milestone progress */}
              <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shipment Progress</span>
                  <span className="text-xs text-muted-foreground">{progress}%</span>
                </div>
                <div className="relative">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                        background: progress === 100 ? 'rgb(34,197,94)' : progress > 60 ? 'rgb(59,130,246)' : 'rgb(245,158,11)',
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-3 gap-1">
                    {MILESTONE_ORDER.map((m, idx) => (
                      <div key={m} className="flex flex-col items-center flex-1 min-w-0">
                        <div
                          className="w-2 h-2 rounded-full mb-1"
                          style={{
                            backgroundColor: idx <= progressIdx
                              ? (progressIdx === idx ? 'rgb(59,130,246)' : 'rgb(34,197,94)')
                              : 'var(--border)',
                          }}
                        />
                        <span className="text-[9px] text-muted-foreground text-center leading-tight hidden sm:block truncate w-full" style={{ fontSize: '9px' }}>
                          {eventTypeLabel(m).split(' ')[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 text-sm font-medium">
                  {eventTypeLabel(container.latest_event_type)}
                </div>
                {container.latest_event_time && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Last updated {new Date(container.latest_event_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                )}
              </div>

              {/* Timeline body from API */}
              {loading && (
                <div className="px-6 py-8 text-sm text-muted-foreground animate-pulse">Loading details…</div>
              )}
              {error && (
                <div className="px-6 py-4 text-sm text-destructive">{error}</div>
              )}
              {timeline && (
                <>
                  {/* Documents */}
                  {timeline.documents.length > 0 && (
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-3">Documents</span>
                      <div className="space-y-2">
                        {timeline.documents.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-2">
                            <DocStatusIcon status={doc.status} />
                            <span className="text-sm flex-1 min-w-0 truncate">{docTypeLabel(doc.document_type)}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{doc.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Approvals */}
                  {timeline.approvals.length > 0 && (
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-3">Approvals</span>
                      <div className="space-y-2">
                        {timeline.approvals.map((ap) => {
                          const badge = approvalStatusBadge(ap.status);
                          return (
                            <div key={ap.id} className="flex items-center gap-2">
                              <span className="text-sm flex-1 min-w-0">{docTypeLabel(ap.kind)}</span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Event log */}
                  {timeline.events.length > 0 && (
                    <div className="px-6 py-4">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-3">Event Log</span>
                      <div className="relative pl-4 border-l-2" style={{ borderColor: 'var(--border)' }}>
                        {[...timeline.events].reverse().map((ev, idx) => (
                          <div key={ev.id} className={`relative ${idx > 0 ? 'mt-4' : ''}`}>
                            <div
                              className="absolute -left-[1.3rem] w-2.5 h-2.5 rounded-full border-2 border-background"
                              style={{ backgroundColor: idx === 0 ? 'rgb(59,130,246)' : 'var(--muted-foreground)', top: '4px' }}
                            />
                            <div className="text-sm font-medium">{eventTypeLabel(ev.event_type)}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {new Date(ev.event_time).toLocaleDateString('en-GB', {
                                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </div>
                            {ev.notes && (
                              <div className="text-xs text-muted-foreground mt-1 bg-muted rounded px-2 py-1">{ev.notes}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}

function PriorityChip({ priority }: { priority: 'red' | 'yellow' | 'green' }) {
  if (priority === 'red') return <Badge variant="destructive" className="shrink-0 text-xs">ACTION NOW</Badge>;
  if (priority === 'yellow') return <Badge className="shrink-0 text-xs bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0">PREPARE</Badge>;
  return <Badge className="shrink-0 text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0">STABLE</Badge>;
}
