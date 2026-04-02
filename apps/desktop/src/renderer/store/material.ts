import { create } from "zustand"

export type MaterialType = "courseware" | "video" | "exam" | "notes" | "link"
export type MaterialSource = "crawl" | "upload"
export type DownloadStatus = "none" | "downloading" | "done" | "error"

export interface MaterialItem {
  id: string
  title: string
  type: MaterialType
  source: MaterialSource
  courseName: string
  university?: string
  sourceName: string
  tags: string[]
  knowledgePoints?: string[]
  createdAt: string
  // 远程地址（原始来源）
  fileUrl?: string
  filePages?: number
  // 本地路径（下载后填充）
  localPath?: string
  // 下载状态
  downloadStatus: DownloadStatus
  downloadError?: string
  // URL 有效性
  urlValid?: boolean | null // null = 未检测, true = 有效, false = 无效
  // 视频 / 链接
  externalUrl?: string
  videoPlatform?: "YouTube" | "Bilibili" | "Coursera" | "edX" | "中国大学MOOC" | "学堂在线"
  duration?: string
  // AI 摘要
  summary?: string
  // 归档
  archived: boolean
  // 收藏
  favorited?: boolean
  // AI 搜索建议的搜索关键词
  searchQuery?: string
}

interface MaterialState {
  materials: MaterialItem[]
  selectedId: string | null
  filter: "all" | MaterialType
  activeCourse: string | null
  storageDir: string
  initialized: boolean
  searchStatus: "idle" | "searching" | "downloading" | "done" | "error"
  searchProgress: string
  summaryGenerating: boolean
  summaryProgress: string

  setSelectedId: (id: string | null) => void
  setFilter: (filter: "all" | MaterialType) => void
  setActiveCourse: (course: string | null) => void
  initLocalFiles: () => Promise<void>
  downloadMaterial: (id: string) => Promise<void>
  downloadAllMaterials: () => Promise<void>
  searchAndCollect: (courseName: string) => Promise<void>
  generateSummary: (id: string) => Promise<void>
  generateAllSummaries: () => Promise<void>
  getMaterialsBySource: () => { sourceName: string; materials: MaterialItem[] }[]
  getMaterialsByKnowledgePoint: () => { point: string; materials: MaterialItem[] }[]
  removeMaterial: (id: string) => void
  toggleArchiveMaterial: (id: string) => void
  toggleFavoriteMaterial: (id: string) => void
  removeNoUrlMaterials: () => number
  validateCourseMaterials: (courseName: string) => Promise<void>
}

function inferSourceName(m: { fileUrl?: string; externalUrl?: string; university?: string; source: string }): string {
  if (m.source === "upload") return "本地上传"
  const url = m.fileUrl || m.externalUrl || ""
  if (url.includes("ocw.mit.edu")) return "MIT OCW"
  if (url.includes("stanford.edu")) return "Stanford"
  if (url.includes("inst.eecs.berkeley.edu")) return "UC Berkeley"
  if (url.includes("datastructur.es")) return "CS 61B"
  if (url.includes("xuetangx.com")) return "学堂在线"
  if (url.includes("visualgo.net")) return "VisuAlgo"
  if (url.includes("coursera.org")) return "Coursera"
  return m.university || "未知来源"
}

// Debounced persist helper
let _persistTimer: ReturnType<typeof setTimeout> | null = null
function schedulePersist(materials: MaterialItem[]) {
  if (_persistTimer) clearTimeout(_persistTimer)
  _persistTimer = setTimeout(() => {
    window.api.materialsSave(materials).catch((err) => {
      console.error("Failed to persist materials:", err)
    })
  }, 500)
}

