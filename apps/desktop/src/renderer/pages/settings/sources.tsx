import { useState } from "react"
import { useCurriculumStore } from "../../store/curriculum"

export function SourcesSettings() {
  const { infoSources, searchMode, setSearchMode, addInfoSource, removeInfoSource, toggleInfoSource, updateInfoSource } =
    useCurriculumStore()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editUrl, setEditUrl] = useState("")

  const handleAdd = () => {
    const name = newName.trim()
    const url = newUrl.trim()
    if (!name || !url) return
    addInfoSource({ name, url, enabled: true })
    setNewName("")
    setNewUrl("")
    setShowAdd(false)
  }

  const startEdit = (id: string, name: string, url: string) => {
    setEditingId(id)
    setEditName(name)
    setEditUrl(url)
  }

  const saveEdit = () => {
    if (!editingId) return
    const name = editName.trim()
    const url = editUrl.trim()
    if (!name || !url) return
    updateInfoSource(editingId, { name, url })
    setEditingId(null)
  }

  const enabledCount = infoSources.filter((s) => s.enabled).length

  return (
    <div className="max-w-2xl">
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="text-xl font-bold">信息源管理</h2>
        <p className="mt-1 text-sm text-base-content/50">
          配置搜集资料时参考的来源网站，启用/禁用不同的信息源
        </p>
      </div>

      {/* Search Mode */}
      <section className="mb-8">
        <div className="mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-base-content/60">搜索模式</h3>
        </div>
        <div className="rounded-xl bg-base-200/50 p-5">
          <div className="join w-full">
            <button
              onClick={() => setSearchMode("focused")}
              className={`btn btn-sm join-item flex-1 ${searchMode === "focused" ? "btn-primary" : "btn-ghost"}`}
            >
              🎯 聚焦模式
            </button>
            <button
              onClick={() => setSearchMode("divergent")}
              className={`btn btn-sm join-item flex-1 ${searchMode === "divergent" ? "btn-secondary" : "btn-ghost"}`}
            >
              🌐 发散模式
            </button>
          </div>
          <p className="mt-3 text-xs text-base-content/50 leading-relaxed">
            {searchMode === "focused"
              ? "聚焦模式：AI 仅从下方已启用的信息源搜集资料，结果更精准可控"
              : "发散模式：AI 会在更广泛的渠道搜索资料，可能发现更多意想不到的优质内容"}
          </p>
        </div>
      </section>

      {/* Source List */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-base-content/60">信息源列表</h3>
            <p className="text-xs text-base-content/40 mt-0.5">{enabledCount}/{infoSources.length} 已启用</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="btn btn-primary btn-sm gap-1"
          >
            + 添加
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="mb-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="名称（如: 中国大学MOOC）"
                className="input input-bordered input-sm flex-1"
                autoFocus
              />
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://..."
                className="input input-bordered input-sm flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={handleAdd} disabled={!newName.trim() || !newUrl.trim()} className="btn btn-primary btn-sm px-4">
                添加
              </button>
              <button onClick={() => { setShowAdd(false); setNewName(""); setNewUrl("") }} className="btn btn-ghost btn-sm">
                取消
              </button>
            </div>
          </div>
        )}

        {/* Sources */}
        <div className="space-y-1.5">
          {infoSources.map((source) => (
            <div
              key={source.id}
              className={`group flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                source.enabled
                  ? "bg-base-200/50 hover:bg-base-200"
                  : "bg-base-200/20 opacity-50 hover:opacity-70"
              }`}
            >
              <input
                type="checkbox"
                checked={source.enabled}
                onChange={() => toggleInfoSource(source.id)}
                className="checkbox checkbox-sm checkbox-primary flex-shrink-0"
              />
              {editingId === source.id ? (
                <div className="flex flex-1 gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input input-bordered input-sm flex-1"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="input input-bordered input-sm flex-1"
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  />
                  <button onClick={saveEdit} className="btn btn-primary btn-sm">保存</button>
                  <button onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm">取消</button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{source.name}</div>
                    <div className="text-xs text-base-content/40 truncate">{source.url}</div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(source.id, source.name, source.url)}
                      className="btn btn-ghost btn-xs"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => removeInfoSource(source.id)}
                      className="btn btn-ghost btn-xs text-error"
                    >
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {infoSources.length === 0 && (
          <div className="py-12 text-center text-sm text-base-content/30">
            暂无信息源，点击上方按钮添加
          </div>
        )}
      </section>
    </div>
  )
}
