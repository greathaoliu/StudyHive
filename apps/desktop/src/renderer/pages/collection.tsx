import { useState } from "react"
import { useNavigate } from "react-router"
import { useMaterialStore, MaterialItem } from "../store/material"

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

export function CollectionPage() {
  const { materials, setSelectedId, toggleFavoriteMaterial, removeMaterial } = useMaterialStore()
  const navigate = useNavigate()
  const favorited = materials.filter((m) => m.favorited)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleSelect = (id: string) => {
    setSelectedId(id)
    navigate("/")
  }

  if (favorited.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-base-content/40">
          <div className="text-5xl mb-3">⭐</div>
          <p className="text-lg font-medium">还没有收藏资料</p>
          <p className="mt-1 text-sm">在资料列表中点击 ⭐ 按钮来收藏</p>
        </div>
      </div>
    )
  }

  // Group by course
  const courseGroups = new Map<string, MaterialItem[]>()
  for (const m of favorited) {
    if (!courseGroups.has(m.courseName)) courseGroups.set(m.courseName, [])
    courseGroups.get(m.courseName)!.push(m)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">我的收藏</h1>
          <p className="text-xs text-base-content/50 mt-1">共收藏 {favorited.length} 份资料</p>
        </div>
      </div>

      {Array.from(courseGroups.entries()).map(([courseName, items]) => (
        <div key={courseName} className="mb-6">
          <h3 className="text-sm font-semibold text-base-content/60 mb-2">{courseName}</h3>
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-base-300 px-3 py-2 hover:bg-base-200 cursor-pointer transition-colors group"
              >
                <span className="text-lg flex-shrink-0">{typeIcons[item.type]}</span>
                <button
                  onClick={() => handleSelect(item.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="text-sm font-medium truncate">{item.title}</div>
                  <div className="text-xs text-base-content/50 flex items-center gap-2 mt-0.5">
                    <span className="badge badge-xs badge-outline">{item.sourceName}</span>
                    <span>{typeLabels[item.type]}</span>
                    {item.downloadStatus === "done" && <span className="badge badge-xs badge-success">已保存</span>}
                  </div>
                  {item.summary && (
                    <p className="text-xs text-primary/60 line-clamp-1 mt-0.5">{item.summary}</p>
                  )}
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavoriteMaterial(item.id) }}
                    className="btn btn-xs btn-ghost px-1 text-warning"
                    title="取消收藏"
                  >
                    ⭐
                  </button>
                  {confirmDeleteId === item.id ? (
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); removeMaterial(item.id); setConfirmDeleteId(null) }} className="btn btn-error btn-xs px-2">确认</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }} className="btn btn-ghost btn-xs px-2">取消</button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(item.id) }}
                      className="btn btn-xs btn-ghost px-1 text-error"
                      title="删除"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
