import { useEffect, useState } from 'react';
import Button from './Button';

export default function UpdateBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!window.electronUpdater) return undefined;
    return window.electronUpdater.onStatus(setStatus);
  }, []);

  if (!status || status.status === 'not-available' || status.status === 'error') return null;

  const isDownloaded = status.status === 'downloaded';
  const isDownloading = status.status === 'downloading';

  return (
    <div className="fixed bottom-4 right-4 z-[90] max-w-xs bg-surface-container-lowest border border-outline-variant rounded-lg shadow-elevated p-3 flex items-center gap-3">
      <span className="material-symbols-outlined text-[20px] text-accent-container shrink-0">
        {isDownloaded ? 'system_update' : 'downloading'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-on-surface">
          {isDownloaded ? `Update ${status.version} ready` : `Downloading update${status.version ? ` ${status.version}` : ''}…`}
        </p>
        <p className="text-[11px] text-secondary">
          {isDownloaded ? 'Restart to apply.' : isDownloading && status.percent != null ? `${Math.round(status.percent)}%` : 'Checking in the background.'}
        </p>
      </div>
      {isDownloaded && (
        <Button variant="primary" size="sm" onClick={() => window.electronUpdater.quitAndInstall()} className="shrink-0">
          Restart
        </Button>
      )}
    </div>
  );
}
