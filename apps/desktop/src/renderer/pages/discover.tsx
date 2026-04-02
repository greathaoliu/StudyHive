import { useState } from "react"
import { useMaterialStore } from "../store/material"
import { useCurriculumStore } from "../store/curriculum"

export function DiscoverPage() {
  const [courseName, setCourseName] = useState("")
  const { searchStatus, searchProgress, searchAndCollect, setActiveCourse, materials } =
    useMaterialStore()
  const { getAllCourses } = useCurriculumStore()

  const handleSearch = async () => {
    if (!courseName.trim()) return
    await searchAndCollect(courseName.trim())
  }

  const isBusy = searchStatus === "searching" || searchStatus === "downloading"

  // 从培养方案课程中生成快捷入口
  const allCourses = getAllCourses()
  const quickPicks = allCourses.map((c) => ({
    course: c.name,
    category: c.category,
    knowledgePoints: c.knowledgePoints,
  }))

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      <div className="border-b border-base-300 p-6">
        <h1 className="text-lg font-bold">发现学习资料</h1>
        <p className="mt-1 text-xs text-base-content/50">
          输入课程名，自动从全球高校搜集课件、试题、网课，并下载到本地
        </p>
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="课程名 (如: 数据结构)"
            className="input input-bordered input-sm flex-1"
            disabled={isBusy}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={isBusy || !courseName.trim()}
            className="btn btn-primary btn-sm"
          >
            {isBusy ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                搜集中...
              </>
            ) : (
              "搜索并下载"
            )}
          </button>
        </div>

        {/* Progress bar */}
        {isBusy && (
          <div className="mt-3">
            <progress className="progress progress-primary w-full" />
            <p className="mt-1 text-xs text-base-content/50">{searchProgress}</p>
          </div>
        )}

        {searchStatus === "done" && (
          <div className="mt-3 rounded-lg bg-success/10 px-3 py-2">
            <p className="text-xs text-success">{searchProgress}</p>
          </div>
        )}

        {searchStatus === "error" && (
          <div className="mt-3 rounded-lg bg-error/10 px-3 py-2">
            <p className="text-xs text-error">{searchProgress}</p>
          </div>
        )}
      </div>

      {/* Quick picks from curriculum */}
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-sm font-semibold text-base-content/60">我的课程 — 点击直接搜集</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {quickPicks.map((item) => {
            const count = materials.filter((m) => m.courseName === item.course).length
            const localCount = materials.filter(
              (m) => m.courseName === item.course && m.downloadStatus === "done",
            ).length
            return (
              <button
                key={item.course}
                onClick={async () => {
                  setCourseName(item.course)
                  await searchAndCollect(item.course)
                }}
                disabled={isBusy}
                className="btn btn-outline btn-sm flex h-auto flex-col items-start gap-0.5 py-3"
              >
                <span className="text-sm font-medium">{item.course}</span>
                <span className="text-xs text-base-content/40">
                  {item.category}
                  {count > 0 && ` · ${count} 项资料`}
                  {localCount > 0 && ` · ${localCount} 已下载`}
                </span>
                {item.knowledgePoints.length > 0 && (
                  <span className="mt-0.5 text-xs text-base-content/30">
                    {item.knowledgePoints.slice(0, 3).join("、")}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
