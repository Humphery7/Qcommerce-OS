import { useEffect, useState } from 'react';
import {
  usePriceGuardSettings,
  useSavePriceGuardSettings,
  usePriceGuardPipelineStatus,
  useRunPriceGuardDailySync,
  useRunPriceGuardSnapshotNow
} from '../../../api/priceGuard';
import { SkeletonBlock } from '../../../components/ui/LoadingState';
import ErrorState from '../../../components/ui/ErrorState';
import Button from '../../../components/ui/Button';
import StatusChip from '../../../components/ui/StatusChip';
import { PRICE_GUARD_ACCENT } from './priceGuardNav';

const COMPETITOR_LABELS = { mano: 'Mano', chowstore: 'Chowstore', spar: 'SPAR Market', supersaver: 'SuperSaver Supermarket' };

function NumberField({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] font-medium text-on-surface">{label}</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value ?? ''}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all"
      />
    </label>
  );
}

export default function PriceGuardSettingsPage() {
  const { data: settingsData, isLoading, isError, error, refetch } = usePriceGuardSettings();
  const saveSettings = useSavePriceGuardSettings();
  const [settings, setSettings] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (settingsData && !settings) setSettings(settingsData);
  }, [settingsData, settings]);

  const pipeline = usePriceGuardPipelineStatus();
  const dailySync = useRunPriceGuardDailySync();
  const snapshotNow = useRunPriceGuardSnapshotNow();

  function updateThreshold(key, value) {
    setSettings((s) => ({ ...s, thresholds: { ...s.thresholds, [key]: value } }));
  }
  function updateNotification(key, value) {
    setSettings((s) => ({ ...s, notifications: { ...s.notifications, [key]: value } }));
  }
  function updateGithub(key, value) {
    setSettings((s) => ({ ...s, github: { ...s.github, [key]: value } }));
  }
  function toggleCompetitor(key) {
    setSettings((s) => ({ ...s, competitors: { ...s.competitors, [key]: !s.competitors?.[key] } }));
  }

  async function handleSave() {
    setSaveError('');
    try {
      await saveSettings.mutateAsync(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message || 'Failed to save settings.');
    }
  }

  return (
    <div className="px-5 py-4 space-y-4 max-w-6xl">
      <div>
        <h1 className="text-[20px] font-bold text-on-surface">Platform Config Rules</h1>
        <p className="text-[12px] text-secondary mt-0.5">Adjust thresholds and connect external Python adapters</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonBlock height={280} />
          <SkeletonBlock height={280} />
        </div>
      )}
      {isError && <ErrorState error={error} onRetry={refetch} />}

      {settings && !isError && (
        <>
          {saveError && (<div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 dark:bg-red-500/10 text-error text-[12px]"><span className="material-symbols-outlined text-[16px]">error</span>{saveError}</div>)}
          {saveSuccess && (<div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[12px]"><span className="material-symbols-outlined text-[16px]">check_circle</span>Settings saved.</div>)}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-card space-y-4">
              <h3 className="text-[15px] font-semibold text-on-surface">Pricing Alerts Thresholds</h3>
              <NumberField label="Selling Price Spike (Critical %)" value={settings.thresholds?.price_spike_critical} onChange={(v) => updateThreshold('price_spike_critical', v)} />
              <NumberField label="Cost Price Spike (Critical %)" value={settings.thresholds?.cost_spike_critical} onChange={(v) => updateThreshold('cost_spike_critical', v)} />
              <NumberField label="Competitor Premium Threshold (Critical %)" value={settings.thresholds?.competitor_premium_critical} onChange={(v) => updateThreshold('competitor_premium_critical', v)} />
            </section>

            <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-card space-y-4">
              <h3 className="text-[15px] font-semibold text-on-surface">System Channels & Pipeline Integration</h3>

              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-medium text-on-surface">Pricing Alerts Digest Recipient</span>
                <input
                  value={settings.notifications?.email_recipients || ''}
                  onChange={(e) => updateNotification('email_recipients', e.target.value)}
                  placeholder="name@company.com"
                  className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all"
                />
                <span className="text-[11px] text-secondary">Separate multiple emails with commas.</span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-medium text-on-surface">Slack Webhook URL</span>
                <input
                  value={settings.notifications?.slack_webhook || ''}
                  onChange={(e) => updateNotification('slack_webhook', e.target.value)}
                  placeholder="https://hooks.slack.com/…"
                  className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all"
                />
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(settings.notifications?.send_daily_summary)} onChange={(e) => updateNotification('send_daily_summary', e.target.checked)} />
                <span className="text-[13px] text-on-surface">Send daily summary email</span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-medium text-on-surface">GitHub Pipeline Repo Dispatch PATH</span>
                <input
                  value={settings.github?.repo || ''}
                  onChange={(e) => updateGithub('repo', e.target.value)}
                  placeholder="owner/price-guard-pipeline"
                  className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-medium text-on-surface">GitHub Personal Access Token</span>
                <input
                  type="password"
                  value={settings.github?.pat || ''}
                  onChange={(e) => updateGithub('pat', e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all"
                />
                <span className="text-[11px] text-secondary">Required for the rematch/scraper dispatch to authenticate against GitHub.</span>
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-on-surface">Competitors Tracked</span>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(COMPETITOR_LABELS).map((key) => {
                    const active = Boolean(settings.competitors?.[key]);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleCompetitor(key)}
                        className="px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors"
                        style={active ? { background: `${PRICE_GUARD_ACCENT}1a`, borderColor: PRICE_GUARD_ACCENT, color: PRICE_GUARD_ACCENT } : { borderColor: 'var(--outline-variant)', color: 'var(--secondary)' }}
                      >
                        {COMPETITOR_LABELS[key]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button variant="primary" icon="check_circle" loading={saveSettings.isPending} onClick={handleSave} style={{ background: PRICE_GUARD_ACCENT, color: '#fff' }}>
                Save Settings
              </Button>
            </section>
          </div>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-card space-y-3 max-w-2xl">
            <h3 className="text-[15px] font-semibold text-on-surface">Data Pipeline</h3>
            {pipeline.data && (
              <div className="flex flex-col gap-1 text-[12px] text-secondary">
                <span>Last run: <span className="text-on-surface font-medium">{pipeline.data.last_run === 'Never' ? 'Never' : new Date(pipeline.data.last_run).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>
                <span className="flex items-center gap-1.5">Status: <StatusChip tone={pipeline.data.last_status === 'SUCCESS' ? 'positive' : pipeline.data.last_status === 'Unknown' ? 'muted' : 'critical'}>{pipeline.data.last_status}</StatusChip></span>
                <span>Dataset: <span className="font-mono text-on-surface">{pipeline.data.project_id}.{pipeline.data.dataset}</span></span>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" size="sm" icon="refresh" loading={snapshotNow.isPending} onClick={() => snapshotNow.mutate()}>Refresh Snapshot Now</Button>
              <Button variant="secondary" size="sm" icon="sync" loading={dailySync.isPending} onClick={() => dailySync.mutate()}>Run Full Daily Sync</Button>
            </div>
            {dailySync.isPending && <p className="text-[11px] text-secondary">This runs the full pipeline (BigQuery + GitHub dispatch + email) and can take a while…</p>}
            {dailySync.isSuccess && <p className="text-[11px] text-emerald-600">Daily sync completed successfully.</p>}
            {dailySync.isError && <p className="text-[11px] text-error">{dailySync.error?.message || 'Daily sync failed.'}</p>}
          </section>
        </>
      )}
    </div>
  );
}
