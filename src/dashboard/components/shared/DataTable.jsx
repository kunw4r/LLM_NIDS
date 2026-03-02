import React from "react";

export default function DataTable({
  columns,
  rows,
  onRowClick,
  sortKey,
  sortDir,
  onSort,
}) {
  const handleHeaderClick = (col) => {
    if (!onSort) return;
    onSort(col.key);
  };

  return (
    <div className="overflow-auto border border-gray-200 rounded-lg">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-xs uppercase text-gray-500 px-4 py-3 sticky top-0 bg-gray-50 border-b border-gray-200 whitespace-nowrap select-none ${
                  col.align === "right" ? "text-right" : "text-left"
                } ${onSort ? "cursor-pointer hover:text-gray-700" : ""}`}
                onClick={() => handleHeaderClick(col)}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`text-sm border-b border-gray-100 hover:bg-gray-50 ${
                onRowClick ? "cursor-pointer" : ""
              }`}
              onClick={() => onRowClick && onRowClick(row, i)}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
