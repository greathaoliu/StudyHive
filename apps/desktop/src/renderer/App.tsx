import { BrowserRouter, Routes, Route } from "react-router"
import { MainLayout } from "./layouts/MainLayout"
import { DiscoverPage } from "./pages/discover"
import { SearchPage } from "./pages/search"
import { MaterialDetailPage } from "./pages/material/[id]"
import { SettingsLayout } from "./pages/settings/layout"
import { GeneralSettings } from "./pages/settings/general"
import { AISettings } from "./pages/settings/ai"
import { SourcesSettings } from "./pages/settings/sources"
import { DevLogPage } from "./pages/settings/devlog"
import { UploadPage } from "./pages/upload"
import { CollectionPage } from "./pages/collection"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DiscoverPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/material/:id" element={<MaterialDetailPage />} />
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<GeneralSettings />} />
            <Route path="ai" element={<AISettings />} />
            <Route path="sources" element={<SourcesSettings />} />
            <Route path="devlog" element={<DevLogPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
