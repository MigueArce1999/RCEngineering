"use client";

import * as RSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/format";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * Selector desplegable de RC: disparador sólido con chevron alineado y lista flotante animada.
 * Accesible por teclado (Radix Select) y consistente en todos los navegadores.
 */
export function Select({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  /** Etiqueta accesible (si no hay <label> visible asociada) */
  label?: string;
  size?: "sm" | "md";
  className?: string;
  placeholder?: string;
}) {
  return (
    <RSelect.Root value={value} onValueChange={onChange}>
      <RSelect.Trigger
        aria-label={label}
        className={cn(
          "group flex w-full items-center justify-between gap-2 rounded-[12px] border border-line bg-white text-left text-ink outline-none",
          "transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-line-strong",
          "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/15 data-[state=open]:border-accent data-[state=open]:ring-2 data-[state=open]:ring-accent/15",
          size === "sm" ? "h-9 pr-2.5 pl-3 text-[13px]" : "h-10 pr-3 pl-3.5 text-[14px]",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <RSelect.Value placeholder={placeholder} />
        </span>
        <RSelect.Icon asChild>
          <ChevronDown size={16} className="shrink-0 text-ink-3 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-data-[state=open]:rotate-180" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className="anim-pop glass-float z-[90] max-h-[min(320px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[14px]"
        >
          <RSelect.Viewport className="scroll-thin p-1.5">
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="relative flex cursor-pointer items-center gap-2 rounded-[10px] py-2 pr-8 pl-3 text-[13px] text-ink outline-none select-none focus-visible:outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[highlighted]:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <RSelect.ItemText>{o.label}</RSelect.ItemText>
                  {o.hint && <span className="block text-[11px] text-ink-3">{o.hint}</span>}
                </span>
                <RSelect.ItemIndicator className="absolute right-2.5">
                  <Check size={15} className="text-accent" />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
