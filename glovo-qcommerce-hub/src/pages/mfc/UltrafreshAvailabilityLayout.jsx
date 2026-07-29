import { Outlet, useNavigate } from 'react-router-dom';
import TopNav from '../../components/layout/TopNav';
import Button from '../../components/ui/Button';
import { ULTRAFRESHTOOL_TABS } from './ultrafreshAvailabilityTabs';

const TEAL = '#00A082';

export default function UltrafreshAvailabilityLayout() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="h-[3px] shrink-0" style={{ background: `linear-gradient(90deg, ${TEAL} 0%, ${TEAL} 60%, transparent 100%)` }} />
      <TopNav
        title="Ultrafresh Availability"
        tabs={ULTRAFRESHTOOL_TABS}
        accentColor={TEAL}
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
