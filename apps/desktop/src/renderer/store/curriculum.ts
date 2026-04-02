import { create } from "zustand"
import { useMaterialStore } from "./material"

// ==================== Types ====================

export interface ExtractedCourse {
  id: string
  name: string
  category: string // "专业核心课" | "公共基础课" | "专业选修课" | "通识课" | "实践课"
  semester?: string
  credits?: number
  knowledgePoints: string[]
  archived: boolean
  aliases?: string[] // 用户自定义别名/搜索关键词（如"微积分""Calculus"）
}

export interface TrainingProgram {
  id: string
  name: string
  school: string
  filePath?: string
  courses: ExtractedCourse[]
  uploadedAt: string
}

export interface AISettings {
  provider: string
  baseUrl: string
  apiKey: string
  model: string
}

// ==================== Mock Data ====================

const mockTrainingProgram: TrainingProgram = {
  id: "pku-cs-2024",
  name: "计算机科学与技术 2024 培养方案",
  school: "北京大学",
  uploadedAt: "2026-03-30",
  courses: [
    { id: "c1", name: "数据结构", category: "专业核心课", semester: "大二上", credits: 4, knowledgePoints: ["二叉树", "图论", "排序算法", "哈希表", "红黑树", "B+树"], archived: false },
    { id: "c2", name: "操作系统", category: "专业核心课", semester: "大二下", credits: 4, knowledgePoints: ["进程管理", "内存管理", "文件系统", "死锁", "调度算法"], archived: false },
    { id: "c3", name: "计算机网络", category: "专业核心课", semester: "大三上", credits: 3, knowledgePoints: ["TCP/IP", "HTTP", "路由算法", "DNS", "Socket编程"], archived: false },
    { id: "c4", name: "算法设计与分析", category: "专业核心课", semester: "大二下", credits: 3, knowledgePoints: ["动态规划", "贪心算法", "分治法", "图算法", "NP完全"], archived: false },
    { id: "c5", name: "编译原理", category: "专业核心课", semester: "大三上", credits: 3, knowledgePoints: ["词法分析", "语法分析", "语义分析", "代码生成", "LL/LR分析"], archived: false },
    { id: "c6", name: "数据库系统", category: "专业核心课", semester: "大三上", credits: 3, knowledgePoints: ["SQL", "关系代数", "事务", "索引", "范式"], archived: false },
    { id: "c7", name: "计算机组成原理", category: "专业核心课", semester: "大二上", credits: 4, knowledgePoints: ["指令集", "流水线", "Cache", "中断", "总线"], archived: false },
    { id: "c8", name: "高等数学", category: "公共基础课", semester: "大一上/下", credits: 6, knowledgePoints: ["微积分", "定积分", "级数", "多元函数", "微分方程"], archived: false },
    { id: "c9", name: "线性代数", category: "公共基础课", semester: "大一上", credits: 3, knowledgePoints: ["矩阵运算", "行列式", "特征值", "向量空间", "SVD"], archived: false },
    { id: "c10", name: "概率论与数理统计", category: "公共基础课", semester: "大一下", credits: 3, knowledgePoints: ["概率分布", "期望方差", "假设检验", "贝叶斯", "回归分析"], archived: false },
    { id: "c11", name: "离散数学", category: "公共基础课", semester: "大一上", credits: 3, knowledgePoints: ["集合论", "图论", "逻辑推理", "代数结构", "组合数学"], archived: false },
    { id: "c12", name: "人工智能", category: "专业选修课", semester: "大三下", credits: 3, knowledgePoints: ["搜索算法", "机器学习", "神经网络", "NLP", "计算机视觉"], archived: false },
    { id: "c13", name: "软件工程", category: "专业选修课", semester: "大三下", credits: 3, knowledgePoints: ["需求分析", "设计模式", "敏捷开发", "测试", "CI/CD"], archived: false },
    { id: "c14", name: "大学英语", category: "通识课", semester: "大一~大二", credits: 8, knowledgePoints: ["阅读", "写作", "听力", "口语"], archived: false },
  ],
}

