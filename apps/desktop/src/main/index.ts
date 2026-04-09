import { app, BrowserWindow, shell, ipcMain, dialog, protocol, net } from "electron"
import { join } from "path"
import { pathToFileURL } from "url"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"
import { mkdirSync, existsSync, createWriteStream, readdirSync, statSync, writeFileSync, readFileSync } from "fs"
import { pipeline } from "stream/promises"
import { Readable } from "stream"
import { homedir } from "os"

// PDF 文本提取（使用 pdfjs-dist，主进程中用 Node.js 版本）
async function extractPdfText(filePath: string): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const fileBuffer = readFileSync(filePath)
  const uint8Array = new Uint8Array(fileBuffer)

  // 定位 cmaps 和 标准字体目录
  const cmapDir = join(__dirname, "../../node_modules/pdfjs-dist/cmaps/")
  const fontDir = join(__dirname, "../../node_modules/pdfjs-dist/standard_fonts/")

  const doc = await pdfjsLib.getDocument({
    data: uint8Array,
    cMapUrl: existsSync(cmapDir) ? cmapDir : undefined,
    cMapPacked: true,
    standardFontDataUrl: existsSync(fontDir) ? fontDir : undefined,
  }).promise

  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
    pages.push(pageText)
  }
  return pages.join("\n\n")
}

// 本地存储根目录 ~/StudyHive
const STORAGE_ROOT = join(homedir(), "StudyHive")
const META_FILE = join(STORAGE_ROOT, "metadata.json")

function getStorageDir(): string {
  return STORAGE_ROOT
}

// 确保目录存在
function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// 根据课程生成子目录路径
function getCourseDir(courseName: string): string {
  const dir = join(STORAGE_ROOT, courseName)
  ensureDir(dir)
  return dir
}

// 从 URL 提取文件名，用 id 前缀避免碰撞
function extractFilename(url: string, id: string, fallback: string): string {
  try {
    const pathname = new URL(url).pathname
    let base = decodeURIComponent(pathname.split("/").pop() || fallback)
    if (!base.endsWith(".pdf")) base = `${base}.pdf`
    return `${id}-${base}`
  } catch {
    return `${id}-${fallback}`
  }
}

// 下载文件到本地
async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // 用流写入
  const ws = createWriteStream(destPath)
  const readable = Readable.from(buffer)
  await pipeline(readable, ws)
}

// 扫描本地已下载的资料
function scanLocalMaterials(): LocalFileMeta[] {
  if (!existsSync(META_FILE)) return []
  try {
    const raw = readFileSync(META_FILE, "utf-8")
    return JSON.parse(raw)
  } catch {
    return []
  }
}

// 保存元数据
function saveMeta(entries: LocalFileMeta[]): void {
  ensureDir(STORAGE_ROOT)
  writeFileSync(META_FILE, JSON.stringify(entries, null, 2), "utf-8")
}

interface LocalFileMeta {
  id: string
  localPath: string
  originalUrl: string
  downloadedAt: string
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  })

  mainWindow.on("ready-to-show", () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: "deny" }
  })

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
  }
}

// ==================== IPC Handlers ====================

