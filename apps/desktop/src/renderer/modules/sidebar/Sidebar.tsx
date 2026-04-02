import { useState } from "react"
import { useNavigate, useLocation } from "react-router"
import { useMaterialStore } from "../../store/material"
import { useCurriculumStore } from "../../store/curriculum"

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { materials, activeCourse, setActiveCourse, searchAndCollect, searchStatus, validateCourseMaterials } = useMaterialStore()
  const {
    getCourseTree,
    getSchoolName,
    getArchivedCourses,
    uploadAndParse,
    parsing,
    parseResult,
    parseError,
    collecting,
    collectProgress,
    addCourse,
    removeCourse,
    toggleArchive,
    updateCourseAliases,
    collectAllCourses,
  } = useCurriculumStore()

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "专业核心课": true,
    "公共基础课": true,
  })
  const [showArchived, setShowArchived] = useState(false)
  const [showAddCourse, setShowAddCourse] = useState(false)
  const [newCourseName, setNewCourseName] = useState("")
  const [newCourseCategory, setNewCourseCategory] = useState("专业核心课")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const courseTree = getCourseTree()
  const archivedCourses = getArchivedCourses()
  const schoolName = getSchoolName()
  const totalMaterials = materials.length

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  const handleCourseClick = (courseName: string) => {
    if (activeCourse === courseName) {
      setActiveCourse(null)
    } else {
      setActiveCourse(courseName)
    }
  }

  const handleUploadCurriculum = async () => {
    const filePath = await window.api.selectCurriculumPDF()
    if (filePath) {
      await uploadAndParse(filePath)
    }
  }

  const handleAddCourse = () => {
    const name = newCourseName.trim()
    if (!name) return
    addCourse({ name, category: newCourseCategory, knowledgePoints: [] })
    setNewCourseName("")
    setShowAddCourse(false)
  }

  const handleDelete = (courseId: string) => {
    removeCourse(courseId)
    setConfirmDeleteId(null)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Nav items */}
      <nav className="p-2">
        <button
          onClick={() => { setActiveCourse(null); navigate("/") }}
          className={`btn btn-ghost btn-sm w-full justify-start gap-2 ${
            !activeCourse && location.pathname === "/" ? "active bg-primary/10 text-primary" : ""
          }`}
        >
          <span>📚</span>
          <span>全部资料</span>
          <span className="ml-auto text-xs text-base-content/40">{totalMaterials}</span>
        </button>

        <button
          onClick={handleUploadCurriculum}
          disabled={parsing}
          className="btn btn-ghost btn-sm w-full justify-start gap-2"
        >
          <span>📤</span>
          <span>{parsing ? "解析中..." : "上传培养方案"}</span>
        </button>

        {parseResult === "mock" && (
          <div className="mx-2 rounded-md bg-warning/10 px-2 py-1.5 text-xs text-warning">
            未配置 AI，已生成示例课程。在设置中配置后可自动解析。
          </div>
        )}
        {parseResult === "success" && (
          <div className="mx-2 rounded-md bg-success/10 px-2 py-1.5 text-xs text-success">
            培养方案解析成功！
          </div>
        )}
        {parseResult === "error" && (
          <div className="mx-2 rounded-md bg-error/10 px-2 py-1.5 text-xs text-error">
            解析失败: {parseError}
          </div>
        )}

        <button
          onClick={() => navigate("/collection")}
          className={`btn btn-ghost btn-sm w-full justify-start gap-2 ${
            location.pathname === "/collection" ? "active bg-primary/10 text-primary" : ""
          }`}
        >
          <span>⭐</span>
          <span>收藏</span>
        </button>
        <button
          onClick={() => navigate("/upload")}
          className={`btn btn-ghost btn-sm w-full justify-start gap-2 ${
            location.pathname === "/upload" ? "active bg-primary/10 text-primary" : ""
          }`}
        >
          <span>📤</span>
          <span>上传资料</span>
        </button>
        <button
          onClick={() => navigate("/settings")}
          className={`btn btn-ghost btn-sm w-full justify-start gap-2 ${
            location.pathname.startsWith("/settings") ? "active bg-primary/10 text-primary" : ""
          }`}
        >
          <span>⚙️</span>
          <span>设置</span>
        </button>
      </nav>

      <div className="divider my-1 px-3" />

      {/* Course tree */}
      <div className="flex-1 overflow-y-auto px-2">
        <h3 className="mb-2 px-2 text-xs font-semibold uppercase text-base-content/50">
          我的课程 {schoolName && `(${schoolName})`}
        </h3>
        {courseTree.map((group) => (
          <div key={group.category}>
            <button
              onClick={() => toggleCategory(group.category)}
              className="btn btn-ghost btn-sm w-full justify-start gap-2"
            >
              <span
                className={`text-xs transition-transform ${expandedCategories[group.category] ? "rotate-90" : ""}`}
              >
                ▶
              </span>
              <span>{group.icon}</span>
              <span className="text-sm">{group.category}</span>
              <span className="ml-auto text-xs text-base-content/40">{group.courses.length}</span>
            </button>
            {expandedCategories[group.category] && (
              <div className="ml-4">
                {group.courses.map((course) => (
                  <CourseItem
                    key={course.id}
                    course={course}
                    materials={materials}
                    activeCourse={activeCourse}
                    confirmDeleteId={confirmDeleteId}
                    searching={searchStatus === "searching" || searchStatus === "downloading"}
                    onCourseClick={handleCourseClick}
                    onToggleArchive={() => toggleArchive(course.id)}
                    onDelete={() => setConfirmDeleteId(course.id)}
                    onConfirmDelete={() => handleDelete(course.id)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                    onCollect={() => searchAndCollect(course.name)}
                    onValidate={() => validateCourseMaterials(course.name)}
                    onUpdateAliases={(aliases) => updateCourseAliases(course.id, aliases)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Add course inline form */}
        {showAddCourse ? (
          <div className="mx-2 mt-1 rounded-md border border-base-300 bg-base-200 p-2">
            <input
              type="text"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              placeholder="课程名称"
              className="input input-bordered input-xs w-full mb-1"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAddCourse()}
            />
            <select
              value={newCourseCategory}
              onChange={(e) => setNewCourseCategory(e.target.value)}
              className="select select-bordered select-xs w-full mb-1"
            >
              <option value="专业核心课">专业核心课</option>
              <option value="公共基础课">公共基础课</option>
              <option value="专业选修课">专业选修课</option>
              <option value="通识课">通识课</option>
              <option value="实践课">实践课</option>
            </select>
            <div className="flex gap-1">
              <button onClick={handleAddCourse} disabled={!newCourseName.trim()} className="btn btn-primary btn-xs flex-1">
                添加
              </button>
              <button onClick={() => { setShowAddCourse(false); setNewCourseName("") }} className="btn btn-ghost btn-xs flex-1">
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddCourse(true)}
            className="btn btn-ghost btn-sm w-full justify-start gap-2 text-base-content/40 mt-1"
          >
            <span>+</span>
            <span className="text-xs">添加课程</span>
          </button>
        )}

        {/* Archived courses */}
        {archivedCourses.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="btn btn-ghost btn-sm w-full justify-start gap-2 text-base-content/40"
            >
              <span className={`text-xs transition-transform ${showArchived ? "rotate-90" : ""}`}>▶</span>
              <span className="text-xs">已归档 ({archivedCourses.length})</span>
            </button>
            {showArchived && (
              <div className="ml-4">
                {archivedCourses.map((course) => (
                  <CourseItem
                    key={course.id}
                    course={course}
                    materials={materials}
                    activeCourse={activeCourse}
                    confirmDeleteId={confirmDeleteId}
                    searching={searchStatus === "searching" || searchStatus === "downloading"}
                    onCourseClick={handleCourseClick}
                    onToggleArchive={() => toggleArchive(course.id)}
                    onDelete={() => setConfirmDeleteId(course.id)}
                    onConfirmDelete={() => handleDelete(course.id)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                    onCollect={() => searchAndCollect(course.name)}
                    onValidate={() => validateCourseMaterials(course.name)}
                    onUpdateAliases={(aliases) => updateCourseAliases(course.id, aliases)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="border-t border-base-300 p-3 space-y-2">
        <button
          onClick={() => collectAllCourses()}
          disabled={collecting}
          className="btn btn-primary btn-sm w-full"
        >
          {collecting ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              {collectProgress || "搜集中..."}
            </>
          ) : (
            "🔍 一键搜集所有课程资料"
          )}
        </button>
      </div>
    </div>
  )
}

/* ==================== CourseItem ==================== */

function CourseItem({
  course,
  materials,
  activeCourse,
  confirmDeleteId,
  searching,
  onCourseClick,
  onToggleArchive,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onCollect,
  onValidate,
  onUpdateAliases,
}: {
  course: { id: string; name: string; archived: boolean; aliases?: string[] }
  materials: { courseName: string; downloadStatus: string }[]
  activeCourse: string | null
  confirmDeleteId: string | null
  searching: boolean
  onCourseClick: (name: string) => void
  onToggleArchive: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onCollect: () => void
  onValidate: () => void
  onUpdateAliases: (aliases: string[]) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [editingAliases, setEditingAliases] = useState(false)
  const [aliasInput, setAliasInput] = useState("")
  const courseMaterials = materials.filter((m) => m.courseName === course.name)
  const localCount = courseMaterials.filter((m) => m.downloadStatus === "done").length
  const aliases = course.aliases || []

  const addAlias = () => {
    const text = aliasInput.trim()
    if (!text || aliases.includes(text)) return
    onUpdateAliases([...aliases, text])
    setAliasInput("")
  }

  const removeAlias = (alias: string) => {
    onUpdateAliases(aliases.filter((a) => a !== alias))
  }

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {confirmDeleteId === course.id ? (
        <div className="flex items-center gap-1 rounded bg-error/10 px-2 py-1">
          <span className="text-xs text-error flex-1">删除「{course.name}」?</span>
          <button onClick={onConfirmDelete} className="btn btn-error btn-xs btn-outline px-1 text-xs">确认</button>
          <button onClick={onCancelDelete} className="btn btn-ghost btn-xs px-1 text-xs">取消</button>
        </div>
      ) : (
        <>
          <button
            onClick={() => onCourseClick(course.name)}
            className={`btn btn-ghost btn-sm w-full justify-start gap-2 pr-24 ${
              activeCourse === course.name
                ? "bg-primary/10 text-primary"
                : "text-base-content/70 hover:text-base-content"
            }`}
          >
            <span className="text-sm truncate">{course.name}</span>
            {aliases.length > 0 && (
              <span className="text-xs text-base-content/30 ml-auto">{aliases.length}别名</span>
            )}
          </button>
          <span className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {courseMaterials.length > 0 && (
              <span className="text-xs text-base-content/40">{courseMaterials.length}项</span>
            )}
            {localCount > 0 && (
              <span className="text-xs text-success">{localCount}↓</span>
            )}
            {hovered && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onCollect() }}
                  disabled={searching}
                  className="btn btn-xs px-1 opacity-60 hover:opacity-100 text-primary"
                  title="搜集资料"
                >
                  🔍
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingAliases(!editingAliases) }}
                  className={`btn btn-xs px-1 opacity-60 hover:opacity-100 ${editingAliases ? "text-secondary" : ""}`}
                  title="编辑别名/搜索关键词"
                >
                  🏷
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onValidate() }}
                  disabled={searching}
                  className="btn btn-xs px-1 opacity-60 hover:opacity-100 text-info"
                  title="检测链接有效性"
                >
                  ✓
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleArchive() }}
                  className="btn btn-xs px-1 opacity-60 hover:opacity-100"
                  title={course.archived ? "取消归档" : "归档"}
                >
                  {course.archived ? "📂" : "📁"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete() }}
                  className="btn btn-xs px-1 opacity-60 hover:opacity-100 text-error"
                  title="删除"
                >
                  ✕
                </button>
              </>
            )}
          </span>
        </>
      )}
      {editingAliases && (
        <div className="mx-2 mt-0.5 mb-1 rounded-md border border-base-300 bg-base-200 p-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {aliases.length === 0 && <span className="text-xs text-base-content/30">暂无别名</span>}
            {aliases.map((alias) => (
              <span key={alias} className="badge badge-sm badge-outline gap-0.5">
                {alias}
                <button onClick={() => removeAlias(alias)} className="text-error hover:text-error/80">x</button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              placeholder="如: 微积分、Calculus"
              className="input input-bordered input-xs flex-1"
              onKeyDown={(e) => e.key === "Enter" && addAlias()}
            />
            <button onClick={addAlias} disabled={!aliasInput.trim()} className="btn btn-primary btn-xs">+</button>
          </div>
        </div>
      )}
    </div>
  )
}
