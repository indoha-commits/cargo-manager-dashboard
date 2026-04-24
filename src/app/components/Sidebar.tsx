import { OpsSidebarContent } from './OpsSidebarContent';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  onLogout: () => void;
}

export function Sidebar({ currentPage, onPageChange, onLogout }: SidebarProps) {
  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 h-screen w-64 flex-col"
      style={{
        backgroundColor: 'var(--sidebar)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      <OpsSidebarContent currentPage={currentPage} onPageChange={onPageChange} onLogout={onLogout} />
    </aside>
  );
}