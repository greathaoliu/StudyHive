import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App"
import { useMaterialStore } from "./store/material"
import { useCurriculumStore } from "./store/curriculum"
import "./i18n"
import "./styles/global.css"

// 启动时加载持久化数据
useCurriculumStore.getState().initPrograms()
useMaterialStore.getState().initLocalFiles()

// 启动时应用已保存的主题
;(() => {
  const saved = localStorage.getItem("studyhive-theme") || "system"
  const theme = saved === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : saved
  document.documentElement.setAttribute("data-theme", theme)
})()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
