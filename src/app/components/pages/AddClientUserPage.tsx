import { useEffect, useState } from 'react';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import { addOpsClientUser, getOpsClients } from '@/app/api/ops';

interface Client {
  id: string;
  name: string;
  slug?: string;
}

interface AddClientUserPageProps {
  onDone: () => void;
  onCancel: () => void;
}

export function AddClientUserPage({ onDone, onCancel }: AddClientUserPageProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingClients, setLoadingClients] = useState(true);

  useEffect(() => {
    getOpsClients()
      .then((res) => setClients((res.clients ?? []) as any))
      .catch((e: any) => setError(String(e)))
      .finally(() => setLoadingClients(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedId) { setError('Please select a client.'); return; }
    if (!email || !email.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setSubmitting(true);
    try {
      const res = await addOpsClientUser(selectedId, email, password);
      setSuccess(`User ${res.email} added successfully. They can now log in to the client dashboard.`);
      setEmail('');
      setPassword('');
      setSelectedId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1>Add Client User</h1>
        <p className="text-sm opacity-60 mt-2">
          Create a new login credential for an existing client company. Multiple users can share the same client dashboard.
        </p>
      </div>

      <div className="bg-card rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="text-sm rounded px-3 py-2" style={{ color: 'var(--destructive)', backgroundColor: 'rgba(212,24,61,0.07)', border: '1px solid rgba(212,24,61,0.2)' }}>
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm rounded px-3 py-2" style={{ color: '#10b981', backgroundColor: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
              {success}
            </div>
          )}

          {/* Client selector */}
          <div>
            <label className="block text-sm font-medium opacity-70 mb-1">Client Company</label>
            {loadingClients ? (
              <div className="text-sm opacity-50">Loading clients…</div>
            ) : (
              <select
                value={selectedId}
                onChange={(e) => { setSelectedId(e.target.value); setError(null); }}
                className="w-full px-3 py-2 rounded border bg-transparent"
                style={{ borderColor: 'var(--border)' }}
              >
                <option value="">— Choose a client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.slug ? ` (${c.slug})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium opacity-70 mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded border bg-transparent"
              style={{ borderColor: 'var(--border)' }}
              placeholder="user@company.com"
              autoComplete="off"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium opacity-70 mb-1">Temporary Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded border bg-transparent"
                style={{ borderColor: 'var(--border)' }}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-80"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-xs opacity-50 mt-1">
              Share this password with the client — they can change it after first login.
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded border"
              style={{ borderColor: 'var(--border)' }}
            >
              {success ? 'Done' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded border flex items-center gap-2 disabled:opacity-40"
              style={{ borderColor: 'var(--gold-accent)', color: 'var(--gold-accent)' }}
            >
              <UserPlus className="w-4 h-4" />
              {submitting ? 'Creating…' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
