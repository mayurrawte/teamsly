// Six skeleton rows that mirror the real message layout:
// [Avatar 36×36]  [Name line ~200px]
//                 [Text line ~140px]
// Used by MessageFeed on first load (loading=true, messages.length===0).

const ROWS = [
  { line1: "55%", line2: "38%" },
  { line1: "70%", line2: "50%" },
  { line1: "48%", line2: "32%" },
  { line1: "62%", line2: "44%" },
  { line1: "75%", line2: "55%" },
  { line1: "52%", line2: "36%" },
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
        <div key={i} className="flex gap-3 px-4 py-2">
          {/* Avatar blob */}
          <div className="skeleton h-9 w-9 flex-shrink-0 rounded-full" />
          {/* Text blobs */}
          <div className="flex flex-col justify-center gap-[8px]">
            <div className="skeleton h-[14px] rounded-full" style={{ width: row.line1 }} />
            <div className="skeleton h-[12px] rounded-full" style={{ width: row.line2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