// 下载单个文件
ipcMain.handle("file:download", async (_event, payload: {
  id: string
  url: string
  courseName: string
  title: string
}) => {
  try {
    const courseDir = getCourseDir(payload.courseName)
    const filename = extractFilename(payload.url, payload.id, `${payload.title}.pdf`)
    const localPath = join(courseDir, filename)

    // 如果已经下载过，直接返回
    if (existsSync(localPath)) {
      const metas = scanLocalMaterials()
      const existing = metas.find((m) => m.id === payload.id)
      if (!existing) {
        metas.push({
          id: payload.id,
          localPath,
          originalUrl: payload.url,
          downloadedAt: new Date().toISOString(),
        })
        saveMeta(metas)
      }
      return { success: true, localPath }
    }

    await downloadFile(payload.url, localPath)

    // 记录元数据
    const metas = scanLocalMaterials()
    metas.push({
      id: payload.id,
      localPath,
      originalUrl: payload.url,
      downloadedAt: new Date().toISOString(),
    })
    saveMeta(metas)

    return { success: true, localPath }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

// 批量下载
ipcMain.handle("file:downloadBatch", async (_event, items: Array<{
  id: string
  url: string
  courseName: string
  title: string
}>) => {
  const results: Array<{ id: string; success: boolean; localPath?: string; error?: string }> = []

  for (const item of items) {
    try {
      const courseDir = getCourseDir(item.courseName)
      const filename = extractFilename(item.url, item.id, `${item.title}.pdf`)
      const localPath = join(courseDir, filename)

      if (!existsSync(localPath)) {
        await downloadFile(item.url, localPath)
      }

      const metas = scanLocalMaterials()
      if (!metas.find((m) => m.id === item.id)) {
        metas.push({
          id: item.id,
          localPath,
          originalUrl: item.url,
          downloadedAt: new Date().toISOString(),
        })
        saveMeta(metas)
      }

      results.push({ id: item.id, success: true, localPath })
    } catch (err) {
      results.push({ id: item.id, success: false, error: (err as Error).message })
    }
  }

  return results
})

// 获取所有本地已下载的资料映射
ipcMain.handle("file:getLocalMap", async () => {
  const metas = scanLocalMaterials()
  const map: Record<string, string> = {}
  for (const m of metas) {
    // 确认文件存在
    if (existsSync(m.localPath)) {
      map[m.id] = m.localPath
    }
  }
  return map
})

// 获取存储根目录
ipcMain.handle("file:getStorageDir", async () => {
  return getStorageDir()
})

// 获取存储统计
ipcMain.handle("file:getStats", async () => {
  const metas = scanLocalMaterials()
  let totalSize = 0
  let fileCount = 0

  for (const m of metas) {
    if (existsSync(m.localPath)) {
      try {
        const stat = statSync(m.localPath)
        totalSize += stat.size
        fileCount++
      } catch { /* skip */ }
    }
  }

  return { fileCount, totalSize, storageRoot: STORAGE_ROOT }
})

// 读取本地文件为 ArrayBuffer（供渲染进程加载 PDF）
ipcMain.handle("file:readBinary", async (_event, filePath: string) => {
  if (!existsSync(filePath)) return null
  return readFileSync(filePath)
})

// 在系统文件管理器中打开
ipcMain.handle("file:showInFolder", async (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
})

// 选择文件对话框
ipcMain.handle("dialog:selectFiles", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Documents", extensions: ["pdf", "ppt", "pptx", "doc", "docx", "zip"] },
      { name: "All Files", extensions: ["*"] },
    ],
  })
  return result.filePaths
})

// 选择培养方案 PDF
ipcMain.handle("dialog:selectCurriculumPDF", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  })
  return result.filePaths[0] || null
})

// AI 解析培养方案
interface ParseCurriculumPayload {
  filePath: string
  aiSettings: {
    provider: string
    baseUrl: string
    apiKey: string
    model: string
  }
}

// 测试 AI 连接
ipcMain.handle("ai:testConnection", async (_event, aiSettings: ParseCurriculumPayload["aiSettings"]) => {
  if (!aiSettings.baseUrl || !aiSettings.apiKey) return { ok: false, error: "缺少 Base URL 或 API Key", body: "" }

  console.log("[ai:testConnection] received:", JSON.stringify(aiSettings))

  // 清理所有字段，去除不可见字符
  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, "")
  const baseUrl = clean(aiSettings.baseUrl)
  const apiKey = clean(aiSettings.apiKey)
  const model = clean(aiSettings.model)

  console.log("[ai:testConnection] cleaned:", JSON.stringify({ baseUrl, apiKey: apiKey.slice(0, 8) + "...", model }))

  const isAnthropic = aiSettings.provider === "claude" || baseUrl.includes("/anthropic")

  try {
    let url: string
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    const body = JSON.stringify({
      model,
      max_tokens: 5,
      messages: [{ role: "user", content: "Hi" }],
    })

    if (isAnthropic) {
      url = baseUrl.endsWith("/")
        ? `${baseUrl}v1/messages`
        : `${baseUrl}/v1/messages`
      headers["x-api-key"] = apiKey
      headers["anthropic-version"] = "2023-06-01"
    } else {
      url = baseUrl.endsWith("/")
        ? `${baseUrl}chat/completions`
        : `${baseUrl}/chat/completions`
      headers["Authorization"] = `Bearer ${apiKey}`
    }

    console.log("[ai:testConnection] fetching:", url)
    const res = await fetch(url, { method: "POST", headers, body })
    const text = await res.text().catch(() => "")
    console.log("[ai:testConnection] response:", res.status, text.slice(0, 300))
    return { ok: res.ok, status: res.status, body: text.slice(0, 1000) }
  } catch (err) {
    console.error("[ai:testConnection] error:", err)
    return { ok: false, error: (err as Error).message, body: "" }
  }
})

interface ParsedCurriculum {
  name: string
  school: string
  courses: Array<{
    id: string
    name: string
    category: string
    semester?: string
    credits?: number
    knowledgePoints: string[]
  }>
}

