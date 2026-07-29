import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../../components/layout/TopNav';
import EmptyState from '../../components/ui/EmptyState';
import { MFC_TABS } from './mfcTabs';
import { MFC_TOOLS } from '../../app/mfcTools';

export default function MfcToolsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return MFC_TOOLS;
    const q = searchQuery.toLowerCase();
    return MFC_TOOLS.filter((t) => t.title.toLowerCase().includes(q));
  }, [searchQuery]);

  return (
    <>
      <TopNav
        title="Workspace Explorer"
        breadcrumb={[{ label: 'MFC' }, { label: 'Tools' }]}
        tabs={MFC_TABS}
        searchPlaceholder="Search MFC tools..."
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="flex-1 overflow-y-auto no-scrollbar bg-surface">
        <div className="px-5 py-4 space-y-4 max-w-7xl">
          <section>
            <h3 className="text-[14px] font-semibold text-on-surface mb-3">Tools</h3>
            {filteredTools.length === 0 ? (
              <EmptyState icon="search_off" message={`No tools match "${searchQuery}"`} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => navigate(tool.to)}
                    className="text-left bg-surface-container-lowest border border-outline-variant rounded-lg p-3.5 hover:border-accent-container/40 hover:shadow-card-hover transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="p-2 bg-surface-container rounded-lg text-secondary shrink-0">
                        <span className="material-symbols-outlined text-[20px]">{tool.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-semibold text-on-surface group-hover:text-accent-container transition-colors">{tool.title}</h3>
                        <p className="text-[11px] text-secondary mt-0.5">{tool.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[10px] font-medium text-secondary bg-surface-container px-2 py-0.5 rounded">{tool.focusArea}</span>
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {tool.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
