export default function EmptyState({ message = 'Nothing here yet.', icon = 'inbox', action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <span className="material-symbols-outlined text-[24px] text-outline">{icon}</span>
      <p className="text-[12px] text-secondary">{message}</p>
      {action}
    </div>
  );
}
