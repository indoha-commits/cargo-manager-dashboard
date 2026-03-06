import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let supabase: SupabaseClient | null = null;
let accessToken: string | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is not set');
    if (!supabaseAnonKey) throw new Error('VITE_SUPABASE_ANON_KEY is not set');
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// Expects: /auth/callback#access_token=...&refresh_token=...
export async function setSessionFromUrlHash(): Promise<boolean> {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#')) return false;

  const params = new URLSearchParams(hash.slice(1));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return false;

  const sb = getSupabase();
  const { error } = await sb.auth.setSession({ access_token, refresh_token });
  if (error) throw error;

  accessToken = access_token;

  // Clear tokens from URL
  window.history.replaceState({}, document.title, window.location.pathname);
  return true;
}

export async function initSupabaseAuth(
  onChange: (args: { authenticated: boolean; error: string | null }) => void
): Promise<() => void> {
  let sb: SupabaseClient;
  try {
    sb = getSupabase();
  } catch (e) {
    accessToken = null;
    onChange({ authenticated: false, error: e instanceof Error ? e.message : String(e) });
    return () => {};
  }

  try {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    accessToken = data.session?.access_token ?? null;
    onChange({ authenticated: Boolean(data.session), error: null });
  } catch (e) {
    accessToken = null;
    onChange({ authenticated: false, error: e instanceof Error ? e.message : String(e) });
  }

  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    accessToken = session?.access_token ?? null;
    onChange({ authenticated: Boolean(session), error: null });
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