// ==================== Store ====================

const AI_SETTINGS_KEY = "studyhive-ai-settings"
const SOURCES_KEY = "studyhive-info-sources"
const SEARCH_MODE_KEY = "studyhive-search-mode"
const ACTIVE_PROGRAM_KEY = "studyhive-active-program"

export interface InfoSource {
  id: string
  name: string
  url: string
  enabled: boolean
}

const DEFAULT_SOURCES: InfoSource[] = [
  // === 图片中的课程攻略 GitHub 仓库 ===
  { id: "s1", name: "浙江大学课程攻略共享计划", url: "https://github.com/QSCTech/zju-icicles", enabled: true },
  { id: "s2", name: "北京大学课程资料", url: "https://github.com/lib-pku/libpku", enabled: true },
  { id: "s3", name: "清华大学计算机系课程攻略", url: "https://github.com/PKUanonym/REKCARC-TSC-UHT", enabled: true },
  { id: "s4", name: "上海交通大学课程资料", url: "https://github.com/c-hj/SJTU-Courses", enabled: true },
  { id: "s5", name: "中国科学技术大学课程资源", url: "https://github.com/USTC-Resource/USTC-Course", enabled: true },
  { id: "s6", name: "复旦大学课程资料", url: "https://github.com/openFudan/fudan-coursera", enabled: true },
  { id: "s7", name: "南京大学课程复习资料", url: "https://github.com/idealclover/NJU-Review-Materials", enabled: true },
  { id: "s8", name: "清华大学往年题（仅校内）", url: "https://in.closed.social:9443/pastExam", enabled: true },
  { id: "s9", name: "计算机自学指南 (csdiy.wiki)", url: "https://csdiy.wiki", enabled: true },
  { id: "s10", name: "清华酱网学号导航", url: "https://hackway.org", enabled: true },
  // === 其他优质信息源 ===
  { id: "s11", name: "中国大学MOOC", url: "https://www.icourse163.org", enabled: true },
  { id: "s12", name: "MIT OpenCourseWare", url: "https://ocw.mit.edu", enabled: true },
  { id: "s13", name: "Coursera", url: "https://www.coursera.org", enabled: true },
  { id: "s14", name: "清华大学学堂在线", url: "https://www.xuetangx.com", enabled: true },
  { id: "s15", name: "Bilibili 学习区", url: "https://www.bilibili.com", enabled: true },
]

function loadSources(): InfoSource[] {
  try {
    const raw = localStorage.getItem(SOURCES_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as InfoSource[]
      // Merge: ensure all DEFAULT_SOURCES are present (by URL)
      const savedUrls = new Set(saved.map((s) => s.url))
      const missing = DEFAULT_SOURCES.filter((d) => !savedUrls.has(d.url))
      if (missing.length > 0) {
        const merged = [...saved, ...missing]
        saveSources(merged)
        return merged
      }
      return saved
    }
  } catch { /* ignore */ }
  return DEFAULT_SOURCES
}

function saveSources(sources: InfoSource[]): void {
  localStorage.setItem(SOURCES_KEY, JSON.stringify(sources))
}

function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { provider: "claude", baseUrl: "https://open.bigmodel.cn/api/anthropic", apiKey: "", model: "glm-5.1" }
}

function saveAISettings(settings: AISettings): void {
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings))
}

function loadSearchMode(): "focused" | "divergent" {
  try {
    const raw = localStorage.getItem(SEARCH_MODE_KEY)
    if (raw === "focused" || raw === "divergent") return raw
  } catch { /* ignore */ }
  return "focused"
}

function saveSearchMode(mode: "focused" | "divergent"): void {
  localStorage.setItem(SEARCH_MODE_KEY, mode)
}

function loadActiveProgramId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROGRAM_KEY)
  } catch { return null }
}

