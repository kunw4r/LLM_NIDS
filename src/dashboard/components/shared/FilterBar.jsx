import React from "react";

export default function FilterBar({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`px-3 py-2 rounded-md text-xs border transition-colors ${
              active
                ? "border-blue-600 bg-blue-50 text-blue-600 font-medium"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
