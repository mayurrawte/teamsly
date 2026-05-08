import { formatDateDivider } from "@/lib/utils/dates";

interface Props {
  date: string | Date;
}

export function DateDivider({ date }: Props) {
  return (
    <div role="separator" className="flex items-center px-4 my-4 select-none">
      <div className="h-px flex-1 bg-[#3f4144]" />
      <div
        className="mx-3 rounded-full border border-[#3f4144] bg-[#222529] px-3 py-1 text-[13px] font-bold text-[#6c6f75]"
      >
        {formatDateDivider(date)}
      </div>
      <div className="h-px flex-1 bg-[#3f4144]" />
    </div>
  );
}
