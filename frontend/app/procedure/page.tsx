"use client";

import {
  Activity,
  Calculator,
  Check,
  ChevronDown,
  HeartPulse,
  Info,
  Moon,
  Share2,
  Stethoscope,
  Sun,
  X,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Autocomplete, type SBNProcedureOption } from "@/components/ui/autocomplete";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/components/ui/utils";

// ─── Domain types ────────────────────────────────────────────────────────────

type CBHPMCode = { code: string; description: string; porte: string };
type ProcedureDetail = { id: string; name: string; cbhpm_codes: CBHPMCode[] };
type CodeBreakdown = { cbhpm_code: string; description: string; porte: string; base_value: number };
type CalculationResult = {
  code_breakdown: CodeBreakdown[];
  total_base: number;
  lead_surgeon_fee: number;
  auxiliaries_fee: number;
  anesthesiologist_fee: number;
  final_total: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PORTES = [
  "1A","1B","1C","2A","2B","2C","3A","3B","3C","4A","4B","4C",
  "5A","5B","5C","6A","6B","6C","7A","7B","7C","8A","8B","8C",
  "9A","9B","9C","10A","10B","10C","11A","11B","11C","12A","12B","12C",
  "13A","13B","13C","14A","14B","14C",
];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// ─── Workflow content ─────────────────────────────────────────────────────────

function ProcedureContent({ initialQuery, initialSbnId }: { initialQuery: string; initialSbnId: string }) {
  const { isDark, toggle } = useTheme();

  const [searchOptions, setSearchOptions] = useState<SBNProcedureOption[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  // Multi-select: array of selected procedures + a cache of their details
  const [selectedProcedures, setSelectedProcedures] = useState<SBNProcedureOption[]>([]);
  const [detailsMap, setDetailsMap] = useState<Record<string, ProcedureDetail>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const [selectedCodes, setSelectedCodes] = useState<Record<string, string>>({});
  const [auxiliariesCount, setAuxiliariesCount] = useState(1);
  const [requiresAnesthesia, setRequiresAnesthesia] = useState(true);

  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [copied, setCopied] = useState(false);

  const calcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived: merged CBHPM codes from all selected procedures (deduplicated by code)
  const allCbhpmCodes = useMemo(() => {
    const seen = new Set<string>();
    const codes: CBHPMCode[] = [];
    for (const proc of selectedProcedures) {
      const detail = detailsMap[proc.id];
      if (!detail) continue;
      for (const c of detail.cbhpm_codes) {
        if (!seen.has(c.code)) {
          seen.add(c.code);
          codes.push(c);
        }
      }
    }
    return codes;
  }, [selectedProcedures, detailsMap]);

  const loadingDetail = loadingIds.size > 0;

  // ── Search ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/procedures/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) setSearchOptions(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Direct procedure load via ?sbn=<id> (from home page selection) ─────────

  useEffect(() => {
    if (!initialSbnId) return;
    setLoadingIds(new Set([initialSbnId]));
    fetch(`/api/procedures/${initialSbnId}`)
      .then((r) => r.json())
      .then((detail: ProcedureDetail) => {
        const proc: SBNProcedureOption = { id: detail.id, name: detail.name };
        setSelectedProcedures([proc]);
        setDetailsMap({ [detail.id]: detail });
        const initial: Record<string, string> = {};
        for (const c of detail.cbhpm_codes) initial[c.code] = c.porte;
        setSelectedCodes(initial);
      })
      .finally(() => setLoadingIds(new Set()));
  // Intentionally runs only on mount — initialSbnId never changes after mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Multi-procedure selection handler ─────────────────────────────────────

  const handleProceduresChange = useCallback(
    (procedures: SBNProcedureOption[]) => {
      const prevIds = new Set(selectedProcedures.map((p) => p.id));
      const removedProcs = selectedProcedures.filter((p) => !procedures.find((np) => np.id === p.id));

      setSelectedProcedures(procedures);
      setCalculation(null);

      // Remove codes that belonged only to deselected procedures
      if (removedProcs.length > 0) {
        const remainingCodeSet = new Set<string>();
        for (const proc of procedures) {
          const detail = detailsMap[proc.id];
          if (detail) for (const c of detail.cbhpm_codes) remainingCodeSet.add(c.code);
        }
        const codesToRemove = new Set<string>();
        for (const proc of removedProcs) {
          const detail = detailsMap[proc.id];
          if (detail) {
            for (const c of detail.cbhpm_codes) {
              if (!remainingCodeSet.has(c.code)) codesToRemove.add(c.code);
            }
          }
        }
        if (codesToRemove.size > 0) {
          setSelectedCodes((prev) => {
            const next = { ...prev };
            for (const code of codesToRemove) delete next[code];
            return next;
          });
        }
      }

      // Fetch details for newly added procedures
      for (const proc of procedures) {
        if (prevIds.has(proc.id) || detailsMap[proc.id]) continue;
        setLoadingIds((prev) => new Set([...prev, proc.id]));
        fetch(`/api/procedures/${proc.id}`)
          .then((r) => r.json())
          .then((detail: ProcedureDetail) => {
            setDetailsMap((prev) => ({ ...prev, [proc.id]: detail }));
            setSelectedCodes((prev) => {
              const next = { ...prev };
              for (const c of detail.cbhpm_codes) {
                if (!(c.code in next)) next[c.code] = c.porte;
              }
              return next;
            });
          })
          .finally(() => {
            setLoadingIds((prev) => {
              const next = new Set(prev);
              next.delete(proc.id);
              return next;
            });
          });
      }
    },
    [selectedProcedures, detailsMap],
  );

  // ── Real-time calculation (debounced 150 ms) ──────────────────────────────

  const buildCalculatePayload = useCallback(() => {
    if (allCbhpmCodes.length === 0) return null;
    const codes = Object.entries(selectedCodes).map(([code, porte]) => {
      const cbhpm = allCbhpmCodes.find((c) => c.code === code);
      return { cbhpm_code: code, description: cbhpm?.description ?? "", porte };
    });
    if (codes.length === 0) return null;
    return { selected_codes: codes, auxiliaries_count: auxiliariesCount, requires_anesthesia: requiresAnesthesia };
  }, [allCbhpmCodes, selectedCodes, auxiliariesCount, requiresAnesthesia]);

  useEffect(() => {
    if (calcTimer.current) clearTimeout(calcTimer.current);
    const payload = buildCalculatePayload();
    if (!payload) { setCalculation(null); return; }

    calcTimer.current = setTimeout(async () => {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) setCalculation(await res.json());
    }, 150);

    return () => { if (calcTimer.current) clearTimeout(calcTimer.current); };
  }, [buildCalculatePayload]);

  // ── Share ─────────────────────────────────────────────────────────────────

  const shareCalculation = useCallback(() => {
    if (selectedProcedures.length === 0 || !calculation) return;
    const url = new URL("/share", window.location.origin);
    url.searchParams.set("sbn", selectedProcedures.map((p) => p.id).join(","));
    const codeParam = Object.entries(selectedCodes)
      .map(([code, porte]) => `${code}:${porte}`)
      .join(",");
    url.searchParams.set("codes", codeParam);
    url.searchParams.set("a", String(auxiliariesCount));
    url.searchParams.set("an", requiresAnesthesia ? "1" : "0");
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [selectedProcedures, calculation, selectedCodes, auxiliariesCount, requiresAnesthesia]);

  // ── Code toggle / porte change ────────────────────────────────────────────

  const toggleCode = (code: string, defaultPorte: string) => {
    setSelectedCodes((prev) => {
      const next = { ...prev };
      if (next[code] !== undefined) delete next[code];
      else next[code] = defaultPorte;
      return next;
    });
  };

  const changePorte = (code: string, porte: string) => {
    setSelectedCodes((prev) => ({ ...prev, [code]: porte }));
  };

  const canShare = !!calculation && selectedProcedures.length > 0;

  return (
    <main className="hex-bg relative min-h-screen" style={{ backgroundColor: "hsl(var(--background))" }}>
      {/* Nav */}
      <div className="relative z-10 px-5 pt-5">
        <nav className="nav-bar mx-auto flex max-w-[1080px] items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div
              className="brand-mark flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg, hsl(186,72%,28%), hsl(186,72%,22%))", boxShadow: "0 2px 8px hsla(186,72%,28%,0.35)" }}
            >
              <Activity aria-hidden="true" className="text-white" size={18} />
            </div>
            <div>
              <span className="block text-base font-extrabold tracking-tight text-slate-950 dark:text-slate-50">Afere</span>
              <span className="block text-[10px] font-medium tracking-[0.3px] text-slate-500 dark:text-slate-400 leading-none">NEUROCIRURGIA</span>
            </div>
          </Link>
          <button
            onClick={toggle}
            aria-checked={isDark}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="theme-switch relative inline-flex h-8 w-14 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            role="switch"
            type="button"
          >
            <Sun aria-hidden="true" size={13} className="absolute left-2 text-amber-500 transition-opacity dark:opacity-35" />
            <Moon aria-hidden="true" size={13} className="absolute right-2 text-slate-500 opacity-45 transition-opacity dark:text-cyan-200 dark:opacity-100" />
            <span aria-hidden="true" className={`theme-switch-thumb absolute top-1 h-6 w-6 rounded-full transition-transform duration-200 ${isDark ? "translate-x-7" : "translate-x-1"}`} />
          </button>
        </nav>
      </div>

      {/* Hero */}
      <div className="relative z-[1] px-5 pb-6 pt-8 text-center">
        <h1 className="m-0 mb-1.5 text-[30px] font-extrabold tracking-tight text-slate-950 dark:text-slate-50">
          Composição de Honorários
        </h1>
        <p className="m-0 text-sm font-medium text-slate-500 dark:text-slate-400">
          Selecione o procedimento SBN · Monte a composição · Valorize em tempo real
        </p>
      </div>

      {/* Main grid */}
      <div className="main-grid relative z-[1] mx-auto grid max-w-[1080px] gap-7 px-5 pb-12">
        {/* Left panel */}
        <div className="card-plush rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-8">
          <div className="mb-6 flex items-center gap-2">
            <Stethoscope aria-hidden="true" className="text-primary" size={18} />
            <h2 className="m-0 text-[15px] font-bold text-slate-950 dark:text-slate-50">Buscar Procedimento SBN</h2>
          </div>
          <div className="mb-6">
            <Autocomplete
              label="Procedimento"
              options={searchOptions}
              value={selectedProcedures}
              onChange={handleProceduresChange}
              onSearch={setSearchQuery}
              initialQuery={initialQuery}
            />
          </div>

          {loadingDetail && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Carregando códigos CBHPM...
            </div>
          )}

          {allCbhpmCodes.length > 0 && !loadingDetail && (
            <>
              <div className="mb-4 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-5">
                <Calculator aria-hidden="true" className="text-primary" size={15} />
                <span className="text-[13px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Composição CBHPM
                </span>
              </div>
              <div className="mb-5 space-y-2">
                {allCbhpmCodes.map((c) => {
                  const checked = c.code in selectedCodes;
                  const currentPorte = selectedCodes[c.code] ?? c.porte;
                  return (
                    <div
                      key={c.code}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                        checked
                          ? "border-primary/25 bg-teal-50/60 dark:border-teal-300/20 dark:bg-teal-900/15"
                          : "border-slate-100 dark:border-slate-800 opacity-60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCode(c.code, c.porte)}
                        aria-pressed={checked}
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                          checked
                            ? "border-primary bg-primary text-white"
                            : "border-slate-300 dark:border-slate-600",
                        )}
                      >
                        {checked && <Check size={11} strokeWidth={3} />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                            {c.code}
                          </span>
                          {checked ? (
                            <div className="relative">
                              <select
                                value={currentPorte}
                                onChange={(e) => changePorte(c.code, e.target.value)}
                                className="appearance-none rounded-lg border border-primary/30 bg-transparent py-0.5 pl-2 pr-6 text-[11px] font-semibold text-primary dark:border-teal-300/30 dark:text-teal-300 focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                {PORTES.map((p) => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                              <ChevronDown
                                size={10}
                                className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-primary dark:text-teal-300"
                              />
                            </div>
                          ) : (
                            <span className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
                              {c.porte}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px] leading-snug text-slate-600 dark:text-slate-300">
                          {c.description}
                        </p>
                      </div>

                      {checked && (
                        <button
                          type="button"
                          onClick={() => toggleCode(c.code, c.porte)}
                          aria-label={`Remover ${c.code}`}
                          className="mt-0.5 shrink-0 text-slate-300 hover:text-red-400 dark:text-slate-600"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.4px] text-slate-500 dark:text-slate-400">
                    Número de Auxiliares
                  </label>
                  <Input
                    min={0}
                    max={4}
                    type="number"
                    value={auxiliariesCount}
                    onChange={(e) => setAuxiliariesCount(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="medical-toggle-panel flex items-center justify-between gap-4 rounded-2xl border px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="clinical-icon-chip flex h-8 w-8 items-center justify-center rounded-full">
                    <HeartPulse aria-hidden="true" size={16} />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-slate-950 dark:text-slate-50">Anestesiologista</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Incluir honorários do anestesista</div>
                  </div>
                </div>
                <Toggle checked={requiresAnesthesia} onChange={setRequiresAnesthesia} />
              </div>
            </>
          )}

          {selectedProcedures.length === 0 && !loadingDetail && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-10 text-center">
              <Stethoscope className="text-slate-300 dark:text-slate-600" size={32} />
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Busque e selecione um procedimento SBN para montar a composição
              </p>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="results-card relative overflow-hidden rounded-3xl border border-primary/15 dark:border-teal-300/20 p-7">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator aria-hidden="true" className="text-primary" size={18} />
              <h2 className="m-0 text-[15px] font-bold text-slate-950 dark:text-slate-50">Valoração</h2>
            </div>
            <span className="clinical-pill rounded-full px-2.5 py-1 text-[11px] font-semibold">CBHPM 2025</span>
          </div>

          {calculation ? (
            <>
              <dl className="mb-5 space-y-2">
                {calculation.code_breakdown.map((b) => (
                  <div key={b.cbhpm_code} className="flex items-end justify-between gap-1">
                    <div className="min-w-0">
                      <dt className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{b.cbhpm_code}</dt>
                      <dd className="truncate text-[12px] text-slate-500 dark:text-slate-400">{b.description}</dd>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] font-semibold text-primary dark:text-teal-400">{b.porte}</span>
                      <span className="font-grotesk text-sm font-semibold text-slate-950 dark:text-slate-50">
                        {money.format(b.base_value)}
                      </span>
                    </div>
                  </div>
                ))}
              </dl>

              <div className="teal-divider my-4" />

              <dl className="mb-5 space-y-3.5 dark:text-slate-200">
                <ResultRow label="Cirurgião principal" value={calculation.lead_surgeon_fee} />
                <ResultRow
                  label={`Auxiliares${auxiliariesCount > 1 ? ` (×${auxiliariesCount})` : ""}`}
                  value={calculation.auxiliaries_fee}
                />
                <ResultRow label="Anestesiologista" value={calculation.anesthesiologist_fee} />
              </dl>

              <div className="teal-divider my-4" />

              <div
                className="rounded-2xl p-4 text-white"
                style={{ background: "linear-gradient(135deg, hsl(186,72%,28%), hsl(186,68%,22%))", boxShadow: "0 4px 20px hsla(186,72%,28%,0.35)" }}
              >
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.5px] opacity-75">Total Final</div>
                <div className="font-grotesk text-[36px] font-bold leading-none tracking-tight">
                  {money.format(calculation.final_total)}
                </div>
                {selectedProcedures.length > 0 && (
                  <div className="mt-1.5 text-[11px] font-medium opacity-65">
                    {selectedProcedures.map((p) => p.name).join(" · ")}
                  </div>
                )}
              </div>

              {canShare && (
                <button
                  id="share-calculation-btn"
                  onClick={shareCalculation}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/25 px-4 py-3 text-sm font-semibold text-primary transition-all hover:bg-primary/5 active:scale-[0.98] dark:border-teal-300/20 dark:text-teal-300"
                  type="button"
                >
                  {copied ? <><Check size={16} /> Link copiado!</> : <><Share2 size={16} /> Compartilhar cálculo</>}
                </button>
              )}

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-3">
                <Info aria-hidden="true" className="mt-px shrink-0 text-slate-400 dark:text-slate-500" size={15} />
                <p className="m-0 text-[11px] font-medium leading-relaxed text-slate-400 dark:text-slate-500">
                  Valores calculados conforme Tabela CBHPM 2025/2026. Sujeito à variação por convênio.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <Calculator className="text-slate-200 dark:text-slate-700" size={40} />
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Selecione ao menos um código CBHPM para ver a valoração
              </p>
            </div>
          )}
        </div>
      </div>

      <footer className="relative z-[1] px-5 pb-5 text-center">
        <div className="footer-divider mb-3.5 h-px" />
        <p className="m-0 text-xs font-medium text-slate-400 dark:text-slate-500">
          2026 &nbsp;·&nbsp; <span className="font-bold text-slate-500">LabF5</span> &nbsp;·&nbsp; Todos os direitos reservados
        </p>
      </footer>
    </main>
  );
}

function SearchParamsReader() {
  const searchParams = useSearchParams();
  return (
    <ProcedureContent
      initialQuery={searchParams.get("q") ?? ""}
      initialSbnId={searchParams.get("sbn") ?? ""}
    />
  );
}

export default function ProcedurePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "hsl(var(--background))" }}>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <SearchParamsReader />
    </Suspense>
  );
}

function ResultRow({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="flex items-end justify-between gap-1">
      <dt className="shrink-0 text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <div className="leader" />
      <dd className="font-grotesk shrink-0 text-sm font-semibold text-slate-950 dark:text-slate-50">
        {value === undefined ? "—" : money.format(value)}
      </dd>
    </div>
  );
}
