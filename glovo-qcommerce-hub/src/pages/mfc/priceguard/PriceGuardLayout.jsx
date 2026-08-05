import { Outlet } from 'react-router-dom';
import PriceGuardSidebar from './PriceGuardSidebar';

/**
 * Price Guard keeps its own persistent vertical sidebar for navigation
 * (unlike Ultrafresh Availability's TopNav tabs) — each page renders its
 * own inline title block rather than sharing a TopNav header.
 */
export default function PriceGuardLayout() {
  return (
    <div className="flex flex-1 min-h-0">
      <PriceGuardSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto bg-surface">
        <Outlet />
      </main>
    </div>
  );
}
