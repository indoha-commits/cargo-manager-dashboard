import { useState } from 'react';
import { createOpsClient } from '@/app/api/ops';

interface CreateClientPageProps {
  onCreated: (client: { id: string; name: string }) => void;
  onCancel: () => void;
}

export function CreateClientPage({ onCreated, onCancel }: CreateClientPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clientName = name.trim();
    const em = email.trim().toLowerCase();
    
    if (!clientName) {
      setError('Client name is required');
      return;
    }
    if (!em || !em.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createOpsClient({ name: clientName, email: em, password });
      onCreated(res.client);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1>Create Client</h1>
        <p className="text-sm opacity-60 mt-2">Create a new client with login credentials. An email with the credentials will be sent to the client.</p>
      </div>

      <div className="bg-card rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="text-sm" style={{ color: 'var(--destructive)' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm opacity-70 mb-1">Client name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded border bg-transparent"
              style={{ borderColor: 'var(--border)' }}
              placeholder="Company Name"
              autoComplete="organization"
            />
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-1">Client email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded border bg-transparent"
              style={{ borderColor: 'var(--border)' }}
              placeholder="client@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded border bg-transparent"
              style={{ borderColor: 'var(--border)' }}
              autoComplete="new-password"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded border"
              style={{ borderColor: 'var(--border)' }}
            >
              Cancel
            </button>
            <button
              disabled={submitting}
              type="submit"
              className="px-4 py-2 rounded border disabled:opacity-60"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              {submitting ? 'Creating…' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
