import React from "react";
import TopNav from "./TopNav";
import SubNav from "./SubNav";
import LiveBanner from "./LiveBanner";
import { EXPERIMENTS } from "../../data/experiments";

export default function Shell({
  topTab,
  setTopTab,
  topTabs,
  subTab,
  setSubTab,
  subTabs,
  liveStatus,
  liveSummary,
  livePanelOpen,
  setLivePanelOpen,
  newResultNotif,
  lastFetched,
  children,
}) {
  const experimentCount = Array.isArray(EXPERIMENTS) ? EXPERIMENTS.length : 0;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* Notification toast */}
      {newResultNotif && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium">New experiment results available</span>
        </div>
      )}

      {/* Live Banner */}
      {liveStatus && (
        <LiveBanner
          liveStatus={liveStatus}
          liveSummary={liveSummary}
          livePanelOpen={livePanelOpen}
          setLivePanelOpen={setLivePanelOpen}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 flex-shrink-0">
              <path d="M16 2L4 8v8c0 7.2 5.12 13.92 12 16 6.88-2.08 12-8.8 12-16V8L16 2z" fill="#0f172a"/>
              <path d="M16 5L7 9.5v7c0 6 4.2 11.6 9 13.5 4.8-1.9 9-7.5 9-13.5v-7L16 5z" fill="#1e293b"/>
              <circle cx="11" cy="13" r="2" fill="#3b82f6"/><circle cx="21" cy="13" r="2" fill="#8b5cf6"/>
              <circle cx="11" cy="19.5" r="2" fill="#f59e0b"/><circle cx="21" cy="19.5" r="2" fill="#ec4899"/>
              <circle cx="16" cy="16.2" r="1.8" fill="#ef4444"/>
              <circle cx="16" cy="24" r="2.2" fill="#10b981"/>
              <line x1="11" y1="13" x2="16" y2="16.2" stroke="#3b82f6" strokeWidth="0.7" opacity="0.6"/>
              <line x1="21" y1="13" x2="16" y2="16.2" stroke="#8b5cf6" strokeWidth="0.7" opacity="0.6"/>
              <line x1="11" y1="19.5" x2="16" y2="16.2" stroke="#f59e0b" strokeWidth="0.7" opacity="0.6"/>
              <line x1="21" y1="19.5" x2="16" y2="16.2" stroke="#ec4899" strokeWidth="0.7" opacity="0.6"/>
              <line x1="16" y1="16.2" x2="16" y2="24" stroke="#ef4444" strokeWidth="0.7" opacity="0.6"/>
              <circle cx="16" cy="24" r="1" fill="#34d399"/>
            </svg>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">AMATAS</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Advanced Multi-Agent Threat Analysis System
                <span className="ml-2 text-gray-400">
                  {experimentCount} experiment{experimentCount !== 1 ? "s" : ""}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Top Navigation */}
        <TopNav tabs={topTabs} activeTab={topTab} onTabChange={setTopTab} />
      </header>

      {/* Sub Navigation */}
      {subTabs && subTabs.length > 0 && (
        <SubNav tabs={subTabs} activeTab={subTab} onTabChange={setSubTab} />
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-8 py-8 flex-1 w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">AMATAS — University Thesis 2026</p>
          {lastFetched && (
            <p className="text-xs text-gray-400">
              Last updated: {new Date(lastFetched).toLocaleTimeString()}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
