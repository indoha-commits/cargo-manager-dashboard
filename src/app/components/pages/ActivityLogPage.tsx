import { useEffect, useState } from 'react';
import { getOpsActivityLog, type OpsActivityLogResponse } from '@/app/api/ops';

type Row = OpsActivityLogResponse['rows'][number];

export function ActivityLogPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getOpsActivityLog();
        if (!cancelled) setRows(res.rows ?? []);
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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1>Activity Log</h1>
        <p className="text-sm opacity-60 mt-2">Audit trail and system accountability</p>
      </div>

      <div className="bg-card rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        {loading ? (
          <div className="px-6 py-8 text-sm opacity-60">Loading…</div>
        ) : error ? (
          <div className="px-6 py-8 text-sm" style={{ color: 'var(--destructive)' }}>
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-8 text-sm opacity-60">No activity yet.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {rows.map((entry, idx) => (
              <div key={idx} className="px-6 py-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-start gap-6">
                  <div className="w-48 flex-shrink-0">
                    <div className="text-sm opacity-60">{new Date(entry.timestamp).toLocaleString()}</div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm" style={{ fontWeight: 500 }}>
                        {String(entry.action).replace(/_/g, ' ')}
                      </span>
                      {entry.cargoId && (
                        <>
                          <span className="opacity-40 text-xs">·</span>
                          <span className="font-mono text-xs opacity-70">{entry.cargoId}</span>
                        </>
                      )}
                    </div>

                    {entry.eventType && (
                      <div className="text-sm opacity-60">Event: {String(entry.eventType).replace(/_/g, ' ')}</div>
                    )}
                  </div>

                  <div className="w-32 flex-shrink-0 text-right">
                    <span
                      className="text-xs px-2 py-1 rounded"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                    >
                      {entry.actorRole}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
