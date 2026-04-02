import { useState } from "react"
import { useDevLogStore, DevLogLevel } from "../../store/devlog"

const levelStyle: Record<DevLogLevel, { badge: string; text: string }> = {
  info:    { badge: "badge-info",    text: "text-info" },
  success: { badge: "badge-success", text: "text-success" },
  warn:    { badge: "badge-warning", text: "text-warning" },
  error:   { badge: "badge-error",   text: "text-error" },
  raw:     { badge: "badge-ghost",   text: "text-base-content/50" },
}

export function DevLogPage() {
  const { entries, clear } = useDevLogStore()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<DevLogLevel | "all">("all")

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = filter === "all" ? entries : entries.filter((e) => e.level === filter)

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">开发者日志</h2>
          <p className="mt-1 text-sm text-base-content/50">实时记录 AI 搜索的原始请求、回包与过滤过程</p>
        </div>
        <button onClick={clear} className="btn btn-ghost btn-sm text-error">清空日志</button>
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-base-content/40 mr-1">筛选:</span>
        {(["all", "info", "success", "warn", "error", "raw"] as const).map((lvl) => (
          <button
            key={lvl}
            onClick={() => setFilter(lvl)}
            className={`btn btn-xs ${filter === lvl ? "btn-active btn-neutral" : "btn-ghost"}`}
          >
            {lvl === "all" ? "全部" : lvl}
            {lvl !== "all" && (
              <span className="ml-1 opacity-50">
                {entries.filter((e) => e.level === lvl).length}
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto text-xs text-base-content/30">{filtered.length} 条</span>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl bg-base-200/40 py-16 text-center text-sm text-base-content/30">
          {entries.length === 0 ? "暂无日志，点击搜集按钮后会出现" : "该筛选下无条目"}
        </div>
      )}

      {/* Log entries — newest first */}
      <div className="space-y-0.5 font-mono text-xs">
        {[...filtered].reverse().map((entry) => {
          const style = levelStyle[entry.level]
          const hasDetail = !!entry.detail
          const expanded = expandedIds.has(entry.id)

          return (
            <div key={entry.id} className="rounded-md overflow-hidden">
              <div
                className={`flex items-start gap-2 px-3 py-1.5 ${hasDetail ? "cursor-pointer hover:bg-base-200/60" : ""} ${entry.level === "error" ? "bg-error/5" : entry.level === "warn" ? "bg-warning/5" : ""}`}
                onClick={() => hasDetail && toggleExpand(entry.id)}
              >
                <span className="text-base-content/30 flex-shrink-0 w-[70px]">{entry.timestamp}</span>
                <span className={`badge badge-xs flex-shrink-0 ${style.badge}`}>{entry.category}</span>
                <span className={`flex-1 break-all ${style.text}`}>{entry.message}</span>
                {hasDetail && (
                  <span className={`flex-shrink-0 text-base-content/30 transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span>
                )}
              </div>
              {hasDetail && expanded && (
                <pre className="px-3 py-2 bg-base-300/40 text-base-content/60 whitespace-pre-wrap break-all overflow-x-auto leading-relaxed border-l-2 border-base-content/10">
                  {entry.detail}
                </pre>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
