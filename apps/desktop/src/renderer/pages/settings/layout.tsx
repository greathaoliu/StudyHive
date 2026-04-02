import { NavLink, Outlet } from "react-router"

export function SettingsLayout() {
  return (
    <div className="flex h-full">
      {/* Settings sidebar */}
      <div className="w-52 flex-shrink-0 border-r border-base-300 bg-base-200/30 p-4">
        <h3 className="mb-4 text-base font-bold text-base-content/80">设置</h3>
        <nav className="flex flex-col gap-0.5">
          <NavLink
            to="/settings"
            end
            className={({ isActive }) =>
              `btn btn-ghost btn-sm w-full justify-start rounded-lg text-sm ${
                isActive ? "bg-primary/10 text-primary font-medium" : "text-base-content/70"
              }`
            }
          >
            🔧 通用
          </NavLink>
          <NavLink
            to="/settings/ai"
            className={({ isActive }) =>
              `btn btn-ghost btn-sm w-full justify-start rounded-lg text-sm ${
                isActive ? "bg-primary/10 text-primary font-medium" : "text-base-content/70"
              }`
            }
          >
            🤖 AI 配置
          </NavLink>
          <NavLink
            to="/settings/sources"
            className={({ isActive }) =>
              `btn btn-ghost btn-sm w-full justify-start rounded-lg text-sm ${
                isActive ? "bg-primary/10 text-primary font-medium" : "text-base-content/70"
              }`
            }
          >
            🌐 信息源
          </NavLink>
          <NavLink
            to="/settings/devlog"
            className={({ isActive }) =>
              `btn btn-ghost btn-sm w-full justify-start rounded-lg text-sm ${
                isActive ? "bg-primary/10 text-primary font-medium" : "text-base-content/70"
              }`
            }
          >
            🛠 开发者日志
          </NavLink>
        </nav>
      </div>
      {/* Settings content */}
      <div className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </div>
    </div>
  )
}
