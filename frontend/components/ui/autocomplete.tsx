"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export type ProcedureOption = {
  procedure_name: string;
  cbhpm_code: string;
  description: string;
  porte: string;
};

type AutocompleteProps = {
  label: string;
  options: ProcedureOption[];
  value: ProcedureOption | null;
  onChange: (value: ProcedureOption) => void;
  onSearch?: (query: string) => void;
};

export function Autocomplete({ label, options, value, onChange, onSearch }: AutocompleteProps) {
  const [query, setQuery] = useState(value?.procedure_name ?? "");

  const matches = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (normalized.length < 2) {
      return options;
    }

    return options.filter((option) =>
      normalizeSearch(`${option.procedure_name} ${option.cbhpm_code} ${option.description}`).includes(normalized),
    );
  }, [options, query]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor="procedure-search">
        {label}
      </label>
      <div className="relative">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input
          className="pl-10"
          id="procedure-search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            onSearch?.(event.target.value);
          }}
        />
      </div>
      <div className="max-h-72 overflow-auto rounded-md border border-border bg-white">
        {matches.map((option) => (
          <button
            className="block w-full border-b border-border px-4 py-3 text-left text-sm last:border-b-0 hover:bg-muted"
            key={option.cbhpm_code}
            type="button"
            onClick={() => {
              onChange(option);
              setQuery(option.procedure_name);
            }}
          >
            <span className="block font-medium">{option.procedure_name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {option.cbhpm_code} | {option.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
