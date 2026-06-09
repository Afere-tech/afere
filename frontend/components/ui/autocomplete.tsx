"use client";

import { Check, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";

export type SBNProcedureOption = {
  id: string;
  name: string;
};

type AutocompleteProps = {
  label: string;
  options: SBNProcedureOption[];
  value: SBNProcedureOption[];
  onChange: (values: SBNProcedureOption[]) => void;
  onSearch: (query: string) => void;
  initialQuery?: string;
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[çÇ]/g, "c")
    .trim()
    .toLowerCase();
}

function scoreMatch(query: string, text: string): number {
  const norm = normalizeSearch(text);
  const q = normalizeSearch(query);
  if (!q) return 0;
  if (norm.startsWith(q)) return 100;
  const idx = norm.indexOf(q);
  if (idx !== -1) return 50 - idx * 0.1;
  const qWords = q.split(/\s+/);
  const tWords = norm.split(/\s+/);
  const matched = qWords.filter((qw) => tWords.some((tw) => tw.includes(qw))).length;
  return matched > 0 ? (matched / qWords.length) * 30 : 0;
}

export function Autocomplete({ label, options, value, onChange, onSearch, initialQuery = "" }: AutocompleteProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(initialQuery.length >= 2);

  const sorted = useMemo(() => {
    if (!query.trim()) return options;
    return options
      .map((o) => ({ o, score: scoreMatch(query, o.name) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ o }) => o);
  }, [options, query]);

  const handleSearch = (text: string) => {
    setQuery(text);
    setIsOpen(true);
    onSearch(text);
  };

  const handleSelect = (option: SBNProcedureOption) => {
    const isSelected = value.some((v) => v.id === option.id);
    if (isSelected) {
      onChange(value.filter((v) => v.id !== option.id));
    } else {
      onChange([...value, option]);
    }
    // Clear input so the physician can search for the next procedure
    setQuery("");
    onSearch("");
    // Keep isOpen = true so the list stays visible for the next selection
  };

  const removeChip = (id: string) => {
    onChange(value.filter((v) => v.id !== id));
  };

  return (
    <div className="space-y-2">
      <label
        className="block text-xs font-semibold uppercase tracking-[0.4px] text-slate-500 dark:text-slate-400"
        htmlFor="procedure-search"
      >
        {label}
      </label>

      {/* Selected procedure chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/30 px-3 py-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300"
            >
              {v.name}
              <button
                type="button"
                onClick={() => removeChip(v.id)}
                aria-label={`Remover ${v.name}`}
                className="text-teal-400 hover:text-teal-700 dark:text-teal-500 dark:hover:text-teal-200 transition-colors"
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          size={18}
        />
        <Input
          className="h-[54px] pl-[46px] text-[15px]"
          id="procedure-search"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={
            value.length > 0
              ? "Adicionar outro procedimento SBN..."
              : "Digite o nome do procedimento SBN..."
          }
        />
      </div>

      {isOpen && sorted.length > 0 && (
        <div
          className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.10)", maxHeight: "288px", overflowY: "auto" }}
        >
          {sorted.map((option) => {
            const selected = value.some((v) => v.id === option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option)}
                className={cn(
                  "block w-full border-b border-slate-50 dark:border-slate-800 px-4 py-3.5 text-left text-sm last:border-b-0 transition-colors",
                  selected
                    ? "bg-teal-50 dark:bg-teal-900/30"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-950 dark:text-slate-50 leading-snug">
                    {option.name}
                  </span>
                  {selected ? (
                    <span
                      className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, hsl(186,72%,28%), hsl(186,72%,22%))" }}
                    >
                      <Check size={10} strokeWidth={3} aria-hidden="true" />
                      Selecionado
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
