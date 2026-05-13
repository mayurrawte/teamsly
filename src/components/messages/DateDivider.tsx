import { formatDateDivider } from "@/lib/utils/dates";

interface Props {
  date: string | Date;
}

export function DateDivider({ date }: Props) {
  return (
    <div role="separator" className="flex items-center px-4 my-3 select-none">
      <div className="h-px flex-1 bg-[var(--border)]" />
      <div
        className="mx-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-0.5 text-[11px] font-bold text-[var(--text-muted)]"
      >
        {formatDateDivider(date)}
      </div>
      <div className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}
