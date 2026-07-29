import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import UpdateBanner from '../ui/UpdateBanner';

const TOOL_ROUTES = ['/mfc/suppliers'];

export default function AppShell() {
  const { pathname } = useLocation();
  const isTool = TOOL_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <div className="flex min-h-screen bg-background">
      {!isTool && <Sidebar />}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Outlet />
      </main>
      <UpdateBanner />
    </div>
  );
}
