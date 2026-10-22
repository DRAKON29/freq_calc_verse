"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NumberInputProps
  extends Omit<
    React.ComponentProps<"input">,
    "value" | "onChange" | "type" | "step"
  > {
  value: number;
  onValueChange: (value: number) => void;
  /** Вызывается на blur/Enter после финального значения (сортировка и т.п.) */
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
}

function toDraft(value: number): string {
  return Number.isFinite(value) ? String(value).replace(".", ",") : "";
}

export function NumberInput({
  value,
  onValueChange,
  onCommit,
  min = -Infinity,
  max = Infinity,
  className,
  ...props
}: NumberInputProps) {
  const [draft, setDraft] = React.useState(() => toDraft(value));
  const focusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!focusedRef.current) setDraft(toDraft(value));
  }, [value]);

  const parse = (raw: string): number | null => {
    const n = Number.parseFloat(raw.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={draft}
      className={cn("text-right tabular-nums", className)}
      onFocus={(e) => {
        focusedRef.current = true;
        e.target.select();
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const parsed = parse(raw);
        if (parsed !== null) onValueChange(parsed);
      }}
      onBlur={() => {
        focusedRef.current = false;
        const parsed = parse(draft);
        const next = parsed === null ? value : clamp(parsed);
        onValueChange(next);
        onCommit?.(next);
        setDraft(toDraft(next));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
