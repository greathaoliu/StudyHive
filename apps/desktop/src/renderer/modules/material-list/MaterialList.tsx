import { useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { useMaterialStore, MaterialItem } from "../../store/material"
import { useCurriculumStore } from "../../store/curriculum"

const typeIcons: Record<string, string> = {
  courseware: "📄",
  video: "🎬",
  exam: "📝",
  notes: "📒",
  link: "🔗",
}

const typeLabels: Record<string, string> = {
  courseware: "课件",
  video: "视频",
  exam: "试题",
  notes: "笔记",
  link: "链接",
}

type ViewMode = "list" | "source" | "knowledge"

function MaterialCard({ item, selectedId, onSelect, onArchive, onDelete, onFavorite }: {
  item: MaterialItem
  selectedId: string | null
  onSelect: () => void
  onArchive: () => void
  onDelete: () => void
  onFavorite: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (confirmDelete) {
    return (
      <div className="border-b border-base-300 p-3 bg-error/5">
        <span className="text-xs text-error">删除「{item.title}」?</span>
        <div className="mt-1 flex gap-1">
          <button onClick={() => { onDelete(); setConfirmDelete(false) }} className="btn btn-error btn-xs px-2">确认</button>
          <button onClick={() => setConfirmDelete(false)} className="btn btn-ghost btn-xs px-2">取消</button>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`cursor-pointer border-b border-base-300 p-3 transition-colors hover:bg-base-200 relative ${
        selectedId === item.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg">{typeIcons[item.type]}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-tight truncate">{item.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {item.university && (
              <span className="badge badge-xs badge-secondary">{item.university}</span>
            )}
            <span className="badge badge-xs badge-outline opacity-60">{item.sourceName}</span>
            <span className={`badge badge-xs ${item.source === "crawl" ? "badge-info" : "badge-success"}`}>
              {item.source === "crawl" ? "搜集" : "上传"}
            </span>
            <span className="badge badge-xs badge-ghost">{typeLabels[item.type]}</span>
            {item.fileUrl && item.downloadStatus === "done" && (
              <span className="badge badge-xs badge-success gap-0.5">✅ 已保存</span>
            )}
            {item.fileUrl && item.downloadStatus === "downloading" && (
              <span className="badge badge-xs badge-warning gap-0.5">
                <span className="loading loading-spinner loading-xs" /> 下载中
              </span>
            )}
            {item.fileUrl && item.downloadStatus === "error" && (
              <span className="badge badge-xs badge-error">下载失败</span>
            )}
            {item.fileUrl && item.downloadStatus === "none" && (
              <span className="badge badge-xs badge-outline opacity-40">待下载</span>
            )}
            {item.duration && (
              <span className="text-xs text-base-content/40">{item.duration}</span>
            )}
            {item.filePages && (
              <span className="text-xs text-base-content/40">{item.filePages} 页</span>
            )}
          </div>
          {item.summary && (
            <p className="mt-1 text-xs text-primary/70 line-clamp-2">{item.summary}</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs text-base-content/40">#{tag}</span>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-base-content/30">{item.createdAt}</span>
            {(item.fileUrl || item.externalUrl) && (
              <a
                href={item.externalUrl || item.fileUrl}
                className="text-xs text-primary/50 hover:text-primary truncate max-w-[180px]"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                🔗 原始来源
              </a>
            )}
            {!item.fileUrl && !item.externalUrl && item.searchQuery && (
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(item.searchQuery)}`}
                className="text-xs text-base-content/30 hover:text-primary"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={item.searchQuery}
              >
                🔍 搜索原链接
              </a>
            )}
          </div>
        </div>
      </div>
      {hovered && (
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onFavorite() }}
            className={`btn btn-xs px-1 ${item.favorited ? "text-warning" : "opacity-60 hover:opacity-100"}`}
            title={item.favorited ? "取消收藏" : "收藏"}
          >
            {item.favorited ? "⭐" : "☆"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onArchive() }}
            className="btn btn-xs px-1 opacity-60 hover:opacity-100"
            title={item.archived ? "取消归档" : "归档"}
          >
            {item.archived ? "📂" : "📁"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
            className="btn btn-xs px-1 opacity-60 hover:opacity-100 text-error"
            title="删除"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export function MaterialList() {
  const {
    materials, selectedId, filter, activeCourse,
    setSelectedId, setFilter, searchStatus, searchProgress,
    summaryGenerating, summaryProgress, generateAllSummaries,
    removeMaterial, toggleArchiveMaterial, toggleFavoriteMaterial,
    removeNoUrlMaterials,
  } = useMaterialStore()
  const { aiSettings } = useCurriculumStore()
  const location = useLocation()
  const navigate = useNavigate()

  const isOverlay = location.pathname.startsWith("/settings") || location.pathname === "/collection"

  const selectMaterial = (id: string) => {
    setSelectedId(id)
    if (isOverlay) navigate("/")
  }

  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [showArchived, setShowArchived] = useState(false)

  const courseFiltered = activeCourse
    ? materials.filter((m) => m.courseName === activeCourse && !m.archived)
    : materials.filter((m) => !m.archived)
  const filtered = filter === "all" ? courseFiltered : courseFiltered.filter((m) => m.type === filter)
  const archivedMaterials = materials.filter((m) => m.archived && (!activeCourse || m.courseName === activeCourse))

  const headerTitle = activeCourse || "全部资料"
  const doneCount = courseFiltered.filter((m) => m.downloadStatus === "done").length

  // Group by source
  const sourceGroups = (() => {
    const map = new Map<string, typeof materials>()
    for (const m of filtered) {
      if (!map.has(m.sourceName)) map.set(m.sourceName, [])
      map.get(m.sourceName)!.push(m)
    }
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }))
  })()

  // Group by knowledge point
  const kpGroups = (() => {
    const map = new Map<string, typeof materials>()
    for (const m of filtered) {
      const points = m.knowledgePoints && m.knowledgePoints.length > 0 ? m.knowledgePoints : ["未分类"]
      for (const p of points) {
        if (!map.has(p)) map.set(p, [])
        if (!map.get(p)!.some((e) => e.id === m.id)) map.get(p)!.push(m)
      }
    }
    return Array.from(map.entries()).map(([point, items]) => ({ point, items }))
  })()

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-base-300 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{headerTitle}</h2>
          <div className="flex items-center gap-1">
            {materials.filter((m) => m.source === "crawl" && !m.fileUrl && !m.externalUrl && !m.localPath).length > 0 && (
              <button
                onClick={() => removeNoUrlMaterials()}
                className="btn btn-xs btn-ghost text-error opacity-60 hover:opacity-100"
                title="删除所有无链接的 AI 生成条目"
              >
                🗑 清除幻觉 ({materials.filter((m) => m.source === "crawl" && !m.fileUrl && !m.externalUrl && !m.localPath).length})
              </button>
            )}
            <span className="text-xs text-base-content/50">{filtered.length} 项</span>
          </div>
        </div>

        {/* Download progress */}
        {(searchStatus === "downloading" || searchStatus === "searching") && (
          <div className="mt-1.5">
            <progress className="progress progress-primary w-full progress-xs" />
            <p className="mt-0.5 text-xs text-primary">{searchProgress}</p>
          </div>
        )}
        {doneCount > 0 && searchStatus === "idle" && (
          <p className="mt-1 text-xs text-success">✅ {doneCount}/{courseFiltered.length} 已保存本地</p>
        )}

        {/* View mode tabs */}
        <div className="mt-2 flex items-center gap-1">
          {(["list", "source", "knowledge"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`btn btn-xs ${viewMode === mode ? "btn-active btn-secondary" : "btn-ghost"}`}
            >
              {mode === "list" ? "列表" : mode === "source" ? "按来源" : "按知识点"}
            </button>
          ))}
          {aiSettings.apiKey && (
            <button
              onClick={() => generateAllSummaries()}
              disabled={summaryGenerating}
              className="btn btn-xs btn-ghost ml-auto text-primary"
            >
              {summaryGenerating ? (
                <><span className="loading loading-spinner loading-xs" /> {summaryProgress}</>
              ) : (
                "✨ AI 总结全部"
              )}
            </button>
          )}
        </div>

        {/* Type filter tabs */}
        <div className="mt-1.5 flex gap-1">
          {(["all", "courseware", "video", "exam", "notes", "link"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`btn btn-xs ${filter === t ? "btn-primary" : "btn-ghost"}`}
            >
              {t === "all" ? "全部" : typeLabels[t]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === "list" && filtered.map((item) => (
          <MaterialCard
            key={item.id}
            item={item}
            selectedId={selectedId}
            onSelect={() => selectMaterial(item.id)}
            onArchive={() => toggleArchiveMaterial(item.id)}
            onDelete={() => removeMaterial(item.id)}
            onFavorite={() => toggleFavoriteMaterial(item.id)}
          />
        ))}

        {viewMode === "source" && sourceGroups.map(({ name, items }) => (
          <div key={name}>
            <div className="sticky top-0 z-10 bg-base-200/90 backdrop-blur px-3 py-1.5 border-b border-base-300">
              <span className="text-xs font-semibold text-base-content/60">{name}</span>
              <span className="ml-1 text-xs text-base-content/40">({items.length})</span>
            </div>
            {items.map((item) => (
              <MaterialCard
                key={item.id}
                item={item}
                selectedId={selectedId}
                onSelect={() => selectMaterial(item.id)}
                onArchive={() => toggleArchiveMaterial(item.id)}
                onDelete={() => removeMaterial(item.id)}
                onFavorite={() => toggleFavoriteMaterial(item.id)}
              />
            ))}
          </div>
        ))}

        {viewMode === "knowledge" && kpGroups.map(({ point, items }) => (
          <div key={point}>
            <div className="sticky top-0 z-10 bg-base-200/90 backdrop-blur px-3 py-1.5 border-b border-base-300">
              <span className="text-xs font-semibold text-primary/70">{point}</span>
              <span className="ml-1 text-xs text-base-content/40">({items.length})</span>
            </div>
            {items.map((item) => (
              <MaterialCard
                key={item.id}
                item={item}
                selectedId={selectedId}
                onSelect={() => selectMaterial(item.id)}
                onArchive={() => toggleArchiveMaterial(item.id)}
                onDelete={() => removeMaterial(item.id)}
                onFavorite={() => toggleFavoriteMaterial(item.id)}
              />
            ))}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-12 text-sm text-base-content/30">
            暂无资料
          </div>
        )}

        {/* Archived section */}
        {archivedMaterials.length > 0 && (
          <div className="mt-2 border-t border-base-300">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="btn btn-ghost btn-sm w-full justify-start gap-2 text-base-content/40"
            >
              <span className={`text-xs transition-transform ${showArchived ? "rotate-90" : ""}`}>▶</span>
              <span className="text-xs">已归档 ({archivedMaterials.length})</span>
            </button>
            {showArchived && archivedMaterials.map((item) => (
              <MaterialCard
                key={item.id}
                item={item}
                selectedId={selectedId}
                onSelect={() => selectMaterial(item.id)}
                onArchive={() => toggleArchiveMaterial(item.id)}
                onDelete={() => removeMaterial(item.id)}
                onFavorite={() => toggleFavoriteMaterial(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
