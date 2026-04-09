import { resolve } from "path"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { copyFileSync, mkdirSync, readdirSync } from "fs"
import type { Plugin } from "vite"

function copyPdfjsAssets(): Plugin {
  return {
    name: "copy-pdfjs-assets",
    writeBundle() {
      const cmapSrc = resolve("node_modules/pdfjs-dist/cmaps")
      const fontSrc = resolve("node_modules/pdfjs-dist/standard_fonts")
      const cmapDest = resolve("out/renderer/cmaps")
      const fontDest = resolve("out/renderer/standard_fonts")

      mkdirSync(cmapDest, { recursive: true })
      mkdirSync(fontDest, { recursive: true })

      for (const f of readdirSync(cmapSrc)) {
        if (f.endsWith(".bcmap")) copyFileSync(resolve(cmapSrc, f), resolve(cmapDest, f))
      }
      for (const f of readdirSync(fontSrc)) {
        copyFileSync(resolve(fontSrc, f), resolve(fontDest, f))
      }
    },
    configureServer(server) {
      // Serve cmaps and standard_fonts from node_modules during dev
      const cmapSrc = resolve("node_modules/pdfjs-dist/cmaps")
      const fontSrc = resolve("node_modules/pdfjs-dist/standard_fonts")

      server.middlewares.use("/cmaps", (req, res, next) => {
        const file = req.url?.replace(/^\//, "") || ""
        try {
          const data = require("fs").readFileSync(resolve(cmapSrc, file))
          res.setHeader("Content-Type", "application/octet-stream")
          res.end(data)
        } catch { next() }
      })
      server.middlewares.use("/standard_fonts", (req, res, next) => {
        const file = req.url?.replace(/^\//, "") || ""
        try {
          const data = require("fs").readFileSync(resolve(fontSrc, file))
          res.setHeader("Content-Type", "application/octet-stream")
          res.end(data)
        } catch { next() }
      })
    },
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: resolve("src/renderer"),
    build: {
      rollupOptions: {
        input: resolve("src/renderer/index.html"),
      },
    },
    resolve: {
      alias: {
        "@": resolve("src/renderer"),
      },
    },
    plugins: [react(), tailwindcss(), copyPdfjsAssets()],
  },
})
