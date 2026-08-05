import { Outlet, useNavigate } from 'react-router-dom';
import TopNav from '../../components/layout/TopNav';
import Button from '../../components/ui/Button';
import { WEIGHTED_AVAILABILITY_TABS } from './weightedAvailabilityTabs';

// A distinct accent from Ultrafresh Availability's teal (#00A082), so the
// two tools are visually distinguishable at a glance even though they
// share the exact same page structure.
const BLUE = '#375aa5';

export default function WeightedAvailabilityLayout() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="h-[3px] shrink-0" style={{ background: `linear-gradient(90deg, ${BLUE} 0%, ${BLUE} 60%, transparent 100%)` }} />
      <TopNav
        title="Weighted Availability"
        tabs={WEIGHTED_AVAILABILITY_TABS}
        accentColor={BLUE}
        actions={
          <Button variant="ghost" size="sm" icon="arrow_back" onClick={() => navigate('/mfc')}>
            Exit Tool
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-7xl mx-auto px-5 py-4 space-y-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-card p-5">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
