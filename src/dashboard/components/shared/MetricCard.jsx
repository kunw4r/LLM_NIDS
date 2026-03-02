import React from "react";

export default function MetricCard({ value, label, sub }) {
  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white">
      <div className="text-4xl font-bold tracking-tight text-gray-900">
        {value}
      </div>
      <div className="text-sm font-semibold text-gray-900 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
