export interface Major {
  id: string
  name: string
  nameEn: string
  university?: string
}

export interface Course {
  id: string
  majorId: string
  name: string
  nameEn: string
  code?: string
  description?: string
}

export type MaterialType = "courseware" | "video" | "exam" | "notes" | "link"
export type MaterialSource = "crawl" | "upload"
export type CrawlTaskStatus = "pending" | "running" | "done" | "failed"

export interface Material {
  id: string
  courseId: string
  title: string
  description?: string
  type: MaterialType
  source: MaterialSource
  sourceUrl?: string
  filePath?: string
  fileSize?: number
  tags: string[]
  aiSummary?: string
  viewCount: number
  downloadCount: number
  createdAt: string
  updatedAt: string
}

export interface Collection {
  id: string
  userId: string
  materialId: string
  folder?: string
  createdAt: string
}

export interface CrawlTask {
  id: string
  userId: string
  query: string
  status: CrawlTaskStatus
  progress: number
  resultCount: number
  createdAt: string
  completedAt?: string
}

export interface AIConfig {
  id: string
  userId: string
  provider: "openai" | "claude" | "custom"
  baseUrl: string
  apiKey: string
  model: string
  createdAt: string
}
