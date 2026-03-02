import React from "react";

export default function ConfusionMatrix({ cm }) {
  const { tp, fp, tn, fn } = cm;

  const cell = (value, isCorrect) => {
    const hasError = !isCorrect && value > 0;
    const bg = isCorrect
      ? "bg-green-50 text-green-800"
      : hasError
      ? "bg-red-50 text-red-800"
      : "bg-gray-50 text-gray-600";

    return (
      <div className={`flex items-center justify-center rounded p-3 ${bg}`}>
        <span className="text-lg font-bold">{value}</span>
      </div>
    );
  };

  return (
    <div className="inline-block">
      {/* Column headers */}
      <div className="grid grid-cols-[auto_1fr_1fr] gap-1 text-center">
        <div />
        <div className="text-[10px] uppercase text-gray-400 font-medium pb-1">
          Pred Positive
        </div>
        <div className="text-[10px] uppercase text-gray-400 font-medium pb-1">
          Pred Negative
        </div>

        {/* Actual Positive row */}
        <div className="text-[10px] uppercase text-gray-400 font-medium flex items-center pr-2 justify-end">
          Actual Positive
        </div>
        {cell(tp, true)}
        {cell(fn, false)}

        {/* Actual Negative row */}
        <div className="text-[10px] uppercase text-gray-400 font-medium flex items-center pr-2 justify-end">
          Actual Negative
        </div>
        {cell(fp, false)}
        {cell(tn, true)}
      </div>
    </div>
  );
}
