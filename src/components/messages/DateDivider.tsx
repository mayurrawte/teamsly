import { formatDateDivider } from "@/lib/utils/dates";

interface Props {
  date: string | Date;
}

export function DateDivider({ date }: Props) {
  return (
    <div role="separator" className="flex items-center px-4 my-3 select-none">
      <div className="h-px flex-1 bg-[var(--border)]" />
      <div
        className="mx-3 leading-tight text-[11px] font-semibold text-[var(--text-muted)]"
      >
        {formatDateDivider(date)}
      </div>
      <div className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}
