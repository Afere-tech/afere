import * as React from "react";
import { cn } from "@/components/ui/utils";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export function Toggle({ checked, onChange, className }: ToggleProps) {
  return (
    <button
      aria-checked={checked}
      className={cn(
        "relative inline-flex h-[26px] w-[48px] flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "bg-primary" : "bg-slate-300 dark:bg-slate-700",
        className,
      )}
      role="switch"
      type="button"
      onClick={() => onChange(!checked)}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-0",
        )}
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.18)" }}
      />
    </button>
  );
}
