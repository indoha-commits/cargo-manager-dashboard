import { Database, HardDrive, Cloud, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { fetchJson } from '@/app/api/client';

interface DataSourceSetupProps {
  onComplete: () => void;
}

type ProviderId = 'google_drive' | 'dropbox' | 'onedrive' | 'supabase_storage' | 'local';

export function DataSourceSetup({ onComplete }: DataSourceSetupProps) {
  const [selectedSource, setSelectedSource] = useState<ProviderId | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driveFolderId, setDriveFolderId] = useState('');
  const [driveConnectionMode, setDriveConnectionMode] = useState<'oauth' | 'service_account'>('oauth');
  const [driveValidation, setDriveValidation] = useState<{
    status: 'idle' | 'checking' | 'valid' | 'invalid';
    message?: string;
  }>({ status: 'idle' });

  const sources = useMemo(
    () => [
      {
        id: 'google_drive' as const,
        name: 'Google Drive',
        description: 'Connect Google Drive for document storage and cargo data imports',
        icon: Database,
        popular: true,
      },
      {
        id: 'dropbox' as const,
        name: 'Dropbox',
        description: 'Import logistics data and documents from Dropbox',
        icon: Cloud,
        popular: false,
      },
      {
        id: 'onedrive' as const,
        name: 'Microsoft OneDrive',
        description: 'Sync cargo records and clearing documents from OneDrive',
        icon: HardDrive,
        popular: false,
      },
      {
        id: 'local' as const,
        name: 'Local Storage',
        description: 'Use local storage for testing (data will not persist)',
        icon: HardDrive,
        popular: false,
      },
      {
        id: 'supabase_storage' as const,
        name: 'Cloud Storage (Supabase)',
        description: 'Use InDataFlow cloud storage as the primary store (recommended fallback)',
        icon: Cloud,
        popular: false,
      },
    ],
    []
  );

  const handleValidateDriveFolder = async () => {
    const trimmed = driveFolderId.trim();
    if (!trimmed) {
      setDriveValidation({ status: 'invalid', message: 'Paste a Google Drive folder ID first.' });
      return;
    }

    setDriveValidation({ status: 'checking', message: 'Validating access…' });
    try {
      const res = await fetchJson<{ ok: true; folder: { id: string; name?: string } }>(
        '/ops/data-source/validate-drive-folder',
        {
          method: 'POST',
          body: JSON.stringify({ root_folder_id: trimmed }),
        }
      );
      setDriveValidation({
        status: 'valid',
        message: res.folder?.name ? `Access confirmed: ${res.folder.name}` : 'Access confirmed',
      });
    } catch (e: any) {
      setDriveValidation({ status: 'invalid', message: String(e?.message ?? e) });
    }
  };

  const handleConnect = async () => {
    if (!selectedSource) return;
    setLoading(true);
    setError(null);

    try {
      // Providers that need OAuth start a redirect
      if (selectedSource === 'google_drive' || selectedSource === 'dropbox' || selectedSource === 'onedrive') {
        if (selectedSource === 'google_drive' && driveConnectionMode === 'service_account') {
          const trimmed = driveFolderId.trim();
          if (!trimmed) {
            setError('Please paste a Google Drive folder ID for the service account option.');
            setLoading(false);
            return;
          }
          await fetchJson('/ops/data-source/select', {
            method: 'POST',
            body: JSON.stringify({ provider: 'google_drive', root_folder_id: trimmed }),
          });
          onComplete();
          return;
        }

        const startPath =
          selectedSource === 'google_drive'
            ? '/ops/oauth/google-drive/start'
            : selectedSource === 'dropbox'
            ? '/ops/oauth/dropbox/start'
            : '/ops/oauth/onedrive/start';

        const res = await fetchJson<{ auth_url: string }>(startPath, {
          method: 'POST',
          body: JSON.stringify({ return_to: window.location.origin + window.location.pathname }),
        });

        window.location.href = res.auth_url;
        return;
      }

      // Non-OAuth providers are connected immediately
      await fetchJson('/ops/data-source/select', {
        method: 'POST',
        body: JSON.stringify({ provider: selectedSource }),
      });

      onComplete();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-6">
            <Database className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-primary mb-3">Connect Data Source</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Connect your cloud storage to begin managing cargo operations, documents, and logistics workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {sources.map((source) => {
            const Icon = source.icon;
            const isSelected = selectedSource === source.id;

            return (
              <button
                key={source.id}
                onClick={() => setSelectedSource(source.id)}
                className={`relative bg-card border rounded-lg p-6 text-left transition-all hover:border-steel-blue hover:shadow-md ${
                  isSelected ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'border-border'
                }`}
              >
                {source.popular && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
                      Popular
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-lg ${
                      isSelected ? 'bg-primary' : 'bg-muted'
                    } transition-colors`}
                  >
                    <Icon className={`w-6 h-6 ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-primary mb-1">{source.name}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{source.description}</p>
                  </div>

                  {isSelected && <ChevronRight className="w-5 h-5 text-primary flex-shrink-0 mt-1" />}
                </div>
              </button>
            );
          })}
        </div>

        {selectedSource === 'google_drive' && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <div className="mb-4">
              <p className="text-sm font-medium text-foreground">Choose how to connect Google Drive</p>
              <p className="mt-1 text-xs text-muted-foreground">
                OAuth is recommended. Service account is for advanced setups where you share a folder with our service
                account email.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDriveConnectionMode('oauth')}
                className={`rounded-md border px-3 py-3 text-left text-sm font-medium transition ${
                  driveConnectionMode === 'oauth'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:bg-muted'
                }`}
              >
                OAuth (recommended)
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  Secure sign-in with Google. No manual sharing required.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDriveConnectionMode('service_account')}
                className={`rounded-md border px-3 py-3 text-left text-sm font-medium transition ${
                  driveConnectionMode === 'service_account'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:bg-muted'
                }`}
              >
                Service account folder
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  Share a folder with our service account email and paste the folder ID.
                </span>
              </button>
            </div>

            {driveConnectionMode === 'service_account' && (
              <div className="mt-4 rounded-md border border-border bg-background p-3">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Google Drive folder ID
                </label>
                <input
                  type="text"
                  value={driveFolderId}
                  onChange={(event) => {
                    setDriveFolderId(event.target.value);
                    if (driveValidation.status !== 'idle') {
                      setDriveValidation({ status: 'idle' });
                    }
                  }}
                  placeholder="e.g. 1t5GwFv2tRZCDmv_nSnGVZEc9p-6ku5Mce"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleValidateDriveFolder}
                    className="rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                    disabled={driveValidation.status === 'checking'}
                  >
                    {driveValidation.status === 'checking' ? 'Checking…' : 'Validate folder access'}
                  </button>
                  {driveValidation.status === 'valid' && (
                    <span className="text-xs text-emerald-500">{driveValidation.message}</span>
                  )}
                  {driveValidation.status === 'invalid' && (
                    <span className="text-xs text-destructive">{driveValidation.message}</span>
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Paste the folder ID from the Drive URL (https://drive.google.com/drive/folders/&lt;ID&gt;). The folder must
                  be shared with the service account email.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onComplete}
            className="px-6 py-2.5 border border-border bg-card text-muted-foreground rounded-lg hover:bg-muted transition-colors"
          >
            Skip for Now
          </button>

          <button
            onClick={handleConnect}
            disabled={!selectedSource || loading}
            className={`px-8 py-2.5 rounded-lg font-medium transition-all ${
              selectedSource && !loading
                ? 'bg-primary text-primary-foreground hover:bg-steel-blue shadow-sm'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {loading ? 'Connecting…' : 'Connect Data Source'}
          </button>
        </div>

        {error && <p className="mt-6 text-sm text-destructive text-center">{error}</p>}

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Documents uploaded by clients are first stored securely. Once verified, they are automatically pushed to
            your connected storage.
          </p>
        </div>
      </div>
    </div>
  );
}
