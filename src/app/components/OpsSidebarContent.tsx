import { AlertTriangle, Activity, GitBranch, LogOut, Radar } from 'lucide-react';

interface OpsSidebarContentProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  onLogout: () => void;
  onNavigate?: () => void;
}

const navItems = [
  { id: 'action-panel', label: 'Action Panel', icon: Radar },
  { id: 'pipeline', label: 'Pipeline', icon: GitBranch },
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'risk-center', label: 'Risk Center', icon: AlertTriangle },
] as const;

export function OpsSidebarContent({ currentPage, onPageChange, onLogout, onNavigate }: OpsSidebarContentProps) {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Logo / Company Name */}
      <div className="px-6 py-6 md:py-8 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
        <div className="flex items-center gap-3 mb-2">
          <img src="/indataflow-logo.png" alt="InDataFlow" className="h-[56px] md:h-[67px] w-auto brightness-0 invert" />
        </div>
        <p className="text-xs opacity-60" style={{ color: 'var(--sidebar-foreground)' }}>
          Manager Cockpit
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 md:py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                onPageChange(item.id);
                onNavigate?.();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors duration-150"
              style={{
                backgroundColor: isActive ? 'var(--sidebar-accent)' : 'transparent',
                color: 'var(--sidebar-foreground)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Icon className="w-4 h-4" strokeWidth={1.5} />
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="mt-auto">
        <div
          className="px-6 py-4 border-t text-xs opacity-50"
          style={{
            borderColor: 'var(--sidebar-border)',
            color: 'var(--sidebar-foreground)',
          }}
        >
          Last updated: {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </div>

        <div className="px-3 pb-4">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors duration-150"
            style={{
              color: 'var(--sidebar-foreground)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
