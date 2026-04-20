import { useEffect, useState } from 'react';
import { initSupabaseAuth, setSessionFromUrlHash } from './supabase';
import { getMe } from '../api/ops';

function requireEnv(name: string): string {
  const v = (import.meta.env as any)[name] as string | undefined;
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const authPortalUrl = requireEnv('VITE_AUTH_PORTAL_URL');

export function AuthGateInternal({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const initialize = async () => {
      // Best-effort: capture access_token from auth callback without redirecting.
      if (window.location.hash && window.location.hash.includes('access_token=')) {
        try {
          await setSessionFromUrlHash();
          const callbackIndex = window.location.pathname.indexOf('/auth/callback');
          const nextPath = callbackIndex === -1
            ? window.location.pathname
            : window.location.pathname.slice(0, callbackIndex) || '/';
          // Clear the URL hash containing sensitive tokens for security
          window.history.replaceState({}, document.title, nextPath);
          // Also clear the hash immediately
          window.location.hash = '';
        } catch (e) {
          console.warn('Failed to set session from hash', e);
        }
      }

      if (!mounted) return;

      try {
        unsubscribe = await initSupabaseAuth(async ({ authenticated }) => {
          if (!authenticated) {
            setAccessDenied(null);
            return;
          }

          // Manager dashboard is allowlisted via mt_tenant_users.dashboard_type='manager'
          // and gated by membership_status='active'.
          try {
            const me = await getMe();
            const dt = String(me.dashboard_type || '');
            const ms = String(me.membership_status || 'active');
            if (dt !== 'manager') {
              setAccessDenied('This dashboard is restricted to approved manager accounts.');
              return;
            }
            if (ms !== 'active') {
              setAccessDenied(`Your manager access is not active (status: ${ms}).`);
              return;
            }
          } catch (e) {
            setAccessDenied(`Unable to verify manager access: ${e instanceof Error ? e.message : String(e)}`);
            return;
          }

          setAccessDenied(null);
        });
      } catch (e) {
        console.warn('Failed to initialize Supabase auth', e);
      } finally {
        if (mounted) setReady(true);
      }
    };

    void initialize();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  if (!ready) {
    return null;
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full border rounded-lg p-6 bg-card text-foreground">
          <div className="text-lg font-semibold">Access restricted</div>
          <div className="mt-2 text-sm text-muted-foreground">{accessDenied}</div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="text-sm px-3 py-2 rounded border"
              onClick={() => {
                window.location.href = authPortalUrl;
              }}
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
