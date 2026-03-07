import { useState, useEffect } from 'react';
import { CheckCircle, Clock, Package, Search, AlertCircle } from 'lucide-react';
import { getOpsValidationQueue } from '@/app/api/ops';

interface PendingAction {
  cargoId: string;
  containerId: string;
  actionType: 'PHYSICAL_VERIFICATION' | 'WAREHOUSE_ARRIVAL';
  currentStatus: string;
  lastEventTime: string;
  clientName: string;
  origin: string;
}

export function OperationsUpdatePage() {
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'PHYSICAL_VERIFICATION' | 'WAREHOUSE_ARRIVAL'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cargoOptions, setCargoOptions] = useState<PendingAction[]>([]);
  const [selectedCargoId, setSelectedCargoId] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<'PHYSICAL_VERIFICATION' | 'WAREHOUSE_ARRIVAL'>('PHYSICAL_VERIFICATION');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await getOpsValidationQueue();
        if (cancelled) return;

        const actions: PendingAction[] = (data.items ?? [])
          .filter((item) => item.validation_status === 'validated')
          .map((item) => {
            return {
              cargoId: item.cargo_id,
              containerId: item.cargo_id || 'N/A',
              actionType: 'PHYSICAL_VERIFICATION',
              currentStatus: 'Validated draft & assessment',
              lastEventTime: item.validation_completed_at ?? item.validation_created_at ?? '',
              clientName: item.client_name || 'Unknown Client',
              origin: '—',
            };
          });

        setCargoOptions(actions);
        setPendingActions([]);
      } catch (err) {
        console.error('Failed to load cargo data:', err);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRecordAction = async (cargoId: string, actionType: string) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    setCompletedActions([...completedActions, `${cargoId}-${actionType}`]);

    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/ops/cargo/${encodeURIComponent(cargoId)}/timeline`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('sb:token') ?? ''}`,
          ...(window.location.pathname.match(/^\/t\/([^/]+)/i)
            ? { 'x-mt-tenant-slug': window.location.pathname.match(/^\/t\/([^/]+)/i)?.[1] }
            : {}),
        },
        body: JSON.stringify({ event_type: actionType }),
      });
    } catch {
      // ignore
    }

    console.log(`Recording event: ${actionType} for ${cargoId} at ${timestamp}`);

    setTimeout(() => {
      setPendingActions((prev) =>
        prev.filter((action) => !(action.cargoId === cargoId && action.actionType === actionType))
      );
    }, 1000);
  };

  const filteredActions = pendingActions.filter((action) => {
    const matchesFilter = filterType === 'all' || action.actionType === filterType;
    const matchesSearch =
      searchQuery === '' ||
      action.cargoId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      action.containerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      action.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const isActionCompleted = (cargoId: string, actionType: string) => {
    return completedActions.includes(`${cargoId}-${actionType}`);
  };

  if (loading) {
    return (
      <div className="max-w-6xl">
        <div className="mb-8">
          <h1>Operations Update</h1>
          <p className="text-sm opacity-60 mt-2">Record physical verification and warehouse arrival events</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-sm opacity-60">Loading pending actions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1>Operations Update</h1>
        <p className="text-sm opacity-60 mt-2">Record physical verification and warehouse arrival events</p>
      </div>

      {/* Manual action creation */}
      <div className="mb-6 rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
        <div className="text-sm font-semibold mb-3">Add Manual Action</div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCargoId}
            onChange={(e) => setSelectedCargoId(e.target.value)}
            className="min-w-[240px] px-3 py-2 rounded border text-sm"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
          >
            <option value="">Select cargo</option>
            {cargoOptions.map((cargo) => (
              <option key={cargo.cargoId} value={cargo.cargoId}>
                {cargo.containerId} · {cargo.clientName}
              </option>
            ))}
          </select>
          <select
            value={selectedActionType}
            onChange={(e) => setSelectedActionType(e.target.value as 'PHYSICAL_VERIFICATION' | 'WAREHOUSE_ARRIVAL')}
            className="px-3 py-2 rounded border text-sm"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
          >
            <option value="PHYSICAL_VERIFICATION">Physical Verification</option>
            <option value="WAREHOUSE_ARRIVAL">Warehouse Arrival</option>
          </select>
          <button
            type="button"
            className="px-4 py-2 rounded text-sm flex items-center gap-2"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            onClick={() => {
              if (!selectedCargoId) return;
              const cargo = cargoOptions.find((c) => c.cargoId === selectedCargoId);
              if (!cargo) return;
              setPendingActions((prev) => [
                {
                  ...cargo,
                  actionType: selectedActionType,
                },
                ...prev,
              ]);
            }}
          >
            + Add Action
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
          <input
            type="text"
            placeholder="Search by Cargo ID, Container ID, or Client"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border outline-none transition-colors"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--card)',
            }}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className="px-4 py-2.5 rounded-lg text-sm transition-colors"
            style={{
              backgroundColor: filterType === 'all' ? 'var(--primary)' : 'var(--muted)',
              color: filterType === 'all' ? 'var(--primary-foreground)' : 'var(--foreground)',
            }}
          >
            All Actions
          </button>
          <button
            onClick={() => setFilterType('PHYSICAL_VERIFICATION')}
            className="px-4 py-2.5 rounded-lg text-sm transition-colors"
            style={{
              backgroundColor: filterType === 'PHYSICAL_VERIFICATION' ? 'var(--primary)' : 'var(--muted)',
              color:
                filterType === 'PHYSICAL_VERIFICATION' ? 'var(--primary-foreground)' : 'var(--foreground)',
            }}
          >
            Physical Verification
          </button>
          <button
            onClick={() => setFilterType('WAREHOUSE_ARRIVAL')}
            className="px-4 py-2.5 rounded-lg text-sm transition-colors"
            style={{
              backgroundColor: filterType === 'WAREHOUSE_ARRIVAL' ? 'var(--primary)' : 'var(--muted)',
              color: filterType === 'WAREHOUSE_ARRIVAL' ? 'var(--primary-foreground)' : 'var(--foreground)',
            }}
          >
            Warehouse Arrival
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-card rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(199, 161, 74, 0.1)' }}
            >
              <AlertCircle className="w-5 h-5" style={{ color: 'var(--gold-accent)' }} />
            </div>
            <div>
              <div className="text-sm opacity-60">Total Pending</div>
              <div className="text-2xl" style={{ fontWeight: 600 }}>
                {pendingActions.length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(46, 74, 98, 0.1)' }}
            >
              <CheckCircle className="w-5 h-5" style={{ color: 'var(--steel-blue)' }} />
            </div>
            <div>
              <div className="text-sm opacity-60">Physical Verification</div>
              <div className="text-2xl" style={{ fontWeight: 600 }}>
                {pendingActions.filter((a) => a.actionType === 'PHYSICAL_VERIFICATION').length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(46, 74, 98, 0.1)' }}
            >
              <Package className="w-5 h-5" style={{ color: 'var(--steel-blue)' }} />
            </div>
            <div>
              <div className="text-sm opacity-60">Warehouse Arrival</div>
              <div className="text-2xl" style={{ fontWeight: 600 }}>
                {pendingActions.filter((a) => a.actionType === 'WAREHOUSE_ARRIVAL').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Actions List */}
      <div className="space-y-4">
        {filteredActions.length === 0 ? (
          <div className="bg-card rounded-lg border p-12 text-center" style={{ borderColor: 'var(--border)' }}>
            <p className="opacity-60">
              {searchQuery ? 'No actions found matching your search' : 'No pending actions'}
            </p>
          </div>
        ) : (
          filteredActions.map((action) => {
            const completed = isActionCompleted(action.cargoId, action.actionType);

            return (
              <div
                key={`${action.cargoId}-${action.actionType}`}
                className="bg-card rounded-lg border p-6 transition-all"
                style={{
                  borderColor: 'var(--border)',
                  opacity: completed ? 0.5 : 1,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono" style={{ fontWeight: 600 }}>
                          {action.cargoId}
                        </span>
                        <span className="text-sm opacity-40">·</span>
                        <span className="text-sm opacity-60">{action.containerId}</span>
                      </div>
                      <div
                        className="px-3 py-1 rounded-full text-xs"
                        style={{
                          backgroundColor:
                            action.actionType === 'PHYSICAL_VERIFICATION'
                              ? 'rgba(199, 161, 74, 0.15)'
                              : 'rgba(46, 74, 98, 0.15)',
                          color:
                            action.actionType === 'PHYSICAL_VERIFICATION'
                              ? 'var(--gold-accent)'
                              : 'var(--steel-blue)',
                          fontWeight: 500,
                        }}
                      >
                        {action.actionType === 'PHYSICAL_VERIFICATION'
                          ? 'Physical Verification Required'
                          : 'Warehouse Arrival Pending'}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 text-sm">
                      <div>
                        <div className="opacity-60 mb-1">Client</div>
                        <div style={{ fontWeight: 500 }}>{action.clientName}</div>
                      </div>
                      <div>
                        <div className="opacity-60 mb-1">Origin</div>
                        <div style={{ fontWeight: 500 }}>{action.origin}</div>
                      </div>
                      <div>
                        <div className="opacity-60 mb-1">Current Status</div>
                        <div style={{ fontWeight: 500 }}>{action.currentStatus}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3 text-xs opacity-50">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Last event: {action.lastEventTime}</span>
                    </div>
                  </div>

                  <div className="ml-6">
                    {completed ? (
                      <div
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                        style={{
                          backgroundColor: 'var(--muted)',
                          color: 'var(--muted-foreground)',
                        }}
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Recorded</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleRecordAction(action.cargoId, action.actionType)}
                        className="px-5 py-2.5 rounded-lg transition-colors text-sm flex items-center gap-2"
                        style={{
                          backgroundColor: 'var(--primary)',
                          color: 'var(--primary-foreground)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '0.9';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '1';
                        }}
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>
                          Record {action.actionType === 'PHYSICAL_VERIFICATION' ? 'Verification' : 'Arrival'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Info Note */}
      <div
        className="mt-8 p-4 rounded-lg border-l-4 text-sm"
        style={{
          backgroundColor: 'rgba(199, 161, 74, 0.05)',
          borderColor: 'var(--gold-accent)',
        }}
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--gold-accent)' }} />
          <div>
            <div style={{ fontWeight: 500 }} className="mb-1">
              Recording Events
            </div>
            <div className="opacity-75">
              When you record an action, a timestamped event is created in the cargo timeline. This action cannot be
              undone. Ensure physical verification or warehouse arrival is confirmed before recording.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
