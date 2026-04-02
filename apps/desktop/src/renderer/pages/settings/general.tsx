import { useState, useEffect } from "react"
import { useCurriculumStore, TrainingProgram } from "../../store/curriculum"

const THEME_KEY = "studyhive-theme"

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function loadTheme(): "system" | "light" | "dark" {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === "light" || saved === "dark" || saved === "system") return saved
  } catch { /* ignore */ }
  return "system"
}

function applyTheme(setting: "system" | "light" | "dark") {
  const theme = setting === "system" ? getSystemTheme() : setting
  document.documentElement.setAttribute("data-theme", theme)
}

export function GeneralSettings() {
  const { programs, activeProgramId, setActiveProgramId, removeProgram, normalizeCourses, parsing } = useCurriculumStore()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [theme, setTheme] = useState(loadTheme)

  useEffect(() => {
    applyTheme(theme)
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => applyTheme("system")
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }
  }, [theme])

  const handleThemeChange = (value: string) => {
    const t = value as "system" | "light" | "dark"
    setTheme(t)
    localStorage.setItem(THEME_KEY, t)
    applyTheme(t)
  }

  const handleDeleteProgram = (id: string) => {
    removeProgram(id)
    setConfirmDeleteId(null)
  }

  return (
    <div className="max-w-2xl">
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="text-xl font-bold">通用设置</h2>
        <p className="mt-1 text-sm text-base-content/50">管理培养方案和应用偏好</p>
      </div>

      {/* Training Programs Section */}
      <section className="mb-10">
        <div className="mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-base-content/60">培养方案</h3>
          <p className="mt-1 text-xs text-base-content/40">点击切换当前使用的培养方案</p>
        </div>
        <div className="space-y-2">
          {programs.map((program: TrainingProgram) => {
            const isActive = program.id === activeProgramId
            return (
              <div
                key={program.id}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all ${
                  isActive
                    ? "border-primary/40 bg-primary/5 shadow-sm"
                    : "border-transparent bg-base-200/50 hover:bg-base-200"
                }`}
              >
                <button
                  onClick={() => setActiveProgramId(program.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${isActive ? "text-primary" : "text-base-content/30"}`}>
                      {isActive ? "●" : "○"}
                    </span>
                    <span className={`text-sm font-semibold truncate ${isActive ? "text-primary" : ""}`}>
                      {program.name}
                    </span>
                  </div>
                  <div className="ml-5 mt-0.5 text-xs text-base-content/50">
                    {program.school} · {program.courses.length} 门课程 · {program.uploadedAt}
                  </div>
                </button>
                {confirmDeleteId === program.id ? (
                  <div className="flex gap-1.5">
                    <button onClick={() => handleDeleteProgram(program.id)} className="btn btn-error btn-xs">确认删除</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="btn btn-ghost btn-xs">取消</button>
                  </div>
                ) : (
                  <div className="flex gap-1.5 items-center">
                    <button
                      onClick={() => normalizeCourses(program.id)}
                      disabled={parsing}
                      className="btn btn-ghost btn-xs opacity-40 hover:opacity-100 text-primary"
                      title="用 AI 合并分学期课程、标准化课程名"
                    >
                      {parsing && activeProgramId === program.id ? <span className="loading loading-spinner loading-xs" /> : "✨ 规范化"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(program.id)}
                      className="btn btn-ghost btn-xs opacity-40 hover:opacity-100 hover:text-error transition-opacity"
                      title="删除此方案"
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Appearance Section */}
      <section className="mb-10">
        <div className="mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-base-content/60">外观</h3>
        </div>

        <div className="rounded-xl bg-base-200/50 p-5 space-y-5">
          <div>
            <label className="text-sm font-medium">主题</label>
            <p className="text-xs text-base-content/40 mt-0.5 mb-2">选择应用的颜色方案</p>
            <div className="join w-full max-w-xs">
              {[
                { value: "system", label: "跟随系统" },
                { value: "light", label: "浅色" },
                { value: "dark", label: "深色" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleThemeChange(opt.value)}
                  className={`btn btn-sm join-item flex-1 ${
                    theme === opt.value ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Other Settings */}
      <section>
        <div className="mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-base-content/60">其他</h3>
        </div>
        <div className="rounded-xl bg-base-200/50 p-5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" defaultChecked />
            <div>
              <span className="text-sm font-medium">启动时自动检查更新</span>
              <p className="text-xs text-base-content/40">有新版本时自动提示下载</p>
            </div>
          </label>
        </div>
      </section>
    </div>
  )
}
