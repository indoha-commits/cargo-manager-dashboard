import { useManagerData } from './data';
import { ManagerTable } from './ManagerTable';

export function MonitoringPage() {
  const { loading, error, rows } = useManagerData();

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <h1>Monitoring</h1>
      <div className="bg-card border rounded-lg" style={{ borderColor: 'var(--border)' }}>
        <div className="px-4 py-3 border-b text-sm opacity-70" style={{ borderColor: 'var(--border)' }}>
          Live company-wide container monitoring
        </div>
        {loading ? (
          <div className="px-4 py-4 text-sm opacity-60">Loading...</div>
        ) : error ? (
          <div className="px-4 py-4 text-sm" style={{ color: 'var(--destructive)' }}>{error}</div>
        ) : (
          <ManagerTable rows={rows} />
        )}
      </div>
    </div>
  );
}
