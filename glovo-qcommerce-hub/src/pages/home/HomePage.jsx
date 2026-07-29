import { useNavigate } from 'react-router-dom';
import TopNav from '../../components/layout/TopNav';
import StatusChip from '../../components/ui/StatusChip';
import { WORKSPACE_LIST } from '../../app/workspaces';
import { MFC_TOOLS } from '../../app/mfcTools';

const toolCounts = {
  mfc: MFC_TOOLS.length,
  groceries: 0,
  retail: 0
};

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <>
      <TopNav title="Home" />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <hr className="glow-line" />
        <div className="px-5 py-4 space-y-6 max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[18px] font-semibold text-on-surface">Hub Overview</h1>
              <p className="text-[12px] text-secondary mt-0.5">QCommerce operational nodes across all workspaces.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {WORKSPACE_LIST.map((ws) => (
              <button
                key={ws.id}
                onClick={() => navigate(ws.path)}
                className="text-left bg-surface-container-lowest border border-outline-variant rounded-lg p-4 hover:border-[#FFC244]/40 hover:shadow-card-hover transition-all group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#FFC244]/10 flex items-center justify-center text-[#FFC244] border border-[#FFC244]/20">
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{ws.icon}</span>
                  </div>
                  <StatusChip tone={ws.status.tone}>{ws.status.label}</StatusChip>
                </div>
                <h3 className="text-[14px] font-semibold text-on-surface">{ws.label}</h3>
                <p className="text-[11px] text-secondary mt-0.5 leading-relaxed">{ws.description}</p>
                <div className="mt-3 pt-2.5 border-t border-outline-variant/50 flex items-center gap-1.5 text-[11px] text-secondary">
                  <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                  <span>{toolCounts[ws.id]} active tool{toolCounts[ws.id] !== 1 ? 's' : ''}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="bg-gradient-to-r from-[#FFC244]/5 to-transparent border border-[#FFC244]/20 rounded-lg p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#FFC244] flex items-center justify-center text-[#5c4200] shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>warehouse</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-on-surface">MFC is live with {MFC_TOOLS.length} operational tools</p>
                <p className="text-[11px] text-secondary">Supplier availability, performance, pricing, and recommendations.</p>
              </div>
              <button
                onClick={() => navigate('/mfc')}
                className="px-3 py-1.5 rounded-md bg-[#FFC244] text-[#5c4200] text-[12px] font-medium hover:brightness-95 transition-all shrink-0 shadow-sm"
              >
                Open MFC
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
