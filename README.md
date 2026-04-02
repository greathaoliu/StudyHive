# StudyHive

AI-powered course material aggregator for university students. Automatically search, download, and manage learning resources across multiple platforms.

## Features

- **Curriculum Parsing** - Upload your university curriculum PDF; AI extracts courses, knowledge points, and auto-generates aliases
- **Multi-Source Search** - AI searches across csdiy.wiki, hackway.org, MOOCs (Coursera, Bilibili, xuetangx), and more
- **GitHub Repo Scanning** - Scans GitHub course repos (e.g. zju-icicles) for PDFs, with subfolder-level source links
- **Course Aliases** - Add custom search keywords per course (e.g. "Calculus" for "数学分析") to broaden search results
- **Embedded Video Player** - Bilibili and YouTube videos play inline; other platforms open in browser
- **AI Chat Assistant** - Streaming chat with auto-search triggers to find and supplement materials
- **Material Management** - Favorites, archiving, bulk download, hallucination cleanup, URL validation
- **Search Modes** - Focused (only enabled sources) or Divergent (AI searches broadly)
- **Developer Log** - Full transparency into the AI search pipeline with categorized logs

## Tech Stack

- **Electron** + **React 19** + **TypeScript**
- **Zustand** for state management
- **Tailwind CSS 4** + **DaisyUI 5** for UI
- **electron-vite** for build tooling
- **pdfjs-dist** for PDF text extraction
- **Turborepo** monorepo structure

## Getting Started

```bash
# Install dependencies
pnpm install

# Run in development
pnpm dev:desktop

# Build for production
pnpm build:desktop
```

## Configuration

1. Go to **Settings > AI Configuration** and enter your API key (supports OpenAI-compatible and Anthropic APIs)
2. Go to **Settings > Sources** to enable/disable material sources and add GitHub repos
3. Upload your curriculum PDF in the sidebar to extract courses
4. Click the search icon on any course to start collecting materials

## Project Structure

```
apps/
  desktop/              # Electron desktop app
    src/
      main/             # Electron main process (IPC handlers, GitHub scanner, AI calls)
      preload/          # Preload bridge
      renderer/         # React frontend
        modules/        # UI components (sidebar, material list, content panel, chat)
        pages/          # Route pages (settings, collection, search)
        store/          # Zustand stores (curriculum, material, chat, devlog)
packages/
  types/                # Shared TypeScript types
```

## License

MIT
