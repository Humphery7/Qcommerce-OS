import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Button from '../../ui/Button';
import { ApiNotConfiguredError } from '../../../api/client';
import {
  useMfcWbrReview, useRegenerateWbrReview,
  useMfcDailyReview, useRegenerateDailyReview,
  useMfcMonthlyReview, useRegenerateMonthlyReview
} from '../../../api/mfc';

const REVIEW_TYPES = [
  { key: 'wbr', label: 'Weekly', icon: 'summarize', to: '/mfc/wbr-review' },
  { key: 'daily', label: 'Daily', icon: 'today', to: '/mfc/daily-review' },
  { key: 'monthly', label: 'Monthly', icon: 'calendar_month', to: '/mfc/monthly-review' }
];

// Tracks, per review type, the generatedAt of the last one the user has
// actually opened (popover or full page) — not the last one that merely
// existed. A fresh generation (new generatedAt) makes that type "unseen"
// again, independent of whether an earlier version was already seen.
const SEEN_STORAGE_KEY = 'qcommerce-hub.mfc-ai-seen.v1';

function loadSeenMap() {
  try {
    return JSON.parse(window.localStorage.getItem(SEEN_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveSeenMap(map) {
  try {
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable — the badge just won't remember across reloads.
  }
}

function formatGeneratedAt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * A quiet header button, not a hero banner — this is an optional feature
 * most people opening the page just won't touch, so it takes zero layout
 * space until clicked. Opens a small anchored popover with the same
 * period selector + preview it always had; closes on an outside click.
 *
 * Two lightweight "comes to them" signals sit on top of that: a badge dot
 * on the pill for any review generated since it was last actually opened,
 * and a one-time toast that surfaces the newest unseen one without
 * requiring a click at all. Dismissing/timing out the toast does NOT mark
 * it seen (the dot stays as a reminder) — only actually opening the
 * popover or the full page does.
 */
export default function AiInsightsHub() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('wbr');
  const [seenMap, setSeenMap] = useState(loadSeenMap);
  const [toastType, setToastType] = useState(null);
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const toastedGeneratedAtRef = useRef({});

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const queries = {
    wbr: useMfcWbrReview(),
    daily: useMfcDailyReview(),
    monthly: useMfcMonthlyReview()
  };
  const regenerators = {
    wbr: useRegenerateWbrReview(),
    daily: useRegenerateDailyReview(),
    monthly: useRegenerateMonthlyReview()
  };

  const isUnseen = (key) => {
    const d = queries[key].data;
    return Boolean(d?.hasData && d.generatedAt !== seenMap[key]);
  };
  const unseenKeys = REVIEW_TYPES.map((t) => t.key).filter(isUnseen);
  const hasUnseen = unseenKeys.length > 0;

  // Pop a toast for the newest unseen review once its data first appears
  // (or changes) in this mount — guarded per-key so a re-render doesn't
  // re-trigger it for the same generatedAt.
  useEffect(() => {
    const newestUnseen = unseenKeys
      .map((key) => ({ key, generatedAt: queries[key].data.generatedAt }))
      .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))[0];

    if (!newestUnseen) return;
    if (toastedGeneratedAtRef.current[newestUnseen.key] === newestUnseen.generatedAt) return;

    toastedGeneratedAtRef.current[newestUnseen.key] = newestUnseen.generatedAt;
    setToastType(newestUnseen.key);
    const timer = setTimeout(() => setToastType(null), 8000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queries.wbr.data?.generatedAt, queries.daily.data?.generatedAt, queries.monthly.data?.generatedAt]);

  function markSeen(keys) {
    const next = { ...seenMap };
    keys.forEach((key) => {
      const d = queries[key].data;
      if (d?.hasData) next[key] = d.generatedAt;
    });
    setSeenMap(next);
    saveSeenMap(next);
  }

  function openPopover() {
    setOpen(true);
    setToastType(null);
    markSeen(REVIEW_TYPES.map((t) => t.key));
  }

  function goTo(path, keyToMarkSeen) {
    setOpen(false);
    setToastType(null);
    if (keyToMarkSeen) markSeen([keyToMarkSeen]);
    navigate(path);
  }

  const activeType = REVIEW_TYPES.find((t) => t.key === active);
  const activeQuery = queries[active];
  const activeRegenerate = regenerators[active];
  const data = activeQuery.data;

  const toastReviewType = toastType ? REVIEW_TYPES.find((t) => t.key === toastType) : null;
  const toastData = toastType ? queries[toastType].data : null;

  return (
    <>
      <div className="relative" ref={containerRef}>
        <button
          onClick={() => (open ? setOpen(false) : openPopover())}
          className={`relative flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-[12px] font-medium border transition-all ${
            open
              ? 'border-violet-400/50 bg-violet-500/10 text-on-surface'
              : hasUnseen
                ? 'border-violet-400/60 bg-gradient-to-r from-violet-500/15 to-teal-500/15 text-on-surface hover:from-violet-500/20 hover:to-teal-500/20'
                : 'border-outline-variant bg-surface-container-lowest text-secondary hover:text-on-surface hover:border-violet-300/40'
          } ${hasUnseen && !open ? 'animate-glow-pulse' : ''}`}
        >
          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-teal-500 flex items-center justify-center text-white shrink-0">
            <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          </span>
          AI Insights
          {hasUnseen && (
            <span className="absolute -top-0.5 -right-0.5 flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-violet-400 animate-ping opacity-75" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-violet-500 ring-2 ring-surface" />
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-[calc(100%+6px)] w-72 z-50 rounded-lg border border-outline-variant bg-surface-container-lowest shadow-popover overflow-hidden">
            <div className="p-2.5 space-y-2.5">
              <div className="flex items-center gap-0.5 bg-surface-container rounded-md p-0.5">
                {REVIEW_TYPES.map((t) => (
                  <button
                    key={t.key}
                    title={t.label}
                    onClick={() => setActive(t.key)}
                    className={`relative flex-1 flex items-center justify-center gap-1 px-1 py-1 rounded text-[10.5px] font-medium transition-all ${
                      active === t.key
                        ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                        : 'text-secondary hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="min-h-[64px] flex flex-col justify-center">
                {activeQuery.isLoading && (
                  <p className="text-[11px] text-secondary">Loading…</p>
                )}

                {!activeQuery.isLoading && activeQuery.isError && (
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-1.5 text-[11px] text-error">
                      <span className="material-symbols-outlined text-[14px] shrink-0">error</span>
                      <span>
                        {activeQuery.error instanceof ApiNotConfiguredError
                          ? 'API not connected.'
                          : activeQuery.error?.detail || activeQuery.error?.message || 'Could not load.'}
                      </span>
                    </div>
                    {activeQuery.error instanceof ApiNotConfiguredError ? (
                      <Button variant="secondary" size="sm" className="w-full" onClick={() => goTo('/settings')}>Settings</Button>
                    ) : (
                      <Button variant="secondary" size="sm" className="w-full" icon="refresh" onClick={() => activeQuery.refetch()}>Retry</Button>
                    )}
                  </div>
                )}

                {!activeQuery.isLoading && !activeQuery.isError && (
                  <>
                    {activeRegenerate.isError && (
                      <div className="flex items-start gap-1.5 text-[11px] text-error bg-red-50 dark:bg-red-500/10 rounded-md px-2 py-1.5 mb-1.5">
                        <span className="material-symbols-outlined text-[13px] shrink-0">error</span>
                        <span>{activeRegenerate.error?.detail || activeRegenerate.error?.message || 'Generation failed.'}</span>
                      </div>
                    )}

                    {!data?.hasData && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-secondary">No {activeType.label.toLowerCase()} review yet.</p>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          icon="autorenew"
                          loading={activeRegenerate.isPending}
                          onClick={() => activeRegenerate.mutate()}
                        >
                          Generate now
                        </Button>
                      </div>
                    )}

                    {data?.hasData && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-medium text-on-surface">{data.periodLabel}</div>
                          <button
                            title="Regenerate"
                            onClick={() => activeRegenerate.mutate()}
                            disabled={activeRegenerate.isPending}
                            className="text-secondary hover:text-on-surface disabled:opacity-50 shrink-0"
                          >
                            <span className={`material-symbols-outlined text-[14px] ${activeRegenerate.isPending ? 'animate-spin' : ''}`}>autorenew</span>
                          </button>
                        </div>
                        <p className="text-[11.5px] text-secondary leading-relaxed line-clamp-3">
                          {data.review?.overallSummary}
                        </p>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-[10px] text-outline">{formatGeneratedAt(data.generatedAt)}</span>
                          <button
                            onClick={() => goTo(activeType.to, activeType.key)}
                            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:underline shrink-0"
                          >
                            View full
                            <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <button
                onClick={() => goTo('/mfc/ask-ai')}
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-secondary border border-outline-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[13px]">forum</span>
                Ask AI
              </button>
            </div>
          </div>
        )}
      </div>

      {toastReviewType && toastData && createPortal(
        <div className="fixed bottom-5 right-5 z-[100] w-80 rounded-lg border border-violet-300/40 dark:border-violet-400/20 bg-surface-container-lowest shadow-popover overflow-hidden">
          <div className="p-3 flex gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-teal-500 flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12px] font-semibold text-on-surface">{toastReviewType.label} review is ready</p>
                <button onClick={() => setToastType(null)} className="text-secondary hover:text-on-surface shrink-0 -mt-0.5 -mr-0.5">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
              <p className="text-[11.5px] text-secondary leading-relaxed line-clamp-2 mt-0.5">
                {toastData.review?.overallSummary}
              </p>
              <button
                onClick={() => goTo(toastReviewType.to, toastReviewType.key)}
                className="inline-flex items-center gap-0.5 text-[11.5px] font-medium text-violet-600 dark:text-violet-400 hover:underline mt-1.5"
              >
                View review
                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