// 从文件名推断学校和方案名
function guessInfoFromFileName(filePath: string): { name: string; school: string } {
  const basename = filePath.split("/").pop() || ""
  const nameWithoutExt = basename.replace(/\.pdf$/i, "")
  // 常见中国大学名
  const schools = [
    "浙江大学", "北京大学", "清华大学", "复旦大学", "上海交通大学",
    "南京大学", "中国科学技术大学", "哈尔滨工业大学", "武汉大学", "中山大学",
    "同济大学", "北京航空航天大学", "四川大学", "华中科技大学", "西安交通大学",
  ]
  let school = ""
  for (const s of schools) {
    if (nameWithoutExt.includes(s)) { school = s; break }
  }
  // 也匹配英文简称
  if (!school) {
    if (/zju|浙大/i.test(nameWithoutExt)) school = "浙江大学"
    else if (/pku|北大/i.test(nameWithoutExt)) school = "北京大学"
    else if (/tsinghua|清华/i.test(nameWithoutExt)) school = "清华大学"
    else if (/sjtu|上交/i.test(nameWithoutExt)) school = "上海交通大学"
  }
  const name = nameWithoutExt.replace(/[_-]/g, " ")
  return { name: name || "培养方案", school: school || "未知学校" }
}

// 根据 school 生成对应的 mock 课程（不同学校不同课程）
function getMockParsedCurriculum(filePath: string): ParsedCurriculum {
  const info = guessInfoFromFileName(filePath)
  const id = Date.now()
  const courses: ParsedCurriculum["courses"] = [
    { id: `mc${id}-1`, name: "数据结构与算法", category: "专业核心课", semester: "大二上", credits: 4, knowledgePoints: ["二叉树", "图论", "排序算法", "哈希表"] },
    { id: `mc${id}-2`, name: "操作系统", category: "专业核心课", semester: "大二下", credits: 4, knowledgePoints: ["进程管理", "内存管理", "文件系统", "死锁"] },
    { id: `mc${id}-3`, name: "计算机网络", category: "专业核心课", semester: "大三上", credits: 3, knowledgePoints: ["TCP/IP", "HTTP", "路由算法", "Socket"] },
    { id: `mc${id}-4`, name: "计算机组成原理", category: "专业核心课", semester: "大二上", credits: 4, knowledgePoints: ["指令集", "流水线", "Cache", "总线"] },
    { id: `mc${id}-5`, name: "数据库系统", category: "专业核心课", semester: "大三上", credits: 3, knowledgePoints: ["SQL", "事务", "索引", "范式"] },
    { id: `mc${id}-6`, name: "编译原理", category: "专业核心课", semester: "大三上", credits: 3, knowledgePoints: ["词法分析", "语法分析", "代码生成"] },
    { id: `mc${id}-7`, name: "高等数学", category: "公共基础课", semester: "大一上", credits: 6, knowledgePoints: ["微积分", "级数", "微分方程"] },
    { id: `mc${id}-8`, name: "线性代数", category: "公共基础课", semester: "大一上", credits: 3, knowledgePoints: ["矩阵运算", "特征值", "向量空间"] },
    { id: `mc${id}-9`, name: "概率论与数理统计", category: "公共基础课", semester: "大一下", credits: 3, knowledgePoints: ["概率分布", "假设检验", "贝叶斯"] },
    { id: `mc${id}-10`, name: "离散数学", category: "公共基础课", semester: "大一上", credits: 3, knowledgePoints: ["集合论", "图论", "逻辑推理"] },
    { id: `mc${id}-11`, name: "人工智能", category: "专业选修课", semester: "大三下", credits: 3, knowledgePoints: ["搜索", "机器学习", "神经网络"] },
    { id: `mc${id}-12`, name: "软件工程", category: "专业选修课", semester: "大三下", credits: 3, knowledgePoints: ["需求分析", "设计模式", "敏捷开发"] },
  ]
  return { ...info, courses }
}

