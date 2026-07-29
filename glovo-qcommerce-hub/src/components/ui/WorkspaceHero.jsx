import StatusChip from './StatusChip';

export default function WorkspaceHero({ icon, title, subtitle, status, lastUpdated, actions }) {
  return (
    <section className="relative overflow-hidden bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-card">
      <div className="relative z-10 flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-md bg-surface-container flex items-center justify-center shrink-0 border border-outline-variant">
          <span className="material-symbols-outlined text-[18px] text-secondary">{icon}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[14px] font-semibold leading-tight truncate text-on-surface">{title}</h2>
            {status && (
              <StatusChip tone={status.tone} className="shrink-0">
                {status.label}
              </StatusChip>
            )}
          </div>
          <p className="text-[12px] text-secondary truncate max-w-xl">{subtitle}</p>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-3 shrink-0">
        {lastUpdated && (
          <div className="hidden sm:flex flex-col text-right text-[10px] text-secondary leading-tight">
            <span className="uppercase tracking-wide">Last updated</span>
            <span className="font-medium text-on-surface">{lastUpdated}</span>
          </div>
        )}
        {actions}
      </div>
    </section>
  );
}
