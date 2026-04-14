import { useMemo } from 'react';
import { useManagerData, toDays } from './data';

export function RiskCenterPage() {
  const { loading, error, rows } = useManagerData();
  const risks = useMemo(() => {
    return rows.flatMap((r) => {
      const days = toDays(r.expected_release_date);
      const items: string[] = [];
      if (days !== null && days < 0) items.push('Overdue release date');
      if (r.verification_status === 'pending_upload' && days !== null && days <= 1) items.push('Missing verification close to release');
      if (r.verification_status === 'failed') items.push('Validation failed');
      if (!r.latest_event_time) items.push('No timeline activity yet');
      return items.map((flag) => ({ cargo_id: r.cargo_id, client_name: r.client_name, flag }));
    });
  }, [rows]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <h1>Risk Center</h1>
      <div className="bg-card border rounded-lg" style={{ borderColor: 'var(--border)' }}>
        {loading ? (
          <div className="px-4 py-4 text-sm opacity-60">Loading...</div>
        ) : error ? (
          <div className="px-4 py-4 text-sm" style={{ color: 'var(--destructive)' }}>{error}</div>
        ) : risks.length === 0 ? (
          <div className="px-4 py-4 text-sm opacity-60">No active risks detected.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {risks.map((r, idx) => (
              <div key={`${r.cargo_id}-${idx}`} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-sm">{r.cargo_id}</div>
                  <div className="text-xs opacity-60">{r.client_name}</div>
                </div>
                <div className="text-sm" style={{ color: 'var(--destructive)' }}>{r.flag}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
