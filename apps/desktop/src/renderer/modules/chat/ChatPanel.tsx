import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router"
import { useChatStore } from "../../store/chat"
import { useCurriculumStore } from "../../store/curriculum"

export function ChatPanel() {
  const { messages, isOpen, isLoading, toggleChat, closeChat, sendMessage, clearHistory } = useChatStore()
  const { aiSettings } = useCurriculumStore()
  const navigate = useNavigate()
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput("")
    sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Collapsed: FAB button
  if (!isOpen) {
    return (
      <button
        onClick={toggleChat}
        className="fixed bottom-5 right-5 z-20 btn btn-primary btn-circle btn-lg shadow-xl hover:scale-105 transition-transform"
        title="AI 学习助手"
      >
        <span className="text-xl">💬</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-5 right-5 z-20 flex flex-col w-[400px] h-[520px] rounded-xl border border-base-300 bg-base-100 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-base-300 px-4 py-3">
        <span className="text-base">🤖</span>
        <span className="text-sm font-semibold flex-1">AI 学习助手</span>
        {messages.length > 0 && (
          <button onClick={clearHistory} className="btn btn-ghost btn-xs opacity-50 hover:opacity-100">
            清空
          </button>
        )}
        <button onClick={closeChat} className="btn btn-ghost btn-xs opacity-50 hover:opacity-100 text-error">
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-base-content/30">
              <div className="text-3xl mb-2">💬</div>
              <p className="text-sm">告诉我你想找什么资料</p>
              <p className="text-xs mt-1">比如："帮我找二叉树的练习题"</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : msg.role === "system" ? "justify-center" : "justify-start"}`}>
            {msg.role === "user" && (
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-content px-3 py-2">
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            )}

            {msg.role === "assistant" && (
              <div className="max-w-[85%] flex gap-2">
                <span className="text-sm mt-0.5 flex-shrink-0">🤖</span>
                <div className="rounded-2xl rounded-bl-sm bg-base-200 px-3 py-2">
                  <p className="text-sm whitespace-pre-wrap">
                    {msg.content}
                    {msg.streaming && <span className="loading loading-dots loading-xs ml-1" />}
                  </p>
                </div>
              </div>
            )}

            {msg.role === "system" && (
              <div className="max-w-[90%] text-center">
                <span className="badge badge-sm badge-outline gap-1 text-primary">
                  {msg.content}
                </span>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-base-300 p-3">
        {!aiSettings.apiKey ? (
          <div className="text-center">
            <p className="text-xs text-base-content/40 mb-2">请先配置 AI API Key</p>
            <button onClick={() => { navigate("/settings/ai"); closeChat() }} className="btn btn-xs btn-outline btn-primary">前往设置</button>
          </div>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              rows={1}
              className="textarea textarea-bordered flex-1 min-h-[36px] max-h-[80px] text-sm resize-none py-2"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="btn btn-primary btn-sm"
            >
              {isLoading ? <span className="loading loading-spinner loading-xs" /> : "发送"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
