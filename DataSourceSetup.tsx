import { Database, HardDrive, Cloud, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface DataSourceSetupProps {
  onComplete: () => void;
}

export function DataSourceSetup({ onComplete }: DataSourceSetupProps) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const handleConnect = () => {
    // UI-only: simulate connection
    if (selectedSource) {
      onComplete();
    }
  };

  const sources = [
    {
      id: 'google-drive',
      name: 'Google Drive',
      description: 'Connect to your Google Drive for document storage and cargo data imports',
      icon: Database,
      popular: true,
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      description: 'Import logistics data and documents from Dropbox',
      icon: Cloud,
      popular: false,
    },
    {
      id: 'onedrive',
      name: 'Microsoft OneDrive',
      description: 'Sync cargo records and clearing documents from OneDrive',
      icon: HardDrive,
      popular: false,
    },
    {
      id: 'local',
      name: 'Local Storage',
      description: 'Use browser storage for testing (data will not persist)',
      icon: HardDrive,
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-6">
            <Database className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-primary mb-3">Connect Data Source</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Connect your cloud storage or set up a data source to begin managing cargo operations, 
            documents, and logistics workflows.
          </p>
        </div>

        {/* Data Source Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {sources.map((source) => {
            const Icon = source.icon;
            const isSelected = selectedSource === source.id;
            
            return (
              <button
                key={source.id}
                onClick={() => setSelectedSource(source.id)}
                className={`
                  relative bg-card border rounded-lg p-6 text-left transition-all
                  hover:border-steel-blue hover:shadow-md
                  ${isSelected ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'border-border'}
                `}
              >
                {source.popular && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
                      Popular
                    </span>
                  </div>
                )}
                
                <div className="flex items-start gap-4">
                  <div className={`
                    flex items-center justify-center w-12 h-12 rounded-lg
                    ${isSelected ? 'bg-primary' : 'bg-muted'}
                    transition-colors
                  `}>
                    <Icon className={`w-6 h-6 ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-primary mb-1">{source.name}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {source.description}
                    </p>
                  </div>

                  {isSelected && (
                    <ChevronRight className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onComplete}
            className="px-6 py-2.5 border border-border bg-card text-muted-foreground rounded-lg hover:bg-muted transition-colors"
          >
            Skip for Now
          </button>
          
          <button
            onClick={handleConnect}
            disabled={!selectedSource}
            className={`
              px-8 py-2.5 rounded-lg font-medium transition-all
              ${selectedSource
                ? 'bg-primary text-primary-foreground hover:bg-steel-blue shadow-sm'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
              }
            `}
          >
            Connect Data Source
          </button>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Your connection will be used to import cargo data, clearing documents, and logistics records.
          </p>
        </div>
      </div>
    </div>
  );
}
