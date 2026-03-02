import React from "react";

const STATUS_STYLES = {
  complete: "bg-green-50 text-green-700 border-green-200",
  "in progress": "bg-blue-50 text-blue-700 border-blue-200",
  planned: "bg-gray-50 text-gray-500 border-gray-200",
};

export default function StatusBadge({ status }) {
  const key = (status || "").toLowerCase();
  const colorClasses = STATUS_STYLES[key] || STATUS_STYLES.planned;

  return (
    <span
      className={`px-2.5 py-0.5 rounded text-[11px] font-medium border inline-block ${colorClasses}`}
    >
      {status}
    </span>
  );
}