export const useMaterialStore = create<MaterialState>((set, get) => ({
  materials: [],
  selectedId: null,
  filter: "all",
  activeCourse: null,
  storageDir: "",
  initialized: false,
  searchStatus: "idle" as const,
  searchProgress: "",
  summaryGenerating: false,
  summaryProgress: "",

  setSelectedId: (id) => set({ selectedId: id }),
  setFilter: (filter) => set({ filter }),
  setActiveCourse: (course) => set({ activeCourse: course }),

  initLocalFiles: async () => {
    if (get().initialized) return
    try {
      const loadResult = await window.api.materialsLoad() as { ok: boolean; data: unknown }
      let materials: MaterialItem[] = []

      if (loadResult.ok && Array.isArray(loadResult.data)) {
        materials = loadResult.data as MaterialItem[]
      }

      const localMap: Record<string, string> = await window.api.getLocalMap()
      const storageDir: string = await window.api.getStorageDir()

      set({
        materials: materials.map((m) => {
          if (localMap[m.id]) {
            return { ...m, localPath: localMap[m.id], downloadStatus: "done" as const }
          }
          return m
        }),
        storageDir,
        initialized: true,
      })
    } catch {
      set({ initialized: true })
    }
  },

  downloadMaterial: async (id) => {
    const material = get().materials.find((m) => m.id === id)
    if (!material?.fileUrl) return

    set((state) => ({
      materials: state.materials.map((m) =>
        m.id === id ? { ...m, downloadStatus: "downloading" as const } : m,
      ),
    }))

    try {
      const result = await window.api.downloadFile({
        id: material.id,
        url: material.fileUrl,
        courseName: material.courseName,
        title: material.title,
      })

      if (result.success) {
        const updated: MaterialItem[] = []
        set((state) => {
          const materials = state.materials.map((m) =>
            m.id === id
              ? { ...m, localPath: result.localPath, downloadStatus: "done" as const }
              : m,
          )
          updated.push(...materials)
          return { materials }
        })
        schedulePersist(updated)
      } else {
        const updated: MaterialItem[] = []
        set((state) => {
          const materials = state.materials.map((m) =>
            m.id === id
              ? { ...m, downloadStatus: "error" as const, downloadError: result.error }
              : m,
          )
          updated.push(...materials)
          return { materials }
        })
        schedulePersist(updated)
      }
    } catch (err) {
      const updated: MaterialItem[] = []
      set((state) => {
        const materials = state.materials.map((m) =>
          m.id === id
            ? { ...m, downloadStatus: "error" as const, downloadError: (err as Error).message }
            : m,
        )
        updated.push(...materials)
        return { materials }
      })
      schedulePersist(updated)
    }
  },

  downloadAllMaterials: async () => {
    const { materials, downloadMaterial } = get()
    const downloadable = materials.filter((m) => m.fileUrl && m.downloadStatus !== "done")
    for (const m of downloadable) {
      await downloadMaterial(m.id)
    }
  },

  searchAndCollect: async (courseName: string) => {
    const { useDevLogStore } = await import("./devlog")
    const log = useDevLogStore.getState().addEntry

    set({ searchStatus: "searching", searchProgress: `正在搜索「${courseName}」相关资料...` })
    log({ level: "info", category: "搜索", message: `开始搜索「${courseName}」` })

    const { useCurriculumStore } = await import("./curriculum")
    const { searchMode, getEnabledSources, aiSettings, getCourseByName } = useCurriculumStore.getState()
    const enabledSources = getEnabledSources()

    if (!aiSettings.apiKey) {
      log({ level: "warn", category: "搜索", message: "未配置 AI API Key，无法搜索" })
      set({ searchStatus: "error", searchProgress: "未配置 AI API Key。请在设置中填写。" })
      return
    }

    set({ searchProgress: `AI 正在为「${courseName}」搜索全球高校资料...` })
    log({ level: "info", category: "AI", message: `调用 searchMaterials，模式: ${searchMode}，信息源: ${enabledSources.length} 个` })

    const course = getCourseByName(courseName)
    const knowledgePoints = course?.knowledgePoints || []
    const aliases = course?.aliases || []

    try {
      const result = await window.api.searchMaterials({
        courseName,
        knowledgePoints,
        aliases,
        enabledSources: enabledSources.map((s) => ({ name: s.name, url: s.url })),
        searchMode,
        aiSettings,
      }) as {
        ok: boolean
        error?: string
        rawResponse?: string
        materials: Array<{
          title: string
          type: string
          fileUrl: string | null
          externalUrl: string | null
          university: string
          tags: string[]
          knowledgePoints: string[]
          videoPlatform: string | null
          duration: string | null
          searchQuery: string | null
        }>
      }

      // Log raw AI response
      if (result.rawResponse) {
        log({ level: "raw", category: "AI 原始回包", message: `共 ${result.materials?.length ?? 0} 条`, detail: result.rawResponse })
      }

      if (!result.ok) {
        log({ level: "error", category: "AI", message: result.error || "AI 返回错误" })
        set({ searchStatus: "error", searchProgress: `AI 搜索失败: ${result.error}` })
        return
      }

      log({ level: "success", category: "AI", message: `AI 返回 ${result.materials.length} 条资料` })

      // Log each item AI returned
      for (const m of result.materials) {
        const urlInfo = m.fileUrl || m.externalUrl || "(无链接)"
        log({
          level: m.fileUrl || m.externalUrl ? "info" : "warn",
          category: "AI 条目",
          message: `[${m.type}] ${m.title}`,
          detail: `fileUrl: ${m.fileUrl ?? "null"}\nexternalUrl: ${m.externalUrl ?? "null"}\nvideoPlatform: ${m.videoPlatform ?? "null"}\nsearchQuery: ${m.searchQuery ?? "null"}\nurl: ${urlInfo}`,
        })
      }

      // Build MaterialItems — fix: video with no externalUrl → type "link", clear platform
      const newMaterials: MaterialItem[] = result.materials.map((m, i) => {
        const hasUrl = !!(m.fileUrl || m.externalUrl)
        const rawType = (["courseware", "video", "exam", "notes", "link"].includes(m.type) ? m.type : "link") as MaterialItem["type"]
        const type: MaterialItem["type"] = (rawType === "video" && !m.externalUrl) ? "link" : rawType
        const videoPlatform = (type === "video" && m.externalUrl) ? m.videoPlatform as MaterialItem["videoPlatform"] : undefined

        if (rawType === "video" && !m.externalUrl) {
          log({ level: "warn", category: "修正", message: `「${m.title}」声称是视频但无链接，已改为 link 类型` })
        }

        return {
          id: `ai-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          title: m.title,
          type,
          source: "crawl" as const,
          courseName,
          university: m.university || "",
          sourceName: inferSourceName({
            fileUrl: m.fileUrl || undefined,
            externalUrl: m.externalUrl || undefined,
            university: m.university,
            source: "crawl",
          }),
          tags: m.tags || [],
          knowledgePoints: m.knowledgePoints || [],
          createdAt: new Date().toISOString().split("T")[0],
          fileUrl: m.fileUrl || undefined,
          externalUrl: m.externalUrl || undefined,
          videoPlatform,
          duration: (type === "video" && m.externalUrl) ? (m.duration || undefined) : undefined,
          downloadStatus: "none" as const,
          archived: false,
          searchQuery: m.searchQuery || undefined,
          urlValid: hasUrl ? undefined : null,
        }
      })

      // Deduplicate
      const existing = get().materials
      const existingKeys = new Set(existing.map((m) => `${m.title}::${m.courseName}`))
      const unique = newMaterials.filter((m) => !existingKeys.has(`${m.title}::${m.courseName}`))

      // Filter out AI results pointing to GitHub repos (GitHub scanner handles these with correct subfolder URLs)
      const githubSourceUrls = enabledSources.filter((s) => s.url.includes("github.com")).map((s) => s.url.replace(/\/$/, ""))
      const filtered = unique.filter((m) => {
        const url = m.fileUrl || m.externalUrl || ""
        if (url.includes("github.com") || url.includes("raw.githubusercontent.com")) {
          log({ level: "info", category: "过滤", message: `跳过 GitHub 条目（交由扫描器处理）: ${m.title}` })
          return false
        }
        return true
      })
      log({ level: "info", category: "去重", message: `${newMaterials.length} 条 AI 结果 → ${unique.length} 条去重后 → ${filtered.length} 条（排除 GitHub）` })

      // Validate URLs
      const toValidate = filtered
        .filter((m) => m.fileUrl || m.externalUrl)
        .map((m) => ({ id: m.id, url: (m.fileUrl || m.externalUrl)! }))

      let validated = filtered
      if (toValidate.length > 0) {
        set({ searchProgress: `验证 ${toValidate.length} 个链接的有效性...` })
        log({ level: "info", category: "验证", message: `开始验证 ${toValidate.length} 个 URL` })
        try {
          const validResults = await window.api.validateUrls(toValidate) as Array<{ id: string; ok: boolean }>
          const invalidIds = new Set(validResults.filter((r) => !r.ok).map((r) => r.id))

          for (const r of validResults) {
            const item = filtered.find((m) => m.id === r.id)
            log({
              level: r.ok ? "success" : "error",
              category: "验证",
              message: `${r.ok ? "✓" : "✗"} ${item?.title ?? r.id}`,
              detail: item?.fileUrl || item?.externalUrl,
            })
          }

          validated = filtered.filter((m) => !invalidIds.has(m.id))
          // Drop items with no URL entirely
          validated = validated.filter((m) => m.fileUrl || m.externalUrl)
          const toAdd = validated

          log({ level: "success", category: "验证", message: `${validated.length} 个链接有效，${invalidIds.size} 个无效已过滤` })

          if (toAdd.length > 0) {
            set((state) => ({ materials: [...state.materials, ...toAdd] }))
          }
          set({ searchProgress: `找到 ${toAdd.length} 项资料（${invalidIds.size} 个坏链已过滤）` })
          validated = toAdd
        } catch (err) {
          log({ level: "warn", category: "验证", message: `URL 验证失败，跳过: ${(err as Error).message}` })
          set((state) => ({ materials: [...state.materials, ...filtered] }))
        }
      } else {
        // No URLs at all — drop everything
        log({ level: "info", category: "验证", message: "所有条目无 URL，全部丢弃" })
      }

      // Scan GitHub repos for matching PDFs
      const githubSources = enabledSources.filter((s) => s.url.includes("github.com"))
      if (githubSources.length > 0) {
        log({ level: "info", category: "GitHub", message: `开始扫描 ${githubSources.length} 个 GitHub 仓库...` })
        set({ searchProgress: `正在扫描 GitHub 仓库...` })

        for (const source of githubSources) {
          log({ level: "info", category: "GitHub", message: `扫描 ${source.name}` })
          try {
            const scanResult = await window.api.scanGithubRepo({
              repoUrl: source.url,
              courseName,
              knowledgePoints,
              aliases,
            }) as { ok: boolean; error?: string; files: Array<{ path: string; filename: string; rawUrl: string; size: number }>; truncated?: boolean; scanned?: number }

            if (!scanResult.ok) {
              log({ level: "warn", category: "GitHub", message: `${source.name} 扫描失败: ${scanResult.error}` })
              continue
            }

            log({
              level: "success",
              category: "GitHub",
              message: `${source.name}：扫描 ${scanResult.scanned ?? "?"} 个文件，找到 ${scanResult.files.length} 个匹配 PDF${scanResult.truncated ? "（结果已截断）" : ""}`,
              detail: scanResult.files.map((f) => f.path).join("\n"),
            })

            if (scanResult.files.length === 0) continue

            // Build MaterialItems for found PDFs
            const currentKeys = new Set(get().materials.map((m) => `${m.title}::${m.courseName}`))
            const githubMaterials: MaterialItem[] = scanResult.files
              .filter((f) => {
                const title = f.filename.replace(/\.pdf$/i, "")
                return !currentKeys.has(`${title}::${courseName}`)
              })
              .map((f, i) => {
                const repoBase = source.url.replace(/\/$/, "")
                const parentDir = f.path.includes("/") ? f.path.split("/").slice(0, -1).join("/") : ""
                const folderUrl = parentDir ? `${repoBase}/tree/HEAD/${parentDir.split("/").map(encodeURIComponent).join("/")}` : `${repoBase}/tree/HEAD`
                return {
                  id: `gh-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
                  title: f.filename.replace(/\.pdf$/i, ""),
                  type: "courseware" as const,
                  source: "crawl" as const,
                  courseName,
                  university: source.name,
                  sourceName: source.name,
                  tags: [source.name],
                  knowledgePoints,
                  createdAt: new Date().toISOString().split("T")[0],
                  fileUrl: f.rawUrl,
                  externalUrl: folderUrl,
                  downloadStatus: "none" as const,
                  archived: false,
                  searchQuery: `${courseName} ${f.filename.replace(/\.pdf$/i, "")}`,
                }
              })

            if (githubMaterials.length > 0) {
              set((state) => ({ materials: [...state.materials, ...githubMaterials] }))
              log({ level: "success", category: "GitHub", message: `从 ${source.name} 新增 ${githubMaterials.length} 条资料` })

              // Download them
              set({ searchStatus: "downloading", searchProgress: `下载 ${source.name} 的 ${githubMaterials.length} 个 PDF...` })
              for (const m of githubMaterials) {
                set({ searchProgress: `GitHub 下载: ${m.title}` })
                await get().downloadMaterial(m.id)
                const updated = get().materials.find((mat) => mat.id === m.id)
                log({
                  level: updated?.downloadStatus === "done" ? "success" : "error",
                  category: "GitHub 下载",
                  message: `${updated?.downloadStatus === "done" ? "✓" : "✗"} ${m.title}`,
                  detail: updated?.downloadError,
                })
              }
            }
          } catch (err) {
            log({ level: "error", category: "GitHub", message: `${source.name} 异常: ${(err as Error).message}` })
          }
        }
      }

      // Download PDFs
      const allMatched = [...existing.filter((m) => m.courseName === courseName), ...validated]
      const downloadable = allMatched.filter((m) => m.fileUrl && m.downloadStatus !== "done")
      set({ searchStatus: "downloading", searchProgress: `找到 ${validated.length} 项新资料，开始下载...`, activeCourse: courseName })
      log({ level: "info", category: "下载", message: `开始下载 ${downloadable.length} 个 PDF` })

      let doneCount = 0
      let errorCount = 0
      for (const m of downloadable) {
        set({ searchProgress: `正在下载 (${doneCount + 1}/${downloadable.length}): ${m.title}` })
        await get().downloadMaterial(m.id)
        const updated = get().materials.find((mat) => mat.id === m.id)
        if (updated?.downloadStatus === "done") {
          doneCount++
          log({ level: "success", category: "下载", message: `✓ ${m.title}` })
        } else {
          errorCount++
          log({ level: "error", category: "下载", message: `✗ ${m.title}`, detail: updated?.downloadError })
        }
      }

      const summary = `完成！${validated.length} 项新资料，下载 ${doneCount} 个${errorCount > 0 ? `，${errorCount} 个失败` : ""}`
      set({ searchStatus: "done", searchProgress: summary })
      log({ level: "success", category: "搜索", message: summary })
      schedulePersist(get().materials)

      // Auto-generate summaries
      const needSummary = allMatched.filter((m) => !m.summary)
      for (const m of needSummary) {
        await get().generateSummary(m.id)
      }

      setTimeout(() => {
        if (get().searchStatus === "done") set({ searchStatus: "idle", searchProgress: "" })
      }, 3000)
      return
    } catch (err) {
      const msg = (err as Error).message
      log({ level: "error", category: "搜索", message: `搜索异常: ${msg}` })
      set({ searchStatus: "error", searchProgress: `搜索失败: ${msg}` })
    }
  },

  generateSummary: async (id: string) => {
    const material = get().materials.find((m) => m.id === id)
    if (!material) return
    try {
      const { useCurriculumStore } = await import("./curriculum")
      const aiSettings = useCurriculumStore.getState().aiSettings
      const result = await window.api.generateSummary({
        material: {
          title: material.title,
          courseName: material.courseName,
          tags: material.tags,
          knowledgePoints: material.knowledgePoints || [],
          university: material.university || "",
          sourceName: material.sourceName,
          type: material.type,
          filePages: material.filePages,
          localPath: material.localPath,
        },
        aiSettings,
      }) as { ok: boolean; summary?: string; error?: string }
      if (result.ok && result.summary) {
        const updated: MaterialItem[] = []
        set((state) => {
          const materials = state.materials.map((m) =>
            m.id === id ? { ...m, summary: result.summary } : m,
          )
          updated.push(...materials)
          return { materials }
        })
        schedulePersist(updated)
      }
    } catch (err) {
      console.error("generateSummary failed:", err)
    }
  },

  generateAllSummaries: async () => {
    const { materials } = get()
    const todo = materials.filter((m) => !m.summary)
    if (todo.length === 0) return

    set({ summaryGenerating: true, summaryProgress: "" })
    let done = 0
    for (const m of todo) {
      set({ summaryProgress: `(${done + 1}/${todo.length}) 生成「${m.title}」摘要...` })
      await get().generateSummary(m.id)
      done++
    }
    set({ summaryGenerating: false, summaryProgress: "" })
  },

  getMaterialsBySource: () => {
    const { materials, activeCourse } = get()
    const list = activeCourse ? materials.filter((m) => m.courseName === activeCourse) : materials
    const map = new Map<string, MaterialItem[]>()
    for (const m of list) {
      const key = m.sourceName
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    }
    return Array.from(map.entries()).map(([sourceName, materials]) => ({ sourceName, materials }))
  },

  getMaterialsByKnowledgePoint: () => {
    const { materials, activeCourse } = get()
    const list = activeCourse? materials.filter((m) => m.courseName === activeCourse) : materials
    const map = new Map<string, MaterialItem[]>()
    for (const m of list) {
      const points = m.knowledgePoints && m.knowledgePoints.length > 0 ? m.knowledgePoints : ["未分类"]
      for (const p of points) {
        if (!map.has(p)) map.set(p, [])
        if (!map.get(p)!.some((existing) => existing.id === m.id)) {
          map.get(p)!.push(m)
        }
      }
    }
    return Array.from(map.entries()).map(([point, materials]) => ({ point, materials }))
  },

  removeMaterial: (id: string) => {
    const updated: MaterialItem[] = []
    set((state) => {
      const materials = state.materials.filter((m) => m.id !== id)
      updated.push(...materials)
      return {
        materials,
        selectedId: state.selectedId === id ? null : state.selectedId,
      }
    })
    schedulePersist(updated)
  },

  toggleArchiveMaterial: (id: string) => {
    const updated: MaterialItem[] = []
    set((state) => {
      const materials = state.materials.map((m) =>
        m.id === id ? { ...m, archived: !m.archived } : m,
      )
      updated.push(...materials)
      return {
        materials,
        selectedId: state.selectedId === id ? null : state.selectedId,
      }
    })
    schedulePersist(updated)
  },

  toggleFavoriteMaterial: (id: string) => {
    const updated: MaterialItem[] = []
    set((state) => {
      const materials = state.materials.map((m) =>
        m.id === id ? { ...m, favorited: !m.favorited } : m,
      )
      updated.push(...materials)
      return { materials }
    })
    schedulePersist(updated)
  },

  removeNoUrlMaterials: () => {
    let removed = 0
    set((state) => {
      const materials = state.materials.filter((m) => {
        const isEmpty = m.source === "crawl" && !m.fileUrl && !m.externalUrl && !m.localPath
        if (isEmpty) removed++
        return !isEmpty
      })
      schedulePersist(materials)
      return { materials }
    })
    return removed
  },

  validateCourseMaterials: async (courseName: string) => {
    const materials = get().materials.filter(
      (m) => m.courseName === courseName && (m.fileUrl || m.externalUrl) && m.downloadStatus !== "done",
    )
    if (materials.length === 0) return

    set({ searchStatus: "searching", searchProgress: `正在检测「${courseName}」的 ${materials.length} 个链接...` })

    const toValidate = materials.map((m) => ({
      id: m.id,
      url: (m.fileUrl || m.externalUrl)!,
    }))

    try {
      const results = await window.api.validateUrls(toValidate) as Array<{ id: string; ok: boolean; status: number }>

      const validCount = results.filter((r) => r.ok).length
      const invalidIds = new Set(results.filter((r) => !r.ok).map((r) => r.id))

      set((state) => {
        const materials = state.materials.map((m) => {
          const result = results.find((r) => r.id === m.id)
          if (result) {
            return { ...m, urlValid: result.ok }
          }
          return m
        })
        return { materials }
      })
      schedulePersist(get().materials)

      // Auto-remove invalid materials
      if (invalidIds.size > 0) {
        set((state) => ({
          materials: state.materials.filter((m) => !invalidIds.has(m.id)),
        }))
        schedulePersist(get().materials)
      }

      set({
        searchStatus: "done",
        searchProgress: `检测完成：${validCount} 个有效，${invalidIds.size} 个无效已移除`,
      })
    } catch (err) {
      set({
        searchStatus: "error",
        searchProgress: `检测失败: ${(err as Error).message}`,
      })
    }

    setTimeout(() => {
      if (get().searchStatus === "done" || get().searchStatus === "error") {
        set({ searchStatus: "idle", searchProgress: "" })
      }
    }, 3000)
  },
}))
