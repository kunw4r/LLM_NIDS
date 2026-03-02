import React from "react";

export default function HBarChart({ items, thresholdLine }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-44 text-right text-xs text-gray-600 shrink-0">
            {item.label}
          </div>
          <div className="flex-1 h-[22px] bg-gray-100 rounded overflow-hidden relative">
            <div
              className="h-full rounded flex items-center"
              style={{
                width: `${Math.max(item.value, 0)}%`,
                backgroundColor: item.color || "#3b82f6",
              }}
            >
              {item.value >= 15 && (
                <span className="text-[10px] font-medium text-white px-2 truncate">
                  {item.value}
                  {item.suffix || "%"}
                </span>
              )}
            </div>
            {item.value < 15 && (
              <span className="absolute left-[calc(var(--val))] top-0 h-full flex items-center pl-1 text-[10px] text-gray-500"
                style={{ "--val": `${Math.max(item.value, 0)}%`, left: `${Math.max(item.value, 0) + 1}%` }}
              >
                {item.value}
                {item.suffix || "%"}
              </span>
            )}
            {thresholdLine != null && (
              <div
                className="absolute top-0 h-full border-l-2 border-dashed border-gray-400"
                style={{ left: `${thresholdLine}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
