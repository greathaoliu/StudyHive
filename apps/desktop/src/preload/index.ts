import { contextBridge, ipcRenderer } from "electron"

const api = {
  // 文件下载与管理
  downloadFile: (payload: {
    id: string
    url: string
    courseName: string
    title: string
  }) => ipcRenderer.invoke("file:download", payload),

  downloadBatch: (items: Array<{
    id: string
    url: string
    courseName: string
    title: string
  }>) => ipcRenderer.invoke("file:downloadBatch", items),

  getLocalMap: (): Promise<Record<string, string>> => ipcRenderer.invoke("file:getLocalMap"),

  getStorageDir: (): Promise<string> => ipcRenderer.invoke("file:getStorageDir"),

  getFileStats: (): Promise<{ fileCount: number; totalSize: number; storageRoot: string }> =>
    ipcRenderer.invoke("file:getStats"),

  showInFolder: (filePath: string) => ipcRenderer.invoke("file:showInFolder", filePath),

  // 文件选择
  selectFiles: () => ipcRenderer.invoke("dialog:selectFiles"),

  // 培养方案
  selectCurriculumPDF: (): Promise<string | null> => ipcRenderer.invoke("dialog:selectCurriculumPDF"),

  normalizeCourses: (payload: {
    courses: Array<{ id: string; name: string; category: string; semester?: string; credits?: number; knowledgePoints: string[]; archived: boolean }>
    aiSettings: { provider: string; baseUrl: string; apiKey: string; model: string }
  }) => ipcRenderer.invoke("curriculum:normalizeCourses", payload),

  parseCurriculumPDF: (payload: {
    filePath: string
    aiSettings: { provider: string; baseUrl: string; apiKey: string; model: string }
  }) => ipcRenderer.invoke("curriculum:parsePDF", payload),

  testAIConnection: (aiSettings: {
    provider: string; baseUrl: string; apiKey: string; model: string
  }) => ipcRenderer.invoke("ai:testConnection", aiSettings),

  generateSummary: (payload: {
    material: {
      title: string; courseName: string; tags: string[]; knowledgePoints: string[];
      university: string; sourceName: string; type: string; filePages?: number; localPath?: string
    }
    aiSettings: { provider: string; baseUrl: string; apiKey: string; model: string }
  }) => ipcRenderer.invoke("ai:generateSummary", payload),

  searchMaterials: (payload: {
    courseName: string
    knowledgePoints: string[]
    aliases: string[]
    enabledSources: Array<{ name: string; url: string }>
    searchMode: string
    aiSettings: { provider: string; baseUrl: string; apiKey: string; model: string }
  }) => ipcRenderer.invoke("ai:searchMaterials", payload),

  // AI 流式对话
  startChat: (payload: {
    messages: Array<{ role: string; content: string }>
    aiSettings: { provider: string; baseUrl: string; apiKey: string; model: string }
    searchMode: string
    enabledSources: Array<{ name: string; url: string }>
    courses: Array<{ name: string; knowledgePoints: string[] }>
  }) => ipcRenderer.invoke("ai:chatStream", payload),

  onChatChunk: (callback: (chunk: { id: string; content: string; done: boolean }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, chunk: { id: string; content: string; done: boolean }) => callback(chunk)
    ipcRenderer.on("ai:chatChunk", listener)
    return () => ipcRenderer.removeListener("ai:chatChunk", listener)
  },

  // 爬虫进度
  onCrawlProgress: (callback: (progress: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: number) => callback(progress)
    ipcRenderer.on("crawl:progress", listener)
    return () => ipcRenderer.removeListener("crawl:progress", listener)
  },

  // 资料持久化
  materialsSave: (data: unknown) => ipcRenderer.invoke("materials:save", data),
  materialsLoad: () => ipcRenderer.invoke("materials:load"),

  // GitHub 仓库扫描
  scanGithubRepo: (payload: {
    repoUrl: string
    courseName: string
    knowledgePoints: string[]
    aliases?: string[]
  }) => ipcRenderer.invoke("github:scanRepo", payload),

  // URL 验证
  validateUrl: (url: string) => ipcRenderer.invoke("url:validate", url),
  validateUrls: (urls: Array<{ id: string; url: string }>) => ipcRenderer.invoke("url:validateBatch", urls),

  // 培养方案持久化
  programsSave: (data: unknown) => ipcRenderer.invoke("programs:save", data),
  programsLoad: () => ipcRenderer.invoke("programs:load"),
}

export type ElectronAPI = typeof api

contextBridge.exposeInMainWorld("api", api)
