import { useState, useRef, useCallback } from "react"
import { useMaterialStore, MaterialItem } from "../store/material"
import { useCurriculumStore } from "../store/curriculum"

const typeLabels: Record<string, string> = {
  courseware: "课件",
  video: "视频",
  exam: "试题",
  notes: "笔记",
  link: "链接",
}

export function UploadPage() {
  const { materials } = useMaterialStore()
  const { aiSettings, getActiveCourses } = useCurriculumStore()
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<Array<{ name: string; status: "ok" | "error"; id?: string; error?: string }>>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeCourses = getActiveCourses()

  const processFiles = useCallback(async (filePaths: string[]) => {
    if (filePaths.length === 0) return

    setUploading(true)
    setUploadResults([])
    const results: typeof uploadResults = []

    for (const filePath of filePaths) {
      const fileName = filePath.split("/").pop() || filePath
      try {
        // Determine type from extension
        const ext = fileName.toLowerCase().split(".").pop() || ""
        let type: MaterialItem["type"] = "notes"
        if (["pdf", "ppt", "pptx"].includes(ext)) type = "courseware"
        if (["mp4", "avi", "mkv", "mov"].includes(ext)) type = "video"

        // Try to guess course from filename or use first active course
        let courseName = "未分类"
        for (const c of activeCourses) {
          if (fileName.includes(c.name)) {
            courseName = c.name
            break
          }
        }

        // Create the material entry
        const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const newMaterial: MaterialItem = {
          id,
          title: fileName.replace(/\.[^.]+$/, ""),
          type,
          source: "upload",
          courseName,
          sourceName: "本地上传",
          tags: [],
          knowledgePoints: [],
          createdAt: new Date().toISOString().split("T")[0],
          localPath: filePath,
          downloadStatus: "done",
          archived: false,
        }

        // Add to store
        const store = useMaterialStore.getState()
        const updatedMaterials = [...store.materials, newMaterial]
        useMaterialStore.setState({ materials: updatedMaterials })

        // Trigger AI summary if configured
        if (aiSettings.apiKey) {
          useMaterialStore.getState().generateSummary(id)
        }

        results.push({ name: fileName, status: "ok", id })
      } catch (err) {
        results.push({ name: fileName, status: "error", error: (err as Error).message })
      }
    }

    setUploadResults(results)
    setUploading(false)

    // Persist
    const store = useMaterialStore.getState()
    window.api.materialsSave(store.materials)
  }, [activeCourses, aiSettings.apiKey])

  const handleSelectFiles = async () => {
    const result = await window.api.selectFiles()
    if (result && Array.isArray(result) && result.length > 0) {
      await processFiles(result)
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      // In Electron, dropped files have a `path` property
      const paths = files.map((f) => (f as File & { path: string }).path).filter(Boolean)
      if (paths.length > 0) {
        await processFiles(paths)
      }
    }
  }, [processFiles])

  const uploadedCount = materials.filter((m) => m.source === "upload").length

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <h1 className="text-lg font-bold">上传资料</h1>
      <p className="mt-1 text-sm text-base-content/60">
        上传学习资料到本地管理，AI 将自动生成摘要
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mt-6 rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-base-300 hover:border-primary/50 hover:bg-base-200"
        }`}
        onClick={handleSelectFiles}
      >
        <input ref={fileInputRef} type="file" className="hidden" multiple />
        {uploading ? (
          <>
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="mt-3 text-sm text-base-content/50">正在导入文件...</p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-3">📤</div>
            <p className="text-sm font-medium text-base-content/70">
              拖拽文件到此处，或点击选择文件
            </p>
            <p className="mt-1 text-xs text-base-content/40">
              支持 PDF、PPT、DOC、视频等格式
            </p>
          </>
        )}
      </div>

      {/* Upload results */}
      {uploadResults.length > 0 && (
        <div className="mt-4 space-y-1">
          <h3 className="text-sm font-semibold text-base-content/60 mb-2">导入结果</h3>
          {uploadResults.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                r.status === "ok" ? "bg-success/10 text-success" : "bg-error/10 text-error"
              }`}
            >
              <span>{r.status === "ok" ? "✅" : "❌"}</span>
              <span className="flex-1 truncate">{r.name}</span>
              {r.error && <span className="text-xs opacity-70">{r.error}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {uploadedCount > 0 && (
        <div className="mt-6">
          <div className="divider" />
          <h3 className="text-sm font-semibold text-base-content/60 mb-3">已上传的资料 ({uploadedCount})</h3>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {materials.filter((m) => m.source === "upload").map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-lg border border-base-300 px-3 py-2">
                <span className="text-sm">📄</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{m.title}</div>
                  <div className="text-xs text-base-content/40">
                    {m.courseName} · {typeLabels[m.type] || m.type} · {m.createdAt}
                  </div>
                </div>
                {m.summary && <span className="badge badge-xs badge-primary">已摘要</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
