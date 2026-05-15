import { cn } from "@/lib/utils";

interface PresenceDotProps {
  availability?: MSPresence["availability"];
  className?: string;
}

export function PresenceDot({ availability, className }: PresenceDotProps) {
  if (!availability || availability === "Offline" || availability === "PresenceUnknown") return null;

  if (availability === "Away" || availability === "BeRightBack") {
    return (
      <span
        aria-label="Away"
        className={cn(
          "absolute bottom-[-2px] right-[-2px] h-[10px] w-[10px] rounded-full border-2 border-[var(--sidebar-bg)] bg-[#e8a838]",
          className
        )}
      />
    );
  }

  if (availability === "Busy" || availability === "DoNotDisturb") {
    return (
      <span
        aria-label="Busy"
        className={cn(
          "absolute bottom-[-2px] right-[-2px] flex h-[10px] w-[10px] items-center justify-center rounded-full border-2 border-[var(--sidebar-bg)] bg-[#e01e5a]",
          className
        )}
      >
        <span className="h-[2px] w-[4px] rounded bg-white" />
      </span>
    );
  }

  return (
    <span
      aria-label="Available"
      className={cn(
        "absolute bottom-[-2px] right-[-2px] h-[10px] w-[10px] rounded-full border-2 border-[var(--sidebar-bg)] bg-[#2bac76]",
        className
      )}
    />
  );
}
