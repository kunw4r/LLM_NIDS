import React from "react";

export default function SubNav({ tabs, activeTab, onTabChange }) {
  return (
    <nav className="bg-gray-50 border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 flex overflow-x-auto">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={
              "px-3 sm:px-4 py-2.5 text-xs transition-colors whitespace-nowrap flex-shrink-0 " +
              (activeTab === id
                ? "font-semibold text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent")
            }
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
