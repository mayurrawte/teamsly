const ROWS = [
  { lines: [60, 85] },
  { lines: [75, 50] },
  { lines: [85, 60, 40] },
  { lines: [55] },
  { lines: [70, 90, 45] },
  { lines: [80, 55] },
  { lines: [65, 85] },
  { lines: [50, 70, 35] },
] as const;

export function LoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading messages"
      aria-busy="true"
      className="flex flex-1 flex-col overflow-hidden py-2"
    >
      {ROWS.map((row, i) => (
        <div key={i} className="flex gap-3 px-4 pt-2 pb-[2px]">
          <div className="skeleton h-9 w-9 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="skeleton h-[14px] w-20" />
              <div className="skeleton h-[10px] w-12 opacity-60" />
            </div>
            <div className="mt-2 flex flex-col gap-[6px]">
              {row.lines.map((width, j) => (
                <div key={j} className="skeleton h-3" style={{ width: `${width}%` }} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
