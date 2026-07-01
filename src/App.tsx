import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Portfolio from "./Portfolio";
import { DataProvider } from "./DataContext";

// Admin panel is only needed at /admin. Lazy-load it so its code (and the heavy
// rich-text editor it pulls in) is split out of the bundle every visitor downloads.
const AdminPanel = lazy(() =>
  import("./AdminPanel").then((m) => ({ default: m.AdminPanel }))
);

export default function App() {
  // Application entry point wrapper
  return (
    <DataProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Portfolio />} />
            <Route path="/admin" element={<AdminPanel />} />
            {/* Shareable deep links: /<folder> and /<folder>/<image>.
                Static routes (e.g. /admin) still take precedence over these. */}
            <Route path="/:folderSlug" element={<Portfolio />} />
            <Route path="/:folderSlug/:imageSeg" element={<Portfolio />} />
            <Route path="*" element={<Portfolio />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </DataProvider>
  );
}
