import { create } from "zustand"
import { useMaterialStore } from "./material"
import { useCurriculumStore } from "./curriculum"

export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: string
  searchResults?: Array<{ title: string; type: string; sourceName: string }>
  streaming?: boolean
}

const CHAT_KEY = "studyhive-chat-history"

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function saveMessages(messages: ChatMessage[]) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-100)))
}

function parseSearchAction(text: string): { display: string; searches: Array<{ query: string; courseName: string }> } {
  const searches: Array<{ query: string; courseName: string }> = []
  const clean = text.replace(/\[SEARCH\]\s*([\s\S]*?)\s*\[\/SEARCH\]/g, (_match, json) => {
    try {
      const parsed = JSON.parse(json)
      if (parsed.query && parsed.courseName) {
        searches.push({ query: parsed.query, courseName: parsed.courseName })
      }
    } catch { /* ignore */ }
    return ""
  })
  return { display: clean.trim(), searches }
}

interface ChatState {
  messages: ChatMessage[]
  isOpen: boolean
  isLoading: boolean

  toggleChat: () => void
  openChat: () => void
  closeChat: () => void
  sendMessage: (content: string) => Promise<void>
  clearHistory: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: loadMessages(),
  isOpen: false,
  isLoading: false,

  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),

  sendMessage: async (content: string) => {
    const { aiSettings, searchMode, getEnabledSources, getActiveCourses } = useCurriculumStore.getState()

    if (!aiSettings.apiKey) {
      set((s) => ({
        messages: [...s.messages, {
          id: `sys-${Date.now()}`,
          role: "system" as const,
          content: "请先在设置中配置 AI API Key，才能使用 AI 助手。",
          timestamp: new Date().toISOString(),
        }],
      }))
      return
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    }

    const assistantId = `asst-${Date.now()}`
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      streaming: true,
    }

    set((s) => {
      const messages = [...s.messages, userMsg, assistantMsg]
      saveMessages(messages)
      return { messages, isLoading: true }
    })

    const chatHistory = get().messages
      .filter((m) => m.role === "user" || (m.role === "assistant" && !m.streaming))
      .slice(-10)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }))

    const enabledSources = getEnabledSources().map((s) => ({ name: s.name, url: s.url }))
    const courses = getActiveCourses().map((c) => ({ name: c.name, knowledgePoints: c.knowledgePoints }))

    try {
      // Register listener BEFORE invoking startChat, because chunks fire during the IPC call
      const unsub = window.api.onChatChunk((chunk) => {
        if (chunk.done) {
          unsub()
          const state = get()
          const fullText = state.messages.find((m) => m.id === assistantId)?.content || ""
          const { display, searches } = parseSearchAction(fullText)

          const updated = state.messages.map((m) =>
            m.id === assistantId ? { ...m, content: display, streaming: false } : m,
          )

          if (searches.length > 0) {
            // Execute searches
            const { searchAndCollect } = useMaterialStore.getState()
            for (const s of searches) {
              searchAndCollect(s.courseName)
            }
            const resultMsg: ChatMessage = {
              id: `sys-${Date.now()}`,
              role: "system",
              content: `正在为你搜索：${searches.map((s) => `「${s.query}」(${s.courseName})`).join("、")}`,
              timestamp: new Date().toISOString(),
            }
            updated.push(resultMsg)
          }

          saveMessages(updated)
          set({ messages: updated, isLoading: false })
        } else {
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk.content } : m,
            ),
          }))
        }
      })

      await window.api.startChat({
        messages: chatHistory,
        aiSettings,
        searchMode,
        enabledSources,
        courses,
      })
    } catch (err) {
      set((s) => {
        const updated = s.messages.map((m) =>
          m.id === assistantId
            ? { ...m, content: `请求失败: ${(err as Error).message}`, streaming: false }
            : m,
        )
        saveMessages(updated)
        return { messages: updated, isLoading: false }
      })
    }
  },

  clearHistory: () => {
    saveMessages([])
    set({ messages: [] })
  },
}))
