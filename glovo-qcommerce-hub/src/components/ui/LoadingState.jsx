import clsx from 'clsx';

export function Spinner({ className }) {
  return (
    <span
      className={clsx('material-symbols-outlined animate-spin text-[#FFC244]', className)}
      aria-hidden="true"
    >
      progress_activity
    </span>
  );
}

export function LoadingPanel({ message = 'Loading\u2026' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-secondary" role="status">
      <Spinner className="text-[22px]" />
      <span className="text-[12px]">{message}</span>
    </div>
  );
}

export function SkeletonRows({ rows = 5, cols = 4 }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-3.5 flex-1 rounded bg-surface-container animate-pulse" style={{ animationDelay: `${(r * cols + c) * 30}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonKpiRow({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-20 rounded-lg bg-surface-container animate-pulse border border-outline-variant" />
      ))}
    </div>
  );
}
