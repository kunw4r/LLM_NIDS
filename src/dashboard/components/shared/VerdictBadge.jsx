import React from "react";

const VERDICT_STYLES = {
  MALICIOUS: "bg-red-100 text-red-700",
  SUSPICIOUS: "bg-amber-100 text-amber-700",
  BENIGN: "bg-green-100 text-green-700",
  FILTERED: "bg-slate-100 text-slate-600",
};

export default function VerdictBadge({ verdict, filtered }) {
  const key = filtered ? "FILTERED" : (verdict || "").toUpperCase();
  const colorClasses = VERDICT_STYLES[key] || "bg-gray-100 text-gray-600";

  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-semibold inline-block ${colorClasses}`}
    >
      {filtered ? "FILTERED" : verdict}
    </span>
  );
}