// AI 课程名标准化：合并分学期课程，统一通用名称
ipcMain.handle("curriculum:normalizeCourses", async (_event, payload: {
  courses: Array<{ id: string; name: string; category: string; semester?: string; credits?: number; knowledgePoints: string[]; archived: boolean }>
  aiSettings: ParseCurriculumPayload["aiSettings"]
}) => {
  const { courses, aiSettings } = payload
  if (!aiSettings.baseUrl || !aiSettings.apiKey) {
    return { ok: false, error: "请先配置 AI", courses }
  }

  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, "")
  const baseUrl = clean(aiSettings.baseUrl)
  const apiKey = clean(aiSettings.apiKey)
  const model = clean(aiSettings.model)
  const isAnthropic = aiSettings.provider === "claude" || baseUrl.includes("/anthropic")

  const prompt = `你是大学培养方案课程标准化助手。对以下课程列表执行标准化，返回相同格式的 JSON 数组。

处理规则：
1. 合并同课多学期（名称相似且带有学期后缀的合并为一门）：
   - 学期后缀包括：（一）（二）（三）（上）（下）（上册）（下册）Ⅰ Ⅱ Ⅲ I II III IV 1 2 3 A B
   - 合并后：id 取第一个、name 去掉后缀、semester 取最早的、credits 相加、knowledgePoints 取并集去重、category/archived 取第一个
2. 标准化课程名（去掉无区分意义的修饰语，使名称更通用、更易搜索）：
   - "数据结构基础" → "数据结构"
   - "操作系统原理" / "操作系统概论" → "操作系统"
   - "程序设计基础" → "程序设计"
   - "计算机网络技术" → "计算机网络"
   - "软件工程导论" → "软件工程"
   - "人工智能导论" → "人工智能"
   - "高等数学（理工）" / "高等数学（文理）" → "高等数学"
   - "大学物理（上）" + "大学物理（下）" → "大学物理"
   - 有具体语言/方向的修饰语保留，如 "C语言程序设计"、"Python数据分析"
3. 为每门课程生成 aliases（别名/搜索关键词）数组，包含：
   - 英文名（如 "数据结构" → "Data Structures"）
   - 常见缩写（如 "DSA"、"OS"、"OOP"）
   - 其他常见中文叫法（如 "高等数学" → "微积分"、"概率论与数理统计" → "概率统计"）
   - 合并前的原始名称（如 "数据结构基础" 合并为 "数据结构" 后，原名 "数据结构基础" 放入 aliases）
4. 不需要处理的课程保持原样，但仍需补充 aliases

只返回 JSON 数组，不要有任何解释文字。格式：
[{"id":"...","name":"...","category":"...","semester":"...","credits":N,"knowledgePoints":[...],"archived":false,"aliases":[...]},...]

课程列表：
${JSON.stringify(courses)}`

  try {
    let content: string

    if (isAnthropic) {
      const url = baseUrl.endsWith("/") ? `${baseUrl}v1/messages` : `${baseUrl}/v1/messages`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 8192, messages: [{ role: "user", content: prompt }] }),
      })
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, courses }
      const data = await res.json() as { content: Array<{ type: string; text: string }> }
      content = data.content?.find((b) => b.type === "text")?.text || ""
    } else {
      const url = baseUrl.endsWith("/") ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, max_tokens: 8192, messages: [{ role: "user", content: prompt }] }),
      })
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, courses }
      const data = await res.json() as { choices: Array<{ message: { content: string } }> }
      content = data.choices?.[0]?.message?.content || ""
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return { ok: false, error: "AI 返回格式不正确", courses }
    const normalized = JSON.parse(jsonMatch[0]) as typeof courses
    return { ok: true, courses: normalized }
  } catch (err) {
    return { ok: false, error: (err as Error).message, courses }
  }
})

