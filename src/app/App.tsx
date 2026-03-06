import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/app/components/Sidebar';
import { OpsSidebarContent } from '@/app/components/OpsSidebarContent';
import { getSupabase } from '@/app/auth/supabase';
import { Sheet, SheetContent } from '@/app/components/ui/sheet';
import { useThemeToggle } from '@/app/hooks/useThemeToggle';
import { DashboardPage } from '@/app/components/pages/DashboardPage';
import { PendingDocumentsPage } from '@/app/components/pages/PendingDocumentsPage';
import { ValidationPage } from '@/app/components/pages/ValidationPage';
import { ImportCargoPage } from '@/app/components/pages/ImportCargoPage';
import { CargoTimelinePage } from '@/app/components/pages/CargoTimelinePage';
import { CargoRegistryPage } from '@/app/components/pages/CargoRegistryPage';
import { CreateClientPage } from '@/app/components/pages/CreateClientPage';
import { ActivityLogPage } from '@/app/components/pages/ActivityLogPage';
import { OperationsUpdatePage } from '@/app/components/pages/OperationsUpdatePage';
import { DataSourceSetup } from '@/app/components/DataSourceSetup';
import { fetchJson } from '@/app/api/client';

function requireEnv(name: string): string {
  const v = (import.meta.env as any)[name] as string | undefined;
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const authPortalUrl = requireEnv('VITE_AUTH_PORTAL_URL');

export default function App() {
  const [dataSourceConnected, setDataSourceConnected] = useState<boolean | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedCargoId, setSelectedCargoId] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [newlyCreatedClient, setNewlyCreatedClient] = useState<{ id: string; name: string } | null>(null);
  const { theme, toggleTheme } = useThemeToggle();

  useEffect(() => {
    let cancelled = false;

    // Auto-refresh state after OAuth callback by checking connection on load
    (async () => {
      try {
        const res = await fetchJson<{ data_source: { status: string } | null }>('/ops/data-source', { method: 'GET' });
        const connected = res.data_source?.status === 'connected';
        if (!cancelled) setDataSourceConnected(connected);
      } catch {
        if (!cancelled) setDataSourceConnected(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Gate: show data source setup until connected
  if (dataSourceConnected === false) {
    return <DataSourceSetup onComplete={() => setDataSourceConnected(true)} />;
  }

  if (dataSourceConnected === null) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const handleLogout = async () => {
    try {
      // Release internal session lock (best-effort)
      const sessionId = window.sessionStorage.getItem('internal_session_id');
      if (sessionId) {
        try {
          const { releaseInternalSession } = await import('@/app/api/ops');
          await releaseInternalSession(sessionId);
        } catch (e) {
          console.warn('Failed to release internal session lock', e);
        }
      }

      const sb = getSupabase();
      await sb.auth.signOut();
    } finally {
      window.location.href = authPortalUrl;
    }
  };

  const handleViewTimeline = (cargoId: string) => {
    setSelectedCargoId(cargoId);
    setCurrentPage('cargo-timeline');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'pending-documents':
        return <PendingDocumentsPage />;
      case 'validation':
        return <ValidationPage />;
      case 'import-cargo':
        return <ImportCargoPage />;
      case 'cargo-timeline':
        return <CargoTimelinePage preselectedCargoId={selectedCargoId} />;
      case 'cargo-registry':
        return (
          <CargoRegistryPage
            onViewTimeline={handleViewTimeline}
            onCreateClient={() => setCurrentPage('create-client')}
            autoOpenNewCargoWithClient={newlyCreatedClient}
            onAutoOpenConsumed={() => setNewlyCreatedClient(null)}
          />
        );
      case 'create-client':
        return (
          <CreateClientPage
            onCancel={() => setCurrentPage('cargo-registry')}
            onCreated={(client) => {
              setNewlyCreatedClient(client);
              setCurrentPage('cargo-registry');
            }}
          />
        );
      case 'activity-log':
        return <ActivityLogPage />;
      case 'operations-update':
        return <OperationsUpdatePage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} onLogout={handleLogout} />

      {/* Mobile top bar */}
      <div
        className="md:hidden sticky top-0 z-40 border-b px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
      >
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="inline-flex items-center justify-center w-10 h-10 rounded border"
          style={{ borderColor: 'var(--border)' }}
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm" style={{ fontWeight: 600 }}>
            Galaxy Logistics
          </div>
          <div className="text-xs opacity-60 truncate">Operations Cockpit</div>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="px-3 py-2 rounded border text-xs"
          style={{ borderColor: 'var(--border)' }}
        >
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>

      {/* Mobile nav drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0" style={{ backgroundColor: 'var(--sidebar)' }}>
          <OpsSidebarContent
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onLogout={handleLogout}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 md:ml-64 md:px-12 md:py-10">
        <div className="hidden md:flex justify-end mb-6">
          <button
            type="button"
            onClick={toggleTheme}
            className={`px-3 py-2 rounded border text-xs ${theme === 'dark' ? 'hidden' : 'inline-flex'}`}
            style={{ borderColor: 'var(--border)' }}
          >
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
        {renderPage()}
      </main>
    </div>
  );
}