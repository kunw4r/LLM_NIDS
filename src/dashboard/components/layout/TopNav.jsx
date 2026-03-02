import React from "react";

export default function TopNav({ tabs, activeTab, onTabChange }) {
  return (
    <nav className="max-w-6xl mx-auto px-8 flex border-b border-gray-200">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={
            "px-5 py-3 text-sm transition-colors whitespace-nowrap " +
            (activeTab === id
              ? "font-semibold text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent")
          }
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