ipcMain.handle("curriculum:parsePDF", async (_event, payload: ParseCurriculumPayload) => {
  const { aiSettings, filePath } = payload

  // 检查文件是否存在
  if (!existsSync(filePath)) {
    throw new Error("文件不存在")
  }

  // 如果没有配置 AI，从文件名推断并返回 mock 数据
  if (!aiSettings.baseUrl || !aiSettings.apiKey) {
    return {
      ...getMockParsedCurriculum(filePath),
      _mock: true, // 标记为 mock 数据，前端可以提示用户
    }
  }

  // 读取 PDF 并提取文本
  let pdfText = ""
  try {
    pdfText = await extractPdfText(filePath)
  } catch (pdfErr) {
    console.error("PDF text extraction failed:", pdfErr)
    return { ...getMockParsedCurriculum(filePath), _mock: true }
  }

  if (!pdfText.trim()) {
    console.error("PDF text is empty (possibly scanned image PDF)")
    return { ...getMockParsedCurriculum(filePath), _mock: true }
  }

  // 截取前 30000 字符避免 token 超限（培养方案课程表通常在后半段，需要更大窗口）
  const truncatedText = pdfText.length > 30000 ? pdfText.slice(0, 30000) + "\n\n[...后续内容已截断...]" : pdfText

  // 调用 AI API
  const prompt = `你是一个大学培养方案解析助手。以下是一份大学培养方案 PDF 的完整文本内容，请仔细阅读并提取出其中 **所有** 课程信息。

重要要求：
1. 必须提取所有课程，包括公共基础课、专业核心课、专业选修课、通识课、实践课、体育课、外语课、军事理论等
2. 一个完整的培养方案通常包含 30-80 门课程，请不要遗漏任何一门
3. 注意表格中的每一行通常代表一门课程
4. 分类请使用：专业核心课、公共基础课、专业选修课、通识课、实践课
5. 每门课程请根据课程名推断 3-5 个核心知识点
6. 学分和学期信息请从文本中准确读取

请严格按照以下 JSON 格式返回（不要返回其他内容，只返回 JSON）：
{
  "name": "培养方案名称（如：计算机科学与技术 2024 培养方案）",
  "school": "学校名称（如：浙江大学）",
  "courses": [
    {
      "id": "c1",
      "name": "课程名称",
      "category": "分类",
      "semester": "建议学期（如：大一上、大二下）",
      "credits": 学分数值,
      "knowledgePoints": ["知识点1", "知识点2", "知识点3"]
    }
  ]
}

请确保课程数量完整，不要省略任何课程。

===== 培养方案文本内容 =====
${truncatedText}`

  const isAnthropic = aiSettings.provider === "claude" || aiSettings.baseUrl.includes("/anthropic")

  try {
    let content: string

    if (isAnthropic) {
      // Anthropic 兼容格式
      const url = aiSettings.baseUrl.endsWith("/")
        ? `${aiSettings.baseUrl}v1/messages`
        : `${aiSettings.baseUrl}/v1/messages`
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": aiSettings.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: aiSettings.model,
          max_tokens: 16384,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => "")
        console.error(`Anthropic API error: ${response.status}`, errText)
        return { ...getMockParsedCurriculum(filePath), _mock: true }
      }

      const data = (await response.json()) as { content: Array<{ type: string; text: string }> }
      content = data.content?.find((b) => b.type === "text")?.text || ""
    } else {
      // OpenAI 兼容格式
      const url = aiSettings.baseUrl.endsWith("/")
        ? `${aiSettings.baseUrl}chat/completions`
        : `${aiSettings.baseUrl}/chat/completions`
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiSettings.apiKey}`,
        },
        body: JSON.stringify({
          model: aiSettings.model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 16384,
        }),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => "")
        console.error(`OpenAI API error: ${response.status}`, errText)
        return { ...getMockParsedCurriculum(filePath), _mock: true }
      }

      const data = (await response.json()) as { choices: Array<{ message: { content: string } }> }
      content = data.choices?.[0]?.message?.content || ""
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { ...getMockParsedCurriculum(filePath), _mock: true }
    }

    const parsed = JSON.parse(jsonMatch[0]) as ParsedCurriculum
    for (const course of parsed.courses) {
      if (!course.id) course.id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    }
    return parsed
  } catch (err) {
    console.error("AI parse failed:", err)
    return { ...getMockParsedCurriculum(filePath), _mock: true }
  }
})

// AI 生成资料摘要
ipcMain.handle("ai:generateSummary", async (_event, payload: {
  material: {
    title: string
    courseName: string
    tags: string[]
    knowledgePoints: string[]
    university: string
    sourceName: string
    type: string
    filePages?: number
    localPath?: string
  }
  aiSettings: ParseCurriculumPayload["aiSettings"]
}) => {
  const { material, aiSettings } = payload
  if (!aiSettings.baseUrl || !aiSettings.apiKey) {
    return { ok: false, error: "请先配置 AI", summary: "" }
  }

  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, "")
  const baseUrl = clean(aiSettings.baseUrl)
  const apiKey = clean(aiSettings.apiKey)
  const model = clean(aiSettings.model)

  // Try to extract actual content from the local file
  let fileContent = ""
  if (material.localPath && existsSync(material.localPath)) {
    try {
      const raw = await extractPdfText(material.localPath)
      fileContent = raw.slice(0, 4000).trim()
    } catch {
      // If extraction fails, proceed without content
    }
  }

  const prompt = fileContent
    ? `请根据以下学习资料的实际内容，生成一段简短的中文摘要（2-3句话），说明资料的主要内容和适用场景。

资料标题：${material.title}
课程：${material.courseName}
知识点：${material.knowledgePoints.join("、")}

资料内容（节选）：
${fileContent}

请直接输出摘要文本，不要包含标题或其他格式。`
    : `请为以下学习资料生成一段简短的中文摘要（2-3句话），说明资料的主要内容和适用场景。

资料信息：
- 标题：${material.title}
- 课程：${material.courseName}
- 类型：${material.type}
- 来源：${material.sourceName}（${material.university}）
- 知识点：${material.knowledgePoints.join("、")}
- 标签：${material.tags.join("、")}
${material.filePages ? `- 页数：${material.filePages} 页` : ""}

请直接输出摘要文本，不要包含标题或其他格式。`

  const isAnthropic = aiSettings.provider === "claude" || aiSettings.baseUrl.includes("/anthropic")

  try {
    let content: string

    if (isAnthropic) {
      const url = baseUrl.endsWith("/") ? `${baseUrl}v1/messages` : `${baseUrl}/v1/messages`
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 256,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}`, summary: "" }
      }
      const data = (await res.json()) as { content: Array<{ type: string; text: string }> }
      content = data.content?.find((b) => b.type === "text")?.text || ""
    } else {
      const url = baseUrl.endsWith("/") ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 256,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}`, summary: "" }
      }
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
      content = data.choices?.[0]?.message?.content || ""
    }

    return { ok: true, summary: content.trim() }
  } catch (err) {
    return { ok: false, error: (err as Error).message, summary: "" }
  }
})

// AI 搜索资料：让 AI 推荐课程资料的真实 URL
ipcMain.handle("ai:searchMaterials", async (_event, payload: {
  courseName: string
  knowledgePoints: string[]
  aliases: string[]
  enabledSources: Array<{ name: string; url: string }>
  searchMode: string
  aiSettings: ParseCurriculumPayload["aiSettings"]
}) => {
  const { courseName, knowledgePoints, aliases, enabledSources, searchMode, aiSettings } = payload
  if (!aiSettings.baseUrl || !aiSettings.apiKey) {
    return { ok: false, error: "请先配置 AI", materials: [] }
  }

  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, "")
  const baseUrl = clean(aiSettings.baseUrl)
  const apiKey = clean(aiSettings.apiKey)
  const model = clean(aiSettings.model)
  const isAnthropic = aiSettings.provider === "claude" || baseUrl.includes("/anthropic")

  const sourcesText = searchMode === "focused"
    ? `Only suggest resources from these sources: ${enabledSources.map((s) => `${s.name} (${s.url})`).join(", ")}`
    : `Suggest resources from any reputable source, especially: ${enabledSources.map((s) => s.name).join(", ")}`

  const aliasesText = aliases.length > 0 ? ` (also known as: ${aliases.join(", ")})` : ""

  const prompt = `You are a university course material search assistant. For the course "${courseName}"${aliasesText} with knowledge points: ${knowledgePoints.join(", ")}.

