import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { mfcApi } from '../../api/mfc';

export default function SignInPage() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const markSessionChecked = useAuthStore((s) => s.markSessionChecked);
  const apiBaseUrl = useSettingsStore((s) => s.apiBaseUrl);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSignInWithGoogle = async () => {
    // --- ELECTRON PATH ---
    if (window.electronAuth && window.electronAuth.openGoogleLogin) {
      setLoading(true);
      setErrorMsg('');
      try {
        const targetUrl = apiBaseUrl
          ? `${apiBaseUrl}${apiBaseUrl.includes('?') ? '&' : '?'}action=getDashboardData`
          : 'https://accounts.google.com/ServiceLogin';
        await window.electronAuth.openGoogleLogin(targetUrl);

        const session = await window.electronAuth.checkGoogleSession();
        if (!session.valid) throw new Error('Google login did not establish a session. Please try again.');

        let user = { email: 'user@glovoapp.com', name: 'User' };
        try {
          const profile = await mfcApi.getUserInfo();
          if (profile.email) {
            user = { email: profile.email, name: profile.email.split('@')[0] };
          }
        } catch (_) { /* fallback to placeholder */ }

        setAuth({ user });
        markSessionChecked();
      } catch (err) {
        setErrorMsg(err.message || 'Google Workspace login failed.');
      } finally { setLoading(false); }
      return;
    }

    // --- BROWSER PATH ---
    const input = prompt('Enter your @glovoapp.com email:');
    if (input && input.trim().toLowerCase().endsWith('@glovoapp.com')) {
      const email = input.trim().toLowerCase();
      const name = email.split('@')[0];
      setAuth({ user: { email, name } });
      markSessionChecked();
    } else if (input) {
      setErrorMsg('Please use a valid @glovoapp.com email address.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #FFC244 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #00A082 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-[#FFC244] flex items-center justify-center text-[#5c4200] font-bold text-2xl shadow-lg">G</div>
          <div className="text-center">
            <h1 className="text-[24px] font-semibold text-on-background tracking-tight">QCommerce Hub</h1>
            <p className="text-[13px] text-secondary mt-0.5">Internal Operations Platform</p>
          </div>
        </div>

        <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg shadow-card p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-[14px] font-semibold text-on-surface">Employee Sign In</h2>
            <p className="text-[12px] text-secondary">Sign in with your <span className="font-medium text-on-surface">@glovoapp.com</span> Google Workspace account.</p>
          </div>

          <div className="flex flex-col gap-3">
            {errorMsg && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-50 text-error text-[12px]">
                <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">error</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSignInWithGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-md bg-[#FFC244] text-[#5c4200] font-medium text-[13px] hover:brightness-95 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  <span className="text-[12px]">Connecting to Glovo Workspace…</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 48 48" className="shrink-0">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.08 24.08 0 0 0 0 21.56l7.98-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>Sign in with Glovo Google Account</span>
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-secondary/60 text-center">Restricted access for <span className="font-mono font-medium">@glovoapp.com</span> personnel.</p>
      </div>
    </div>
  );
}
