export const pct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : "—";
export const pctInt = (v) => v != null ? `${Math.round(v * 100)}%` : "—";
export const dollar = (v) => v != null ? `$${v.toFixed(2)}` : "—";

export const verdictColor = (v) => {
  if (!v) return "#94a3b8";
  const u = v.toUpperCase();
  if (u === "MALICIOUS") return "#dc2626";
  if (u === "SUSPICIOUS") return "#d97706";
  if (u === "BENIGN") return "#16a34a";
  return "#94a3b8";
};

export const verdictBg = (v) => {
  if (!v) return "#f8fafc";
  const u = v.toUpperCase();
  if (u === "MALICIOUS") return "#fef2f2";
  if (u === "SUSPICIOUS") return "#fffbeb";
  if (u === "BENIGN") return "#f0fdf4";
  return "#f8fafc";
};

export const correctColor = (correct) => correct ? "#16a34a" : "#dc2626";

export const isCorrect = (f) => {
  const isAttack = f.label_actual === 1;
  const predictedAttack = f.verdict?.toUpperCase() !== "BENIGN";
  return (isAttack && predictedAttack) || (!isAttack && !predictedAttack);
};