${sourcesText}

Suggest 5-10 real, high-quality learning materials that a student studying this course would benefit from.

CRITICAL RULES — READ CAREFULLY:
1. DO NOT fabricate or guess URLs. You MUST only provide URLs you are 100% certain exist.
2. DO NOT include any GitHub repository URLs (github.com) in your results — GitHub repos are scanned separately by the system. Skip any resource hosted on GitHub entirely.
3. For 学堂在线 (xuetangx.com), Coursera, Bilibili, etc.: DO NOT guess course IDs or URLs. These platforms change URLs frequently. Instead, set externalUrl to null, and put the platform name + course title in the title field so the user can search manually.
4. For courseware PDFs, only provide URLs from well-known stable sources (like web.stanford.edu, inst.eecs.berkeley.edu, ocw.mit.edu) where you have seen the exact URL before.
5. If you are not sure a URL exists, you MUST set both fileUrl and externalUrl to null. The user can search by title.
6. It is FAR BETTER to return 10 items with null URLs (searchable by title) than to return 3 items with fabricated URLs.
7. For each item, include a "searchQuery" field: a short search string the user could paste into Google/Bilibili/学堂在线 to find this exact resource.
8. For structured resource guide websites (e.g. csdiy.wiki, hackway.org, cs-self-learning.github.io, hackway.org), you MUST provide the specific sub-page URL for the exact course/topic. NEVER link to the root domain or a top-level category page. Examples of what is required:
   - csdiy.wiki: https://csdiy.wiki/数学/线性代数/MIT18.06/ (NOT https://csdiy.wiki or https://csdiy.wiki/数学/)
   - hackway.org: https://hackway.org/docs/cs/freshman/first/harvard (NOT https://hackway.org or https://hackway.org/docs/)
   Always link to the deepest sub-page that directly describes the course or resource.
9. The course name "${courseName}" may have many equivalent names, abbreviations, and English translations. Consider ALL common variants when searching. For example:
   - "数据结构" = "Data Structures" = "数据结构与算法" = "DSA"
   - "操作系统" = "Operating Systems" = "OS"
   - "计算机网络" = "Computer Networks" = "Computer Networking"
   - "线性代数" = "Linear Algebra"
   - "高等数学" = "Calculus" = "Advanced Mathematics"
   Use your knowledge of the course's subject matter to identify resources under any of its common names (Chinese or English).

IMPORTANT: Respond with ONLY a JSON array, no other text. Each object must have these fields:
- "title": string (the real, specific title of the material)
- "type": "courseware" | "video" | "exam" | "notes" | "link"
- "fileUrl": string | null (direct PDF download URL, null if unsure)
- "externalUrl": string | null (web page URL, null if unsure)
- "university": string (the institution that created it)
- "tags": string[] (2-4 relevant tags in Chinese)
- "knowledgePoints": string[] (which knowledge points this covers, in Chinese)
- "videoPlatform": "YouTube" | "Bilibili" | "Coursera" | "edX" | "学堂在线" | null
- "duration": string | null (for videos, e.g. "45:00")
- "searchQuery": string (a search query to find this resource online)