function saveActiveProgramId(id: string): void {
  localStorage.setItem(ACTIVE_PROGRAM_KEY, id)
}

const CATEGORY_ORDER = ["专业核心课", "公共基础课", "专业选修课", "通识课", "实践课"]

// Debounced persist for programs
let _programsPersistTimer: ReturnType<typeof setTimeout> | null = null
function scheduleProgramsPersist(programs: TrainingProgram[]) {
  if (_programsPersistTimer) clearTimeout(_programsPersistTimer)
  _programsPersistTimer = setTimeout(() => {
    window.api.programsSave(programs).catch((err) => {
      console.error("Failed to persist programs:", err)
    })
  }, 500)
}
const CATEGORY_ICONS: Record<string, string> = {
  "专业核心课": "📘",
  "公共基础课": "📗",
  "专业选修课": "📙",
  "通识课": "📕",
  "实践课": "📓",
}

interface CurriculumState {
  programs: TrainingProgram[]
  activeProgramId: string | null
  programsLoaded: boolean
  aiSettings: AISettings
  infoSources: InfoSource[]
  searchMode: "focused" | "divergent"
  parsing: boolean
  parseError: string | null
  parseResult: "idle" | "success" | "mock" | "error"
  collecting: boolean
  collectProgress: string

  // Derived
  getActiveProgram: () => TrainingProgram | undefined
  getAllCourses: () => ExtractedCourse[]
  getActiveCourses: () => ExtractedCourse[]
  getArchivedCourses: () => ExtractedCourse[]
  getCourseByName: (name: string) => ExtractedCourse | undefined
  getCourseTree: () => { category: string; icon: string; courses: ExtractedCourse[] }[]
  getSchoolName: () => string
  getEnabledSources: () => InfoSource[]

  // Actions
  initPrograms: () => Promise<void>
  setActiveProgramId: (id: string) => void
  removeProgram: (id: string) => void
  addCourse: (course: Omit<ExtractedCourse, "id" | "archived">) => void
  removeCourse: (courseId: string) => void
  toggleArchive: (courseId: string) => void
  updateCourseAliases: (courseId: string, aliases: string[]) => void
  collectAllCourses: () => Promise<void>
  uploadAndParse: (filePath: string) => Promise<void>
  normalizeCourses: (programId?: string) => Promise<void>
  updateAISettings: (settings: AISettings) => void
  testAIConnection: () => Promise<{ ok: boolean; status?: number; error?: string; body?: string }>
  addInfoSource: (source: Omit<InfoSource, "id">) => void
  removeInfoSource: (id: string) => void
  toggleInfoSource: (id: string) => void
  updateInfoSource: (id: string, updates: Partial<Omit<InfoSource, "id">>) => void
  setSearchMode: (mode: "focused" | "divergent") => void
}

