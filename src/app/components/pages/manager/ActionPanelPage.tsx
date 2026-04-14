import { Siren } from 'lucide-react';
import { useManagerData } from './data';

export function ActionPanelPage() {
  const { loading, error, rows } = useManagerData();
  const releasedCount = rows.filter((r) => r.pipeline_state === 'ready_dispatch').length;
  const releasingTomorrowCount = rows.filter((r) => r.days_to_release === 1).length;
  const delayedVerificationCount = rows.filter((r) => r.verification_status === 'failed').length;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <h1>Action Panel</h1>
      <div className="bg-card border rounded-lg p-5" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Siren className="w-4 h-4" style={{ color: 'rgb(220, 38, 38)' }} />
          <h2>🚨 ACTION REQUIRED</h2>
        </div>
        {loading ? (
          <div className="text-sm opacity-60">Loading...</div>
        ) : error ? (
          <div className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</div>
        ) : (
          <div className="space-y-2 text-sm">
            <div>🚛 {releasedCount} containers released → assign trucks</div>
            <div>⚠️ {releasingTomorrowCount} containers releasing tomorrow → pre-assign</div>
            <div>❗ {delayedVerificationCount} delayed verification → fix</div>
          </div>
        )}
      </div>
    </div>
  );
}
