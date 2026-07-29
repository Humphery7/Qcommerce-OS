import { Outlet } from 'react-router-dom';

/**
 * Wraps a workspace's routed pages, re-theming the `--accent` family of
 * CSS variables (read by the `accent` / `on-accent` / `accent-container`
 * / `on-accent-container` Tailwind colors) to that workspace's brand
 * color, so shared components (Button, TopNav tabs, KpiCard accents)
 * automatically pick up MFC's teal, Groceries' amber, or Retail's blue
 * without any per-workspace component variants.
 */
export default function WorkspaceLayout({ workspace, children }) {
  const style = {
    '--accent': workspace.accent.accent,
    '--on-accent': workspace.accent.onAccent,
    '--accent-container': workspace.accent.accentContainer,
    '--on-accent-container': workspace.accent.onAccentContainer
  };

  return (
    <div style={style} className="flex flex-col h-screen min-w-0">
      {children || <Outlet />}
    </div>
  );
}
