import { useState, useCallback } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { useMaterialStore } from "../../store/material"

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

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

/* ============ PDF Viewer (从本地文件加载) ============ */
function PDFViewer({ filePath, title }: { filePath: string; title: string }) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState(1.2)
  const [error, setError] = useState<string | null>(null)

  const pdfUrl = `local-pdf://${filePath}`

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setError(null)
  }, [])

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message)
  }, [])

  return (
    <div className="mt-4 flex flex-col">
      <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-base-300 bg-base-200 px-4 py-2">
        <span className="badge badge-sm badge-ghost">本地文件</span>
        <div className="mx-2 flex items-center gap-1">
          <button onClick={() => setPageNumber((p) => Math.max(1, p - 1))} disabled={pageNumber <= 1} className="btn btn-ghost btn-xs">◀</button>
          <span className="min-w-[60px] text-center text-xs">{pageNumber} / {numPages || "?"}</span>
          <button onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages} className="btn btn-ghost btn-xs">▶</button>
        </div>
        <div className="mx-2 flex items-center gap-1">
          <button onClick={() => setScale((s) => Math.max(0.5, s - 0.1))} className="btn btn-ghost btn-xs">-</button>
          <span className="min-w-[40px] text-center text-xs">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => Math.min(3, s + 0.1))} className="btn btn-ghost btn-xs">+</button>
        </div>
        <div className="ml-auto">
          <button onClick={() => window.api.showInFolder(filePath)} className="btn btn-ghost btn-xs text-xs">📂 在文件夹中显示</button>
        </div>
      </div>
      <div className="overflow-auto rounded-b-lg border border-base-300 bg-base-300/20" style={{ maxHeight: "calc(100vh - 400px)" }}>
        {error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-sm text-error">PDF 加载失败</p>
              <p className="mt-1 text-xs text-base-content/40">{error}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-4">
            <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError}
              loading={<div className="flex items-center justify-center py-20"><span className="loading loading-spinner loading-md text-primary" /><span className="ml-2 text-sm text-base-content/50">加载 PDF...</span></div>}
            >
              <Page pageNumber={pageNumber} scale={scale} renderTextLayer={true} renderAnnotationLayer={true} />
            </Document>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============ Download Section ============ */
function DownloadSection({ materialId }: { materialId: string }) {
  const { materials, downloadMaterial } = useMaterialStore()
  const material = materials.find((m) => m.id === materialId)
  if (!material?.fileUrl) return null

  if (material.downloadStatus === "done") {
    return <div className="mt-4"><PDFViewer filePath={material.localPath!} title={material.title} /></div>
  }

  return (
    <div className="mt-4 flex flex-col items-center rounded-lg border border-dashed border-base-300 py-12">
      {material.downloadStatus === "downloading" ? (
        <><span className="loading loading-spinner loading-lg text-primary" /><p className="mt-3 text-sm text-base-content/50">正在下载并保存到本地...</p><p className="mt-1 text-xs text-base-content/30">~/StudyHive/{material.courseName}/</p></>
      ) : material.downloadStatus === "error" ? (
        <><p className="text-sm text-error">下载失败: {material.downloadError}</p><button onClick={() => downloadMaterial(materialId)} className="btn btn-primary btn-sm mt-3">重试下载</button></>
      ) : (
        <><div className="mb-2 text-3xl">📥</div><p className="text-sm text-base-content/50">此资料尚未保存到本地</p><p className="mt-1 text-xs text-base-content/30">下载后自动保存至 ~/StudyHive/{material.courseName}/</p><button onClick={() => downloadMaterial(materialId)} className="btn btn-primary btn-sm mt-4">保存到本地</button></>
      )}
    </div>
  )
}

/* ============ Video Embed ============ */