Respond with ONLY valid JSON array. No markdown, no explanation.`

  try {
    let content: string

    if (isAnthropic) {
      const url = baseUrl.endsWith("/") ? `${baseUrl}v1/messages` : `${baseUrl}/v1/messages`
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}`, materials: [] }
      }
      const data = (await res.json()) as { content: Array<{ type: string; text: string }> }
      content = data.content?.find((b) => b.type === "text")?.text || ""
    } else {
      const url = baseUrl.endsWith("/") ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}`, materials: [] }
      }
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
      content = data.choices?.[0]?.message?.content || ""
    }

    // Parse JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return { ok: false, error: "AI response not valid JSON", materials: [] }
    }

    const materials = JSON.parse(jsonMatch[0]) as Array<{
      title: string
      type: string
      fileUrl: string | null
      externalUrl: string | null
      university: string
      tags: string[]
      knowledgePoints: string[]
      videoPlatform: string | null
      duration: string | null
    }>

    return { ok: true, materials, rawResponse: content }
  } catch (err) {
    return { ok: false, error: (err as Error).message, materials: [], rawResponse: "" }
  }
})

// AI 流式对话
ipcMain.handle("ai:chatStream", async (event, payload: {
  messages: Array<{ role: string; content: string }>
  aiSettings: ParseCurriculumPayload["aiSettings"]
  searchMode: string
  enabledSources: Array<{ name: string; url: string }>
  courses: Array<{ name: string; knowledgePoints: string[] }>
}) => {
  const { messages, aiSettings, searchMode, enabledSources, courses } = payload
  if (!aiSettings.baseUrl || !aiSettings.apiKey) {
    event.sender.send("ai:chatChunk", { id: "error", content: "请先在设置中配置 AI API", done: true })
    return "error"
  }

  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, "")
  const baseUrl = clean(aiSettings.baseUrl)
  const apiKey = clean(aiSettings.apiKey)
  const model = clean(aiSettings.model)
  const isAnthropic = aiSettings.provider === "claude" || baseUrl.includes("/anthropic")

  const streamId = `chat-${Date.now()}`

  const systemPrompt = `你是 StudyHive 学习助手，帮助大学生搜集和管理学习资料。

当前用户的课程列表：
${courses.map((c) => `- ${c.name}（知识点：${c.knowledgePoints.join("、")}）`).join("\n")}

搜索模式：${searchMode === "focused" ? "聚焦模式（仅从已配置信息源搜索）" : "发散模式（在全网广泛搜索）"}
已启用的信息源：${enabledSources.map((s) => s.name).join("、")}

当用户想找资料或补全某个课程的资料时，请在回复末尾追加搜索标记：
[SEARCH]
{"query": "搜索关键词", "courseName": "对应课程名"}
[/SEARCH]

你可以先简要回复用户，然后在末尾加上搜索标记。搜索标记中的 courseName 必须是用户课程列表中的课程名。`

  try {
    const allMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages,
    ]

    let url: string
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    let body: string

    if (isAnthropic) {
      url = baseUrl.endsWith("/") ? `${baseUrl}v1/messages` : `${baseUrl}/v1/messages`
      headers["x-api-key"] = apiKey
      headers["anthropic-version"] = "2023-06-01"
      // Anthropic: system prompt separate, messages without system role
      const chatMessages = allMessages.filter((m) => m.role !== "system").map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }))
      body = JSON.stringify({
        model,
        max_tokens: 1024,
        stream: true,
        system: systemPrompt,
        messages: chatMessages,
      })
    } else {
      url = baseUrl.endsWith("/") ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`
      headers["Authorization"] = `Bearer ${apiKey}`
      body = JSON.stringify({
        model,
        max_tokens: 1024,
        stream: true,
        messages: allMessages,
      })
    }

    const response = await fetch(url, { method: "POST", headers, body })

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      event.sender.send("ai:chatChunk", {
        id: streamId,
        content: `API 错误 (${response.status}): ${errText.slice(0, 200)}`,
        done: true,
      })
      return streamId
    }

    if (!response.body) {
      event.sender.send("ai:chatChunk", { id: streamId, content: "响应体为空", done: true })
      return streamId
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(":")) continue

        if (isAnthropic) {
          if (trimmed.startsWith("data: ")) {
            try {
              const data = JSON.parse(trimmed.slice(6))
              if (data.type === "content_block_delta" && data.delta?.text) {
                event.sender.send("ai:chatChunk", { id: streamId, content: data.delta.text, done: false })
              }
            } catch { /* skip malformed JSON */ }
          }
        } else {
          if (trimmed === "data: [DONE]") continue
          if (trimmed.startsWith("data: ")) {
            try {
              const data = JSON.parse(trimmed.slice(6))
              const content = data.choices?.[0]?.delta?.content
              if (content) {
                event.sender.send("ai:chatChunk", { id: streamId, content, done: false })
              }
            } catch { /* skip malformed JSON */ }
          }
        }
      }
    }

    event.sender.send("ai:chatChunk", { id: streamId, content: "", done: true })
    return streamId
  } catch (err) {
    event.sender.send("ai:chatChunk", {
      id: streamId,
      content: `请求失败: ${(err as Error).message}`,
      done: true,
    })
    return streamId
  }
})

// 持久化资料数据
const MATERIALS_FILE = join(STORAGE_ROOT, "materials.json")

