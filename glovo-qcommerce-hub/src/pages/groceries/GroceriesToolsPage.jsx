import TopNav from '../../components/layout/TopNav';
import { GROCERIES_TABS } from './groceriesTabs';
import { GROCERIES_TOOLS } from '../../app/groceriesTools';

export default function GroceriesToolsPage() {
  return (
    <>
      <TopNav title="Workspace Explorer" breadcrumb={[{ label: 'Groceries' }, { label: 'Tools' }]} tabs={GROCERIES_TABS} />
      <div className="flex-1 overflow-y-auto no-scrollbar bg-surface">
        <div className="px-5 py-4 space-y-4 max-w-7xl">
          <section>
            <h3 className="text-[14px] font-semibold text-on-surface mb-3">Tools</h3>
            {GROCERIES_TOOLS.length === 0 ? (
              <div className="bg-surface-container-lowest border border-dashed border-outline-variant rounded-lg p-5 flex flex-col items-center justify-center gap-3 text-center shadow-card">
                <span className="material-symbols-outlined text-[36px] text-outline">construction</span>
                <div>
                  <p className="font-medium text-[13px] text-on-surface">No tools yet</p>
                  <p className="text-[12px] text-secondary max-w-md">When a Groceries tool is ready — vendor integrations, stock replenishment, or anything else — it'll show up here as a card, the same way MFC's tools do.</p>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
