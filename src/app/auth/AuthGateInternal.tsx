import { useEffect, useState } from 'react';
import { initSupabaseAuth, setSessionFromUrlHash } from './supabase';
import { getMe, heartbeatInternalSession } from '../api/ops';

function requireEnv(name: string): string {
  const v = (import.meta.env as any)[name] as string | undefined;
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const authPortalUrl = requireEnv('VITE_AUTH_PORTAL_URL');

function getOrCreateInternalSessionId(): string {
  const key = 'internal_session_id';
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;

  // Prefer an id passed from the auth portal (it already claimed the lock).
  // The auth portal redirects to /auth/callback#...&internal_session_id=...
  const hash = window.location.hash;
  if (hash && hash.startsWith('#')) {
    const params = new URLSearchParams(hash.slice(1));
    const fromHash = params.get('internal_session_id');
    if (fromHash) {
      window.sessionStorage.setItem(key, fromHash);
      return fromHash;
    }
  }

  const id = crypto.randomUUID();
  window.sessionStorage.setItem(key, id);
  return id;
}

export function AuthGateInternal({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const initialize = async () => {
      // Best-effort: capture access_token from auth callback without redirecting.
      if (window.location.hash && window.location.hash.includes('access_token=')) {
        try {
          await setSessionFromUrlHash();
          window.history.replaceState({}, document.title, '/');
        } catch (e) {
          console.warn('Failed to set session from hash', e);
        }
      }

      if (!mounted) return;

      try {
        unsubscribe = await initSupabaseAuth(() => {});
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

  return <>{children}</>;
}