export const useCurriculumStore = create<CurriculumState>((set, get) => ({
  programs: [mockTrainingProgram],
  activeProgramId: loadActiveProgramId() || mockTrainingProgram.id,
  programsLoaded: false,
  aiSettings: loadAISettings(),
  infoSources: loadSources(),
  searchMode: loadSearchMode(),
  parsing: false,
  parseError: null,
  parseResult: "idle" as const,
  collecting: false,
  collectProgress: "",

  initPrograms: async () => {
    if (get().programsLoaded) return
    try {
      const result = await window.api.programsLoad() as { ok: boolean; data: unknown }
      if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
        const persisted = result.data as TrainingProgram[]
        const savedActiveId = loadActiveProgramId()
        const activeId = savedActiveId && persisted.find((p) => p.id === savedActiveId)
          ? savedActiveId
          : persisted[0].id
        set({ programs: persisted, activeProgramId: activeId, programsLoaded: true })
      } else {
        set({ programsLoaded: true })
      }
    } catch {
      set({ programsLoaded: true })
    }
  },

  getActiveProgram: () => {
    const { programs, activeProgramId } = get()
    return programs.find((p) => p.id === activeProgramId) || programs[0]
  },

  getAllCourses: () => {
    const program = get().getActiveProgram()
    return program ? program.courses : []
  },

  getActiveCourses: () => {
    return get().getAllCourses().filter((c) => !c.archived)
  },

  getArchivedCourses: () => {
    return get().getAllCourses().filter((c) => c.archived)
  },

  getCourseByName: (name: string) => {
    return get().getAllCourses().find((c) => c.name === name)
  },

  getCourseTree: () => {
    const activeCourses = get().getActiveCourses()
    const categoryMap = new Map<string, ExtractedCourse[]>()
    for (const c of activeCourses) {
      if (!categoryMap.has(c.category)) categoryMap.set(c.category, [])
      categoryMap.get(c.category)!.push(c)
    }
    const result: { category: string; icon: string; courses: ExtractedCourse[] }[] = []
    for (const cat of CATEGORY_ORDER) {
      const courses = categoryMap.get(cat)
      if (courses && courses.length > 0) {
        result.push({ category: cat, icon: CATEGORY_ICONS[cat] || "📘", courses })
      }
    }
    for (const [cat, courses] of categoryMap) {
      if (!CATEGORY_ORDER.includes(cat)) {
        result.push({ category: cat, icon: "📘", courses })
      }
    }
    return result
  },

  getSchoolName: () => {
    const program = get().getActiveProgram()
    return program ? program.school : ""
  },

  setActiveProgramId: (id) => {
    saveActiveProgramId(id)
    set({ activeProgramId: id })
  },

  removeProgram: (id) => {
    set((state) => {
      const programs = state.programs.filter((p) => p.id !== id)
      const activeProgramId = state.activeProgramId === id
        ? (programs[0]?.id || null)
        : state.activeProgramId
      if (activeProgramId) saveActiveProgramId(activeProgramId)
      scheduleProgramsPersist(programs)
      return { programs, activeProgramId }
    })
  },

  addCourse: (course) => {
    const newCourse: ExtractedCourse = {
      ...course,
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      archived: false,
    }
    set((state) => {
      const activeId = state.activeProgramId
      const programs = state.programs.map((p) =>
        p.id === activeId
          ? { ...p, courses: [...p.courses, newCourse] }
          : p
      )
      scheduleProgramsPersist(programs)
      return { programs }
    })
  },

  removeCourse: (courseId) => {
    set((state) => {
      const activeId = state.activeProgramId
      const programs = state.programs.map((p) =>
        p.id === activeId
          ? { ...p, courses: p.courses.filter((c) => c.id !== courseId) }
          : p
      )
      scheduleProgramsPersist(programs)
      return { programs }
    })
  },

  toggleArchive: (courseId) => {
    set((state) => {
      const activeId = state.activeProgramId
      const programs = state.programs.map((p) =>
        p.id === activeId
          ? { ...p, courses: p.courses.map((c) =>
              c.id === courseId ? { ...c, archived: !c.archived } : c,
            )}
          : p
      )
      scheduleProgramsPersist(programs)
      return { programs }
    })
  },

  updateCourseAliases: (courseId, aliases) => {
    set((state) => {
      const activeId = state.activeProgramId
      const programs = state.programs.map((p) =>
        p.id === activeId
          ? { ...p, courses: p.courses.map((c) =>
              c.id === courseId ? { ...c, aliases } : c,
            )}
          : p
      )
      scheduleProgramsPersist(programs)
      return { programs }
    })
  },

  collectAllCourses: async () => {
    const courses = get().getActiveCourses()
    if (courses.length === 0) return

    set({ collecting: true, collectProgress: "" })
    const searchAndCollect = useMaterialStore.getState().searchAndCollect

    for (let i = 0; i < courses.length; i++) {
      const course = courses[i]
      set({ collectProgress: `(${i + 1}/${courses.length}) 搜集「${course.name}」资料...` })
      await searchAndCollect(course.name)
    }

    set({ collecting: false, collectProgress: "" })
  },

  uploadAndParse: async (filePath: string) => {
    set({ parsing: true, parseError: null, parseResult: "idle" })
    try {
      const result = await window.api.parseCurriculumPDF({
        filePath,
        aiSettings: get().aiSettings,
      })

      const isMock = !!(result as { _mock?: boolean })._mock

      const program: TrainingProgram = {
        id: `program-${Date.now()}`,
        name: result.name,
        school: result.school,
        filePath,
        courses: result.courses.map((c: { id?: string; name: string; category: string; semester?: string; credits?: number; knowledgePoints: string[] }) => ({ ...c, archived: false })),
        uploadedAt: new Date().toISOString().split("T")[0],
      }

      set((state) => {
        const programs = [...state.programs, program]
        scheduleProgramsPersist(programs)
        return {
          programs,
          activeProgramId: program.id,
          parsing: false,
          parseResult: isMock ? "mock" : "success",
        }
      })
      saveActiveProgramId(program.id)

      // Auto-normalize course names if AI is configured
      if (!isMock && get().aiSettings.apiKey) {
        await get().normalizeCourses(program.id)
      }

      setTimeout(() => {
        if (get().parseResult === "mock" || get().parseResult === "success") {
          set({ parseResult: "idle" })
        }
      }, 5000)
    } catch (err) {
      set({ parsing: false, parseError: (err as Error).message, parseResult: "error" })
    }
  },

  normalizeCourses: async (programId?: string) => {
    const { programs, activeProgramId, aiSettings } = get()
    const targetId = programId || activeProgramId
    const program = programs.find((p) => p.id === targetId)
    if (!program || !aiSettings.apiKey) return

    set({ parsing: true })
    try {
      const result = await window.api.normalizeCourses({
        courses: program.courses,
        aiSettings,
      }) as { ok: boolean; courses: typeof program.courses; error?: string }

      if (result.ok && result.courses.length > 0) {
        set((state) => {
          const updated = state.programs.map((p) =>
            p.id === targetId ? { ...p, courses: result.courses } : p,
          )
          scheduleProgramsPersist(updated)
          return { programs: updated, parsing: false }
        })
      } else {
        set({ parsing: false })
      }
    } catch {
      set({ parsing: false })
    }
  },

  getEnabledSources: () => {
    return get().infoSources.filter((s) => s.enabled)
  },

  addInfoSource: (source) => {
    const newSource: InfoSource = {
      ...source,
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }
    set((state) => {
      const sources = [...state.infoSources, newSource]
      saveSources(sources)
      return { infoSources: sources }
    })
  },

  removeInfoSource: (id) => {
    set((state) => {
      const sources = state.infoSources.filter((s) => s.id !== id)
      saveSources(sources)
      return { infoSources: sources }
    })
  },

  toggleInfoSource: (id) => {
    set((state) => {
      const sources = state.infoSources.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s,
      )
      saveSources(sources)
      return { infoSources: sources }
    })
  },

  updateInfoSource: (id, updates) => {
    set((state) => {
      const sources = state.infoSources.map((s) =>
        s.id === id ? { ...s, ...updates } : s,
      )
      saveSources(sources)
      return { infoSources: sources }
    })
  },

  updateAISettings: (settings: AISettings) => {
    saveAISettings(settings)
    set({ aiSettings: settings })
  },

  setSearchMode: (mode) => {
    saveSearchMode(mode)
    set({ searchMode: mode })
  },

  testAIConnection: async () => {
    const { aiSettings } = get()
    if (!aiSettings.baseUrl || !aiSettings.apiKey) return { ok: false, error: "缺少配置" }
    try {
      const result = await window.api.testAIConnection(aiSettings) as { ok: boolean; status?: number; error?: string; body?: string }
      return result
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  },
}))
