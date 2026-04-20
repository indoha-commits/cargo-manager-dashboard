import { useState, useMemo } from 'react';
import {
  Activity,
  Package,
  RefreshCw,
  Search,
  SortAsc,
  SortDesc,
  X,
} from 'lucide-react';
import { useManagerData, type ManagerContainer } from './data';
import { ManagerTable } from './ManagerTable';

type SortKey = 'cargo_id' | 'client_name' | 'days_to_release' | 'latest_event_time' | 'priority_level';
type SortDir = 'asc' | 'desc';

const PRIORITY_RANK: Record<ManagerContainer['priority_level'], number> = { red: 0, yellow: 1, green: 2 };

function sortRows(rows: ManagerContainer[], key: SortKey, dir: SortDir): ManagerContainer[] {
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (key === 'cargo_id') cmp = a.cargo_id.localeCompare(b.cargo_id);
    else if (key === 'client_name') cmp = a.client_name.localeCompare(b.client_name);
    else if (key === 'days_to_release') {
      const da = a.days_to_release ?? Infinity;
      const db = b.days_to_release ?? Infinity;
      cmp = da - db;
    } else if (key === 'latest_event_time') {
      const ta = a.latest_event_time ? Date.parse(a.latest_event_time) : 0;
      const tb = b.latest_event_time ? Date.parse(b.latest_event_time) : 0;
      cmp = ta - tb;
    } else if (key === 'priority_level') {
      cmp = PRIORITY_RANK[a.priority_level] - PRIORITY_RANK[b.priority_level];
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

function SortButton({ label, sortKey, currentKey, currentDir, onSort }: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
        isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
      }`}
    >
      {label}
      {isActive ? (
        currentDir === 'asc' ? <SortAsc className="size-3" /> : <SortDesc className="size-3" />
      ) : null}
    </button>
  );
}

export function MonitoringPage() {
  const { loading, error, rows } = useManagerData();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('priority_level');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    let base = rows;
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
    return sortRows(base, sortKey, sortDir);
  }, [rows, search, sortKey, sortDir]);

  // Stats
  const redCount = rows.filter((r) => r.priority_level === 'red').length;
  const yellowCount = rows.filter((r) => r.priority_level === 'yellow').length;
  const greenCount = rows.filter((r) => r.priority_level === 'green').length;
  const noActivityCount = rows.filter((r) => !r.latest_event_time).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-1">Live company-wide container overview</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <RefreshCw className="size-3.5 animate-spin [animation-duration:3s]" />
          <span>Live · refreshes every 30s</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border rounded-xl px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total active</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{loading ? '—' : rows.length}</div>
        </div>
        <div className="bg-card border border-red-500/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-xs text-muted-foreground">Action needed</span>
          </div>
          <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{loading ? '—' : redCount}</div>
        </div>
        <div className="bg-card border border-amber-500/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-xs text-muted-foreground">Prepare</span>
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{loading ? '—' : yellowCount}</div>
        </div>
        <div className="bg-card border border-emerald-500/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-xs text-muted-foreground">Stable</span>
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{loading ? '—' : greenCount}</div>
        </div>
      </div>

      {/* Search + Sort bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search container, client, BoL, vessel…"
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
        <div className="flex items-center gap-1 flex-wrap shrink-0">
          <span className="text-xs text-muted-foreground mr-1">Sort:</span>
          <SortButton label="Priority" sortKey="priority_level" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
          <SortButton label="ETA" sortKey="days_to_release" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
          <SortButton label="Activity" sortKey="latest_event_time" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
          <SortButton label="Client" sortKey="client_name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
          <SortButton label="ID" sortKey="cargo_id" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
        </div>
      </div>

      {/* No activity warning */}
      {!loading && noActivityCount > 0 && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
          {noActivityCount} container{noActivityCount > 1 ? 's' : ''} with no recorded activity yet
        </div>
      )}

      {/* Table */}
      {error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 bg-card border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <Package className="size-10 opacity-25" />
          <p className="text-sm font-medium">No containers match your search</p>
          <button type="button" onClick={() => setSearch('')} className="text-xs text-primary hover:underline">
            Clear search
          </button>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {filtered.length} of {rows.length} container{rows.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-muted-foreground">Click any row to view details</span>
          </div>
          <ManagerTable rows={filtered} />
        </div>
      )}
    </div>
  );
}
