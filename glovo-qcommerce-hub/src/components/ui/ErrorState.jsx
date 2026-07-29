import { useNavigate } from 'react-router-dom';
import { ApiNotConfiguredError } from '../../api/client';
import Button from './Button';

export default function ErrorState({ error, onRetry, compact = false }) {
  const navigate = useNavigate();
  const isNotConfigured = error instanceof ApiNotConfiguredError || error?.name === 'ApiNotConfiguredError';

  if (isNotConfigured) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 text-center ${compact ? 'py-6' : 'py-10'}`}>
        <span className="material-symbols-outlined text-[28px] text-secondary">link_off</span>
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-[13px] text-on-surface">MFC API not connected yet</p>
          <p className="text-[12px] text-secondary max-w-sm">
            Add the deployed Apps Script web app URL in Settings to load live supplier data.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate('/settings')}>
          Go to Settings
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center ${compact ? 'py-6' : 'py-10'}`}>
      <span className="material-symbols-outlined text-[28px] text-error">error</span>
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-[13px] text-on-surface">Couldn't load this data</p>
        <p className="text-[12px] text-secondary max-w-sm">
          {error?.message || 'Something went wrong talking to the MFC API.'}
        </p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
