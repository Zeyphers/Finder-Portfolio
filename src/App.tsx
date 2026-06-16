import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Portfolio from "./Portfolio";
import { AdminPanel } from "./AdminPanel";
import { DataProvider } from "./DataContext";

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Portfolio />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={<Portfolio />} />
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}
