import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  Package,
  Search,
  Truck,
  Activity,
  PackageCheck,
  X,
} from 'lucide-react';
import { useManagerData, type PipelineState } from './data';
import { ManagerTable } from './ManagerTable';

type TabDef = {
  key: PipelineState | 'all';
  label: string;
  icon: React.ReactNode;
  accentClass: string;
};

const TABS: TabDef[] = [
  { key: 'all', label: 'All', icon: <Package className="size-3.5" />, accentClass: 'text-foreground' },
  { key: 'ready_dispatch', label: 'Ready to dispatch', icon: <Truck className="size-3.5" />, accentClass: 'text-red-500' },
  { key: 'releasing_soon', label: 'Needs attention', icon: <AlertTriangle className="size-3.5" />, accentClass: 'text-red-500' },
  { key: 'in_transit', label: 'In transit', icon: <Activity className="size-3.5" />, accentClass: 'text-sky-500' },
  { key: 'waiting', label: 'Waiting', icon: <Clock className="size-3.5" />, accentClass: 'text-muted-foreground' },
];

export function PipelinePage() {
  const { loading, error, rows } = useManagerData();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const stageParam = useMemo(
    () => (new URLSearchParams(location.search).get('stage')?.trim() || 'all') as PipelineState | 'all',
    [location.search],
  );

  const activeTab = TABS.find((t) => t.key === stageParam) ? stageParam : 'all';

  function selectTab(key: PipelineState | 'all') {
    if (key === 'all') navigate('/pipeline');
    else navigate(`/pipeline?stage=${key}`);
  }

  const filtered = useMemo(() => {
    let base = activeTab === 'all' ? rows : rows.filter((r) => r.pipeline_state === activeTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      base = base.filter(
        (r) =>
          r.cargo_id.toLowerCase().includes(q) ||
          r.client_name.toLowerCase().includes(q) ||
          r.bill_of_lading.toLowerCase().includes(q) ||
          (r.origin ?? '').toLowerCase().includes(q) ||
          (r.destination ?? '').toLowerCase().includes(q) ||
          (r.vessel ?? '').toLowerCase().includes(q),
      );
    }
    return base;
  }, [rows, activeTab, search]);

  const countFor = (key: PipelineState | 'all') =>
    key === 'all' ? rows.length : rows.filter((r) => r.pipeline_state === key).length;

  // For "Needs attention" tab: how many are genuinely overdue (days_to_release < 0)
  const overdueCount = useMemo(
    () => rows.filter((r) => r.pipeline_state === 'releasing_soon' && (r.days_to_release ?? 0) < 0).length,
    [rows],
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading…' : `${rows.length} container${rows.length !== 1 ? 's' : ''} tracked`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((tab) => {
          const count = loading ? null : countFor(tab.key);
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => selectTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-md transition-colors border-b-2 -mb-px
                ${isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
            >
              <span className={isActive ? 'text-foreground' : tab.accentClass}>{tab.icon}</span>
              {tab.label}
              {count !== null && count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    tab.key === 'releasing_soon'
                      ? isActive
                        ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                        : 'bg-red-500/15 text-red-600 dark:text-red-400'
                      : isActive
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {count}
                  {tab.key === 'releasing_soon' && overdueCount > 0 && overdueCount < count && (
                    <> · {overdueCount} overdue</>
                  )}
                </span>
              )}
              {count !== null && count === 0 && tab.key !== 'all' && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search by container ID, client, BoL, vessel, route…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          style={{ borderColor: 'var(--border)' }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Results */}
      {error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-card border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <Package className="size-10 opacity-25" />
          <p className="text-sm font-medium">No containers found</p>
          {search && (
            <button type="button" onClick={() => setSearch('')} className="text-xs text-primary hover:underline">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="px-5 py-3 border-b flex items-center justify-between gap-4 flex-wrap" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {filtered.length} container{filtered.length !== 1 ? 's' : ''}
              {search && ' matching'}
            </span>
            {activeTab === 'releasing_soon' && overdueCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                <AlertTriangle className="size-3.5" />
                {overdueCount === filtered.length
                  ? 'All containers are overdue'
                  : `${overdueCount} of ${filtered.length} are overdue`}
              </span>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> ACTION NOW</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> PREPARE</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> STABLE</span>
            </div>
          </div>
          <ManagerTable rows={filtered} />
        </div>
      )}
    </div>
  );
}
