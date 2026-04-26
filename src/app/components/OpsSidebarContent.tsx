import {
  Activity,
  AlertTriangle,
  Banknote,
  ChevronDown,
  FileSpreadsheet,
  GitBranch,
  LogOut,
  Radar,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';

interface OpsSidebarContentProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  onLogout: () => void;
  onNavigate?: () => void;
}

type NavItem = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
};

const financeItems: NavItem[] = [
  { id: 'shipments', label: 'Shipments', description: 'Core system (BoL)', icon: FileSpreadsheet },
  { id: 'payments', label: 'Payments', description: 'Cash control', icon: Banknote },
  { id: 'receivables', label: 'Receivables', description: 'Outstanding risk', icon: Receipt },
];

const operationsItems: NavItem[] = [
  { id: 'action-panel', label: 'Action Panel', description: "Today's priorities", icon: Radar },
  { id: 'pipeline', label: 'Pipeline', description: 'Track by stage', icon: GitBranch },
  { id: 'monitoring', label: 'Monitoring', description: 'All containers live', icon: Activity },
  { id: 'risk-center', label: 'Risk Center', description: 'Flags & alerts', icon: AlertTriangle },
];

function NavSection({
  label,
  items,
  currentPage,
  onPageChange,
  onNavigate,
  defaultOpen = true,
}: {
  label: string;
  items: NavItem[];
  currentPage: string;
  onPageChange: (page: string) => void;
  onNavigate?: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-1">
      {/* Section header — click to collapse */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 rounded-lg transition-colors"
        style={{ color: 'var(--sidebar-foreground)' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest opacity-40">
          {label}
        </span>
        <ChevronDown
          className="w-3 h-3 opacity-30 transition-transform duration-200"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
      </button>

      {open && items.map((item) => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => { onPageChange(item.id); onNavigate?.(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 relative mb-0.5"
            style={{
              backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: 'var(--sidebar-foreground)',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {isActive && (
              <span
                className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.6)' }}
              />
            )}
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)' }}
            >
              <Icon
                className="w-4 h-4"
                strokeWidth={isActive ? 2 : 1.5}
                style={{ opacity: isActive ? 1 : 0.65 }}
              />
            </span>
            <div className="min-w-0 text-left">
              <p className="text-sm leading-tight" style={{ fontWeight: isActive ? 600 : 400, opacity: isActive ? 1 : 0.8 }}>
                {item.label}
              </p>
              <p className="text-xs leading-tight mt-0.5 opacity-40 truncate">{item.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function OpsSidebarContent({ currentPage, onPageChange, onLogout, onNavigate }: OpsSidebarContentProps) {
  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="h-full w-full flex flex-col" style={{ color: 'var(--sidebar-foreground)' }}>

      {/* ── Brand header ── */}
      <div className="px-5 pt-7 pb-6 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
        <img
          src="/indataflow-logo.png"
          alt="InDataFlow"
          className="h-14 w-auto brightness-0 invert"
        />
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto">
        <NavSection
          label="Finance"
          items={financeItems}
          currentPage={currentPage}
          onPageChange={onPageChange}
          onNavigate={onNavigate}
          defaultOpen={true}
        />

        <div className="my-3 mx-3 border-t opacity-10" style={{ borderColor: 'var(--sidebar-border)' }} />

        <NavSection
          label="Operations"
          items={operationsItems}
          currentPage={currentPage}
          onPageChange={onPageChange}
          onNavigate={onNavigate}
          defaultOpen={true}
        />
      </nav>

      {/* ── Footer ── */}
      <div className="border-t shrink-0" style={{ borderColor: 'var(--sidebar-border)' }}>
        <div className="px-5 py-3 flex items-center gap-2 opacity-40">
          <RefreshCw className="w-3 h-3 shrink-0" />
          <span className="text-xs">Live · {now}</span>
        </div>

        <div className="mx-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }} />

        <div className="px-3 py-3">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
            style={{ color: 'var(--sidebar-foreground)', backgroundColor: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
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
