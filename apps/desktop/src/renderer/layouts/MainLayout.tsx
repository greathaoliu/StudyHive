import { Outlet, useLocation } from "react-router"
import { Sidebar } from "../modules/sidebar/Sidebar"
import { MaterialList } from "../modules/material-list/MaterialList"
import { ContentPanel } from "../modules/material-content/ContentPanel"
import { ChatPanel } from "../modules/chat/ChatPanel"

export function MainLayout() {
  const location = useLocation()
  const isOverlayPage = location.pathname.startsWith("/settings") || location.pathname === "/collection" || location.pathname === "/upload"

  return (
    <div className="flex h-screen flex-col bg-base-100 text-base-content">
      {/* Title bar */}
      <div
        className="flex items-center border-b border-base-300 bg-base-200"
        style={{ height: "var(--titlebar-height)", paddingLeft: "78px", paddingTop: "4px", WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <span className="text-sm font-semibold text-base-content/60">StudyHive</span>
        <div className="ml-auto flex items-center gap-2 pr-4" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <span className="text-xs text-base-content/40">v0.1.0</span>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside
          className="flex-shrink-0 border-r border-base-300 bg-base-200"
          style={{ width: "var(--sidebar-width)" }}
        >
          <Sidebar />
        </aside>

        {/* Middle panel - material list */}
        <div
          className="flex-shrink-0 border-r border-base-300"
          style={{ width: "var(--list-width)" }}
        >
          <MaterialList />
        </div>

        {/* Right panel - content or overlay page */}
        <main className="flex-1 overflow-hidden relative">
          <ContentPanel />
          {isOverlayPage && (
            <div className="absolute inset-0 bg-base-100 z-10 overflow-y-auto">
              <Outlet />
            </div>
          )}
        </main>
        <ChatPanel />
      </div>
    </div>
  )
}
