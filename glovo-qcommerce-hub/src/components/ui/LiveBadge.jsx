export default function LiveBadge({ label = 'Live soon' }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container text-[9px] font-semibold text-secondary uppercase tracking-wide shrink-0">
      <span className="w-1 h-1 rounded-full bg-secondary animate-pulse" />
      {label}
    </span>
  );
}
