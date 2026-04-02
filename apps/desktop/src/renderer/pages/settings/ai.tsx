import { useState } from "react"
import { useCurriculumStore } from "../../store/curriculum"

const MODEL_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    { value: "deepseek-chat", label: "DeepSeek V3" },
    { value: "deepseek-reasoner", label: "DeepSeek R1" },
    { value: "qwen-plus", label: "通义千问 Plus" },
    { value: "qwen-turbo", label: "通义千问 Turbo" },
    { value: "glm-4-flash", label: "GLM-4 Flash (智谱)" },
    { value: "glm-4-plus", label: "GLM-4 Plus (智谱)" },
    { value: "doubao-pro-32k", label: "豆包 Pro (字节)" },
    { value: "moonshot-v1-8k", label: "Kimi (月之暗面)" },
  ],
  claude: [
    { value: "glm-5.1", label: "GLM-5.1 (智谱)" },
    { value: "glm-4-plus", label: "GLM-4 Plus (智谱)" },
    { value: "glm-4-flash", label: "GLM-4 Flash (智谱)" },
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
    { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  ],
  custom: [
    { value: "glm-5.1", label: "GLM-5.1 (智谱)" },
    { value: "glm-4-plus", label: "GLM-4 Plus (智谱)" },
    { value: "glm-4-flash", label: "GLM-4 Flash (智谱)" },
    { value: "deepseek-chat", label: "DeepSeek V3" },
    { value: "deepseek-reasoner", label: "DeepSeek R1" },
    { value: "qwen-plus", label: "通义千问 Plus" },
    { value: "qwen-max", label: "通义千问 Max" },
    { value: "doubao-pro-32k", label: "豆包 Pro (字节)" },
    { value: "moonshot-v1-8k", label: "Kimi (月之暗面)" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  ],
}

const PROVIDER_PRESETS: Record<string, { baseUrl: string; note: string }> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    note: "支持 OpenAI 兼容 API（智谱、DeepSeek、通义千问、豆包等）",
  },
  claude: {
    baseUrl: "https://open.bigmodel.cn/api/anthropic",
    note: "Anthropic 兼容格式（智谱等）",
  },
  custom: {
    baseUrl: "",
    note: "自定义 API 地址和格式",
  },
}

export function AISettings() {
  const { aiSettings, updateAISettings, testAIConnection } = useCurriculumStore()
  const [form, setForm] = useState(aiSettings)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; status?: number; error?: string; body?: string } | null>(null)
  const [showKey, setShowKey] = useState(false)

  const handleSave = () => {
    updateAISettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    updateAISettings(form)
    const result = await testAIConnection()
    setTestResult(result)
    setTesting(false)
  }

  const handleProviderChange = (provider: string) => {
    const preset = PROVIDER_PRESETS[provider]
    setForm((prev) => ({
      ...prev,
      provider,
      baseUrl: preset.baseUrl,
    }))
  }

  const models = MODEL_OPTIONS[form.provider] || MODEL_OPTIONS.custom

  return (
    <div className="max-w-2xl">
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="text-xl font-bold">AI 配置</h2>
        <p className="mt-1 text-sm text-base-content/50">
          配置 AI 服务用于自动搜集资料、生成摘要和解析培养方案
        </p>
      </div>

      {/* Form Card */}
      <div className="rounded-xl bg-base-200/50 p-6 space-y-6">

        {/* Provider */}
        <div>
          <label className="text-sm font-medium">AI 提供商</label>
          <select
            className="select select-bordered select-sm w-full mt-1.5"
            value={form.provider}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            <option value="openai">OpenAI 兼容</option>
            <option value="claude">Anthropic 兼容</option>
            <option value="custom">自定义</option>
          </select>
          <p className="mt-1 text-xs text-base-content/40">
            {PROVIDER_PRESETS[form.provider]?.note}
          </p>
        </div>

        {/* Base URL */}
        <div>
          <label className="text-sm font-medium">Base URL</label>
          <input
            type="text"
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder={PROVIDER_PRESETS[form.provider]?.baseUrl || "https://api.openai.com/v1"}
            className="input input-bordered input-sm w-full mt-1.5"
          />
          <p className="mt-1 text-xs text-base-content/40">
            {form.provider === "openai" && "智谱: https://open.bigmodel.cn/api/paas/v4 · DeepSeek: https://api.deepseek.com/v1"}
            {form.provider === "claude" && "智谱 Anthropic 兼容: https://open.bigmodel.cn/api/anthropic"}
          </p>
        </div>

        {/* API Key */}
        <div>
          <label className="text-sm font-medium">API Key</label>
          <div className="relative mt-1.5">
            <input
              type={showKey ? "text" : "password"}
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-..."
              className="input input-bordered input-sm w-full pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs px-1"
            >
              {showKey ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="text-sm font-medium">模型</label>
          <div className="flex gap-2 mt-1.5">
            <select
              className="select select-bordered select-sm flex-1"
              value={models.some((m) => m.value === form.model) ? form.model : ""}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            >
              <option value="" disabled>选择模型</option>
              {models.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="或手动输入"
              className="input input-bordered input-sm flex-1"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex items-center gap-3">
        <button onClick={handleSave} className="btn btn-primary btn-sm px-6">
          {saved ? "✓ 已保存" : "保存配置"}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || !form.baseUrl || !form.apiKey}
          className="btn btn-outline btn-sm px-6"
        >
          {testing ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              测试中...
            </>
          ) : (
            "测试连接"
          )}
        </button>
      </div>

      {/* Test Result */}
      {testResult !== null && (
        <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${
          testResult.ok ? "bg-success/10 text-success" : "bg-error/10 text-error"
        }`}>
          <div className="font-semibold">
            {testResult.ok
              ? `✓ 连接成功 (HTTP ${testResult.status})`
              : `✕ 连接失败${testResult.status ? ` (HTTP ${testResult.status})` : ""}`}
          </div>
          {testResult.body && (
            <pre className="mt-2 whitespace-pre-wrap break-all text-xs opacity-70 max-h-40 overflow-y-auto">{testResult.body}</pre>
          )}
          {testResult.error && !testResult.body && (
            <div className="mt-1 text-xs opacity-70">{testResult.error}</div>
          )}
        </div>
      )}
    </div>
  )
}
