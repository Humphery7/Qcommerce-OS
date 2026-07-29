import { useState } from 'react';
import TopNav from '../../components/layout/TopNav';
import Button from '../../components/ui/Button';
import { useSettingsStore } from '../../store/useSettingsStore';
import { mfcApi } from '../../api/mfc';

export default function SettingsPage() {
  const apiBaseUrl = useSettingsStore((s) => s.apiBaseUrl);
  const apiUrlFixed = useSettingsStore((s) => s.apiUrlFixed);
  const setApiBaseUrl = useSettingsStore((s) => s.setApiBaseUrl);

  const [draftApiUrl, setDraftApiUrl] = useState(apiBaseUrl);
  const [testState, setTestState] = useState({ status: 'idle', message: '' });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setApiBaseUrl(draftApiUrl);
    setTestState({ status: 'idle', message: '' });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTest = async () => {
    setTestState({ status: 'loading', message: '' });
    setApiBaseUrl(draftApiUrl);
    try {
      const result = await mfcApi.getSupplierList();
      console.log('[TestConnection] response:', typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result).substring(0, 200));
      setTestState({ status: 'success', message: 'Connected \u2014 the MFC API responded successfully.' });
    } catch (err) {
      setTestState({ status: 'error', message: err.message || 'Could not reach the API at that URL.' });
    }
  };

  return (
    <>
      <TopNav title="Settings" breadcrumb={[{ label: 'Settings' }]} />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-5 py-4 space-y-4 max-w-2xl">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-card space-y-4">
            <div>
              <h2 className="text-[14px] font-semibold text-on-surface">MFC API Connection</h2>
              <p className="text-[12px] text-secondary mt-1">
                {apiUrlFixed
                  ? 'The API URL is configured in the application build and cannot be changed here.'
                  : <>Paste the deployed Apps Script web app URL (ending in <code className="font-mono">/exec</code>) for the Supplier Availability &amp; Recommendation API.</>}
              </p>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-on-surface">API Base URL</span>
                <input
                  type="url"
                  required
                  readOnly={apiUrlFixed}
                  value={draftApiUrl}
                  onChange={(e) => setDraftApiUrl(e.target.value)}
                  placeholder="https://script.google.com/a/macros/glovoapp.com/s/XXXXXXXX/exec"
                  className="w-full bg-surface-container border border-outline-variant rounded-md px-3 py-1.5 text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={apiUrlFixed}
                />
              </label>

              {saveSuccess && !apiUrlFixed && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 text-emerald-700 text-[12px]">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Settings saved successfully!
                </div>
              )}

              {testState.status !== 'idle' && (
                <div
                  className={'flex items-center gap-2 px-3 py-2 rounded-md text-[12px] ' +
                    (testState.status === 'success' ? 'bg-emerald-50 text-emerald-700' : testState.status === 'error' ? 'bg-red-50 text-error' : 'bg-surface-container text-secondary')}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {testState.status === 'success' ? 'check_circle' : testState.status === 'error' ? 'error' : 'progress_activity'}
                  </span>
                  {testState.status === 'loading' ? 'Testing connection\u2026' : testState.message}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {!apiUrlFixed && (
                  <Button type="submit" variant="primary">
                    Save Settings
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={handleTest} loading={testState.status === 'loading'}>
                  Test Connection
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
