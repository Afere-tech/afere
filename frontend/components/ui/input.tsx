import * as React from "react";
import { cn } from "@/components/ui/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-950 outline-none transition focus:border-primary focus:bg-white focus:ring-[3px] focus:ring-primary/15",
        "shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]",
        "placeholder:text-slate-400",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