ipcMain.handle("materials:save", async (_event, data: unknown) => {
  try {
    ensureDir(STORAGE_ROOT)
    writeFileSync(MATERIALS_FILE, JSON.stringify(data, null, 2), "utf-8")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
})

ipcMain.handle("materials:load", async () => {
  try {
    if (!existsSync(MATERIALS_FILE)) return { ok: false, data: null }
    const raw = readFileSync(MATERIALS_FILE, "utf-8")
    return { ok: true, data: JSON.parse(raw) }
  } catch (err) {
    return { ok: false, data: null, error: (err as Error).message }
  }
})

// 验证 URL 是否可访问
ipcMain.handle("url:validate", async (_event, url: string) => {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    })
    return { ok: response.ok, status: response.status }
  } catch {
    // HEAD 可能被拒绝，尝试 GET
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
        headers: { Range: "bytes=0-0" },
      })
      return { ok: response.ok || response.status === 206, status: response.status }
    } catch (err) {
      return { ok: false, status: 0, error: (err as Error).message }
    }
  }
})

// 批量验证 URL
ipcMain.handle("url:validateBatch", async (_event, urls: Array<{ id: string; url: string }>) => {
  const results: Array<{ id: string; ok: boolean; status: number }> = []
  for (const item of urls) {
    try {
      const response = await fetch(item.url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      })
      results.push({ id: item.id, ok: response.ok, status: response.status })
    } catch {
      try {
        const response = await fetch(item.url, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(8000),
          headers: { Range: "bytes=0-0" },
        })
        results.push({ id: item.id, ok: response.ok || response.status === 206, status: response.status })
      } catch {
        results.push({ id: item.id, ok: false, status: 0 })
      }
    }
  }
  return results
})

// GitHub 仓库 PDF 扫描
ipcMain.handle("github:scanRepo", async (_event, payload: {
  repoUrl: string
  courseName: string
  knowledgePoints: string[]
  aliases?: string[]
}) => {
  const match = payload.repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/)
  if (!match) return { ok: false, error: "Not a GitHub URL", files: [] }

  const [, owner, repoRaw] = match
  const repo = repoRaw.replace(/\.git$/, "")

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
      { headers: { "Accept": "application/vnd.github+json", "User-Agent": "StudyHive/1.0" } },
    )
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return { ok: false, error: `GitHub API ${res.status}: ${text.slice(0, 200)}`, files: [] }
    }

    const data = await res.json() as {
      tree: Array<{ path: string; type: string; size?: number }>
      truncated: boolean
    }

    // Build keyword list for matching (course name + knowledge points + aliases)
    const keywords = [payload.courseName, ...payload.knowledgePoints, ...(payload.aliases || [])].map((k) => k.toLowerCase())

    const matched = data.tree.filter((item) => {
      if (item.type !== "blob") return false
      if (!item.path.toLowerCase().endsWith(".pdf")) return false
      const pathLower = item.path.toLowerCase()
      return keywords.some((kw) => kw.length > 1 && pathLower.includes(kw))
    })

    const files = matched.map((item) => ({
      path: item.path,
      filename: item.path.split("/").pop() || item.path,
      rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${item.path.split("/").map(encodeURIComponent).join("/")}`,
      size: item.size || 0,
    }))

    return { ok: true, files, truncated: data.truncated || false, scanned: data.tree.length }
  } catch (err) {
    return { ok: false, error: (err as Error).message, files: [] }
  }
})

// 持久化培养方案数据
const PROGRAMS_FILE = join(STORAGE_ROOT, "programs.json")

ipcMain.handle("programs:save", async (_event, data: unknown) => {
  try {
    ensureDir(STORAGE_ROOT)
    writeFileSync(PROGRAMS_FILE, JSON.stringify(data, null, 2), "utf-8")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
})

ipcMain.handle("programs:load", async () => {
  try {
    if (!existsSync(PROGRAMS_FILE)) return { ok: false, data: null }
    const raw = readFileSync(PROGRAMS_FILE, "utf-8")
    return { ok: true, data: JSON.parse(raw) }
  } catch (err) {
    return { ok: false, data: null, error: (err as Error).message }
  }
})

// 注册自定义协议（必须在 app.whenReady 之前）
protocol.registerSchemesAsPrivileged([
  {
    scheme: "local-pdf",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  },
])

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.studyhive.desktop")

  // local-pdf:// 协议：让渲染进程通过 URL 读取本地 PDF 文件
  protocol.handle("local-pdf", (request) => {
    // URL format: local-pdf://host/<encodedPath>
    // standard: true means Chromium parses it like http, so we get a proper URL with host
    let filePath: string
    try {
      const url = new URL(request.url)
      // The path is everything after the host, URL-decoded
      filePath = decodeURIComponent(url.pathname)
      // On Windows the pathname may start with /C:, keep as-is on macOS (/Users/...)
    } catch {
      // Fallback: strip scheme manually
      const raw = request.url.replace(/^local-pdf:\/\//, "")
      filePath = decodeURIComponent(raw)
    }

    console.log("[local-pdf] request:", request.url, "-> filePath:", filePath)

    if (existsSync(filePath)) {
      return net.fetch(pathToFileURL(filePath).href)
    }
    console.error("[local-pdf] file not found:", filePath)
    return new Response("Not found", { status: 404 })
  })

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
