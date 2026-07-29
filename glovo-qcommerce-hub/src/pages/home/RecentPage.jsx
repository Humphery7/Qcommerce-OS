import TopNav from '../../components/layout/TopNav';
import EmptyState from '../../components/ui/EmptyState';

export default function RecentPage() {
  return (
    <>
      <TopNav title="Recent" />
      <div className="flex-1 overflow-y-auto no-scrollbar bg-surface">
        <div className="px-5 py-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-card">
            <EmptyState icon="history" message="Tools you've opened recently will show up here." />
          </div>
        </div>
      </div>
    </>
  );
}
