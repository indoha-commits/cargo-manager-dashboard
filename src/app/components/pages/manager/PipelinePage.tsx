import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useManagerData } from './data';
import { ManagerTable } from './ManagerTable';

export function PipelinePage() {
  const { loading, error, rows } = useManagerData();
  const location = useLocation();
  const stage = useMemo(() => new URLSearchParams(location.search).get('stage')?.trim() || '', [location.search]);

  const ready = rows.filter((r) => r.pipeline_state === 'ready_dispatch');
  const soon = rows.filter((r) => r.pipeline_state === 'releasing_soon');
  const waiting = rows.filter((r) => r.pipeline_state === 'waiting');
  const transit = rows.filter((r) => r.pipeline_state === 'in_transit');

  if (loading) return <div className="max-w-6xl mx-auto text-sm opacity-60">Loading pipeline...</div>;
  if (error) return <div className="max-w-6xl mx-auto text-sm" style={{ color: 'var(--destructive)' }}>{error}</div>;

  const section = (title: string, items: typeof rows) => (
    <div className="bg-card border rounded-lg" style={{ borderColor: 'var(--border)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2>{title}</h2>
      </div>
      {items.length === 0 ? <div className="px-4 py-4 text-sm opacity-60">No containers in this stage.</div> : <ManagerTable rows={items} />}
    </div>
  );

  const onlyStage = (key: string) => stage.toLowerCase() === key;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <h1>Pipeline</h1>
      {(stage === '' || onlyStage('ready_dispatch')) && section('🚨 Ready to Dispatch', ready)}
      {(stage === '' || onlyStage('releasing_soon')) && section('⚠️ Releasing Soon', soon)}
      {(stage === '' || onlyStage('waiting')) && section('🕒 Waiting', waiting)}
      {(stage === '' || onlyStage('in_transit')) && section('🚛 In Transit', transit)}
    </div>
  );
}
