import TopNav from '../../layout/TopNav';
import Button from '../../ui/Button';
import ErrorState from '../../ui/ErrorState';
import EmptyState from '../../ui/EmptyState';
import { SkeletonBlock, SkeletonCards } from '../../ui/LoadingState';

function formatGeneratedAt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function BulletList({ items, icon, tone }) {
  if (!items || items.length === 0) {
    return <p className="text-[12px] text-secondary italic">None.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-[12px] leading-relaxed">
          <span className={`material-symbols-outlined text-[15px] mt-0.5 shrink-0 ${tone}`}>{icon}</span>
          <span>
            <span className="font-semibold text-on-surface">{item.metric}</span>
            {item.metric && item.detail ? ': ' : ''}
            <span className="text-secondary">{item.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function StoreReviewCard({ store }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card space-y-3.5">
      <h3 className="text-[13px] font-semibold text-on-surface">{store.store}</h3>
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-secondary block mb-2">Highlights</span>
        <BulletList items={store.highlights} icon="trending_up" tone="text-emerald-600" />
      </div>
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-secondary block mb-2">Lowlights</span>
        <BulletList items={store.lowlights} icon="trending_down" tone="text-error" />
      </div>
    </section>
  );
}

function RecommendedActions({ actions }) {
  if (!actions || actions.length === 0) return null;
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
      <h3 className="text-[14px] font-semibold text-on-surface mb-3">Recommended Actions</h3>
      <ul className="space-y-2.5">
        {actions.map((a, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[12px]">
            <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0 text-accent">task_alt</span>
            <div>
              <span className="font-medium text-on-surface">{a.action}</span>
              {a.store && (
                <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-container text-secondary align-middle">
                  {a.store}
                </span>
              )}
              {a.reason && <p className="text-secondary mt-0.5">{a.reason}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Shared render for WBR-review and daily-review — same
 * {overallSummary, stores, recommendedActions} shape from
 * MfcAiReviewService's _reviewSchema_ on the backend, just generated on a
 * different cadence. Pages own the data-fetching hooks and pass the
 * results in.
 */
export default function AiReviewView({ title, breadcrumbLabel, noun, data, isLoading, isError, error, refetch, onRegenerate, isRegenerating }) {
  const review = data?.review;

  return (
    <>
      <TopNav
        title={title}
        breadcrumb={[{ label: 'MFC', to: '/mfc' }, { label: breadcrumbLabel }]}
        actions={
          <Button variant="secondary" size="sm" icon="autorenew" loading={isRegenerating} onClick={onRegenerate}>
            Regenerate
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto no-scrollbar bg-surface">
        <div className="px-5 py-4 space-y-4 max-w-5xl">
          {isError && <ErrorState error={error} onRetry={refetch} />}

          {isLoading && (
            <div className="space-y-4">
              <SkeletonBlock height={80} />
              <SkeletonCards count={2} height={220} />
            </div>
          )}

          {!isLoading && !isError && !data?.hasData && (
            <EmptyState
              icon="auto_awesome"
              message={`No ${noun} yet — click Regenerate to generate the first one now instead of waiting for the schedule.`}
              action={
                <Button variant="primary" size="sm" icon="autorenew" loading={isRegenerating} onClick={onRegenerate}>
                  Regenerate
                </Button>
              }
            />
          )}

          {!isLoading && !isError && data?.hasData && review && (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap text-[11px] text-secondary">
                <span className="font-medium text-on-surface text-[12px]">{data.periodLabel}</span>
                <span>Generated {formatGeneratedAt(data.generatedAt)}</span>
              </div>

              <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 shadow-card">
                <p className="text-[13px] text-on-surface leading-relaxed">{review.overallSummary}</p>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(review.stores || []).map((store, i) => (
                  <StoreReviewCard key={i} store={store} />
                ))}
              </div>

              <RecommendedActions actions={review.recommendedActions} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