function getEmbedUrl(url: string | undefined): { embedUrl: string; platform: string } | null {
  if (!url) return null

  // Bilibili: https://www.bilibili.com/video/BV1xxxxxx or av12345
  const bvMatch = url.match(/bilibili\.com\/video\/(BV[\w]+)/)
  if (bvMatch) {
    return { embedUrl: `https://player.bilibili.com/player.html?bvid=${bvMatch[1]}&high_quality=1&autoplay=0`, platform: "Bilibili" }
  }
  const avMatch = url.match(/bilibili\.com\/video\/av(\d+)/)
  if (avMatch) {
    return { embedUrl: `https://player.bilibili.com/player.html?aid=${avMatch[1]}&high_quality=1&autoplay=0`, platform: "Bilibili" }
  }

  // YouTube: https://www.youtube.com/watch?v=xxx or https://youtu.be/xxx
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (ytMatch) {
    return { embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`, platform: "YouTube" }
  }

  return null
}

function VideoEmbed({ url, platform, duration }: { url?: string; platform?: string; duration?: string }) {
  const embed = getEmbedUrl(url)

  if (embed) {
    return (
      <div>
        <div className="aspect-video rounded-lg overflow-hidden border border-base-300">
          <iframe
            src={embed.embedUrl}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          />
        </div>
        {url && (
          <a href={url} className="btn btn-outline btn-xs mt-3" target="_blank" rel="noopener noreferrer">
            在 {embed.platform} 中打开
          </a>
        )}
      </div>
    )
  }

  // Fallback: no embeddable URL
  return (
    <div>
      <div className="flex aspect-video items-center justify-center rounded-lg border border-base-300 bg-black/80">
        <div className="text-center">
          <div className="mb-2 text-5xl text-white/80">▶</div>
          <p className="text-sm text-white/50">{platform || "视频"}</p>
          {duration && <p className="mt-1 text-xs text-white/30">时长 {duration}</p>}
          {url && <p className="mt-2 text-xs text-white/40">该平台不支持嵌入播放</p>}
        </div>
      </div>
      {url && (
        <a href={url} className="btn btn-outline btn-xs mt-3" target="_blank" rel="noopener noreferrer">
          在 {platform || "浏览器"} 中打开
        </a>
      )}
    </div>
  )
}

/* ============ Main Content Panel ============ */
export function ContentPanel() {
  const { materials, selectedId, generateSummary, toggleFavoriteMaterial } = useMaterialStore()
  const selected = materials.find((m) => m.id === selectedId)
  const [summarizing, setSummarizing] = useState(false)

  const handleGenerateSummary = async () => {
    if (!selected) return
    setSummarizing(true)
    await generateSummary(selected.id)
    setSummarizing(false)
  }

  if (!selected) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-base-content/30">
          <div className="mb-4 text-6xl">📚</div>
          <h2 className="text-lg font-medium">StudyHive</h2>
          <p className="mt-1 text-sm">选择一份资料开始阅读</p>
        </div>
      </div>
    )
  }

  const sourceUrl = selected.externalUrl || selected.fileUrl

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-base-300 px-6 py-4">
        <span className="text-2xl">{typeIcons[selected.type]}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">{selected.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-base-content/50">
            <span className="badge badge-xs badge-outline">{selected.sourceName}</span>
            {selected.university && <span className="font-medium">{selected.university}</span>}
            <span>{selected.courseName}</span>
            <span>·</span>
            <span>{typeLabels[selected.type]}</span>
            {selected.filePages && (<><span>·</span><span>{selected.filePages} 页</span></>)}
            {selected.duration && (<><span>·</span><span>{selected.duration}</span></>)}
            <span>·</span>
            <span>{selected.createdAt}</span>
            {selected.localPath && <span className="badge badge-xs badge-success">已保存本地</span>}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => toggleFavoriteMaterial(selected.id)}
            className={`btn btn-ghost btn-sm ${selected.favorited ? "text-warning" : ""}`}
            title={selected.favorited ? "取消收藏" : "收藏"}
          >
            {selected.favorited ? "⭐" : "☆"} {selected.favorited ? "已收藏" : "收藏"}
          </button>
          {selected.localPath && (
            <button onClick={() => window.api.showInFolder(selected.localPath!)} className="btn btn-ghost btn-sm">📂 打开位置</button>
          )}
          {sourceUrl && (
            <a href={sourceUrl} className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer">🔗 来源</a>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 border-b border-base-300 px-6 py-3">
        {selected.tags.map((tag) => (
          <span key={tag} className="badge badge-sm badge-outline">#{tag}</span>
        ))}
        <span className={`badge badge-sm ${selected.source === "crawl" ? "badge-info" : "badge-success"}`}>
          {selected.source === "crawl" ? "自动搜集" : "用户上传"}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* AI Summary */}
        {selected.summary ? (
          <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-5 py-4">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-xs font-semibold text-primary">✨ AI 摘要</span>
            </div>
            <p className="text-sm leading-relaxed">{selected.summary}</p>
          </div>
        ) : (
          <div className="mb-4">
            <button onClick={handleGenerateSummary} disabled={summarizing} className="btn btn-outline btn-xs btn-primary gap-1">
              {summarizing ? (
                <><span className="loading loading-spinner loading-xs" /> 生成中...</>
              ) : (
                "✨ 生成 AI 摘要"
              )}
            </button>
          </div>
        )}

        {/* Source info */}
        {sourceUrl ? (
          <div className="mb-4 rounded-lg bg-base-200 px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs text-base-content/50">原始来源:</span>
            <a href={sourceUrl} className="text-xs text-primary hover:underline truncate flex-1" target="_blank" rel="noopener noreferrer">{sourceUrl}</a>
            <span className="badge badge-xs badge-outline">{selected.sourceName}</span>
          </div>
        ) : selected.searchQuery && (
          <div className="mb-4 rounded-lg bg-base-200 px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs text-base-content/50">暂无直接链接，可搜索:</span>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(selected.searchQuery)}`}
              className="text-xs text-primary hover:underline truncate flex-1"
              target="_blank"
              rel="noopener noreferrer"
            >
              🔍 {selected.searchQuery}
            </a>
          </div>
        )}

        {/* File download / PDF */}
        {selected.fileUrl && <DownloadSection materialId={selected.id} />}

        {/* Video */}
        {selected.type === "video" && (
          <div className="mt-4">
            <VideoEmbed url={selected.externalUrl} platform={selected.videoPlatform} duration={selected.duration} />
          </div>
        )}

        {/* Link */}
        {selected.type === "link" && (
          <div className="mt-4">
            <a href={selected.externalUrl} className="btn btn-primary btn-sm" target="_blank" rel="noopener noreferrer">🔗 在浏览器中打开</a>
          </div>
        )}

      </div>
    </div>
  )
}
