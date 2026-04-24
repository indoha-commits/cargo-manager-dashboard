import {
  Activity,
  AlertTriangle,
  GitBranch,
  LogOut,
  Radar,
  RefreshCw,
} from 'lucide-react';

interface OpsSidebarContentProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  onLogout: () => void;
  onNavigate?: () => void;
}

const navItems = [
  {
    id: 'action-panel',
    label: 'Action Panel',
    description: "Today's priorities",
    icon: Radar,
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    description: 'Track by stage',
    icon: GitBranch,
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    description: 'All containers live',
    icon: Activity,
  },
  {
    id: 'risk-center',
    label: 'Risk Center',
    description: 'Flags & alerts',
    icon: AlertTriangle,
  },
] as const;

export function OpsSidebarContent({
  currentPage,
  onPageChange,
  onLogout,
  onNavigate,
}: OpsSidebarContentProps) {
  const now = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="h-full w-full flex flex-col" style={{ color: 'var(--sidebar-foreground)' }}>

      {/* ── Brand header ── */}
      <div className="px-5 pt-7 pb-5 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
        <img
          src="/indataflow-logo.png"
          alt="InDataFlow"
          className="h-9 w-auto brightness-0 invert mb-4"
        />
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          >
            <Radar className="w-3.5 h-3.5 opacity-80" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">Manager Dashboard</p>
            <p className="text-xs opacity-50 leading-tight mt-0.5">Operations cockpit</p>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        <p
          className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest opacity-40"
          style={{ color: 'var(--sidebar-foreground)' }}
        >
          Navigation
        </p>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onPageChange(item.id);
                onNavigate?.();
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 group relative"
              style={{
                backgroundColor: isActive
                  ? 'rgba(255,255,255,0.08)'
                  : 'transparent',
                color: isActive
                  ? 'var(--sidebar-foreground)'
                  : 'var(--sidebar-foreground)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {/* Active indicator strip */}
              {isActive && (
                <span
                  className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.6)' }}
                />
              )}

              {/* Icon */}
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                style={{
                  backgroundColor: isActive
                    ? 'rgba(255,255,255,0.12)'
                    : 'rgba(255,255,255,0.05)',
                }}
              >
                <Icon
                  className="w-4 h-4"
                  strokeWidth={isActive ? 2 : 1.5}
                  style={{ opacity: isActive ? 1 : 0.65 }}
                />
              </span>

              {/* Label + description */}
              <div className="min-w-0 text-left">
                <p
                  className="text-sm leading-tight"
                  style={{ fontWeight: isActive ? 600 : 400, opacity: isActive ? 1 : 0.8 }}
                >
                  {item.label}
                </p>
                <p className="text-xs leading-tight mt-0.5 opacity-40 truncate">
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t shrink-0" style={{ borderColor: 'var(--sidebar-border)' }}>
        {/* Live timestamp */}
        <div className="px-5 py-3 flex items-center gap-2 opacity-40">
          <RefreshCw className="w-3 h-3 shrink-0" />
          <span className="text-xs">Live · {now}</span>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }} />

        {/* Logout */}
        <div className="px-3 py-3">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
            style={{ color: 'var(--sidebar-foreground)', backgroundColor: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
            >
              <LogOut className="w-4 h-4 opacity-60" strokeWidth={1.5} />
            </span>
            <span className="text-sm opacity-70">Sign out</span>
          </button>
        </div>
      </div>

    </div>
  );
}
