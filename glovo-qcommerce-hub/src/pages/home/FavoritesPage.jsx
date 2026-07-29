import TopNav from '../../components/layout/TopNav';
import EmptyState from '../../components/ui/EmptyState';

export default function FavoritesPage() {
  return (
    <>
      <TopNav title="Favorites" />
      <div className="flex-1 overflow-y-auto no-scrollbar bg-surface">
        <div className="px-5 py-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-card">
            <EmptyState icon="star" message="Pin tools you use often from any workspace to find them here instantly." />
          </div>
        </div>
      </div>
    </>
  );
}
