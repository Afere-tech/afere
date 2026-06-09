"use client";

import {
  Activity,
  ArrowLeft,
  Calculator,
  Info,
  Moon,
  Stethoscope,
  Sun,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

// ─── Domain types ────────────────────────────────────────────────────────────

type ProcedureDetail = { id: string; name: string; cbhpm_codes: { code: string; description: string; porte: string }[] };
type CodeBreakdown = { cbhpm_code: string; description: string; porte: string; base_value: number };
type CalculationResult = {
  code_breakdown: CodeBreakdown[];
  total_base: number;
  lead_surgeon_fee: number;
  auxiliaries_fee: number;
  anesthesiologist_fee: number;
  final_total: number;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// ─── Share content (requires client-side search params) ──────────────────────

function ShareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sbnId = searchParams.get("sbn") ?? "";
  const codesParam = searchParams.get("codes") ?? "";
  const auxiliariesCount = Number(searchParams.get("a") ?? "0");
  const requiresAnesthesia = searchParams.get("an") === "1";

  const [procedure, setProcedure] = useState<ProcedureDetail | null>(null);
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sbnId || !codesParam) {
      setError("Link inválido ou incompleto.");
      setLoading(false);
      return;
    }

    // Parse codes param: "3.05.05.01-0:7A,3.05.05.02-8:6B"
    const parsedCodes = codesParam.split(",").flatMap((segment) => {
      const [code, porte] = segment.split(":");
      return code && porte ? [{ cbhpm_code: code, porte }] : [];
    });

    if (parsedCodes.length === 0) {
      setError("Nenhum código CBHPM encontrado no link.");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        // 1. Fetch procedure details (to get names for each code)
        const procRes = await fetch(`/api/procedures/${sbnId}`);
        if (!procRes.ok) throw new Error("Procedimento não encontrado.");
        const procData: ProcedureDetail = await procRes.json();
        setProcedure(procData);

        // 2. Build selected_codes with descriptions from the procedure detail
        const selectedCodes = parsedCodes.map(({ cbhpm_code, porte }) => {
          const match = procData.cbhpm_codes.find((c) => c.code === cbhpm_code);
          return { cbhpm_code, description: match?.description ?? "", porte };
        });

        // 3. Calculate
        const calcRes = await fetch("/api/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selected_codes: selectedCodes,
            auxiliaries_count: auxiliariesCount,
            requires_anesthesia: requiresAnesthesia,
          }),
        });
        if (!calcRes.ok) throw new Error("Erro ao realizar o cálculo.");
        setCalculation(await calcRes.json());
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao carregar os dados.");
      } finally {
        setLoading(false);
      }
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sbnId, codesParam, auxiliariesCount, requiresAnesthesia]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Carregando cálculo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-red-200/80 dark:border-red-900/30 bg-white dark:bg-slate-900 p-8 text-center">
        <Info className="mx-auto mb-4 text-red-500" size={40} />
        <h2 className="mb-2 text-lg font-bold text-slate-950 dark:text-slate-50">Ops! Algo deu errado</h2>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <Button onClick={() => router.push("/")}>
          <ArrowLeft size={16} /> Voltar para o início
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[640px] space-y-6">
      {/* Procedure summary */}
      <div className="card-plush rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8">
        <div className="mb-5 flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary"
            style={{ backgroundColor: "hsla(186,72%,28%,0.10)" }}
          >
            <Stethoscope size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Procedimento SBN
            </span>
            <h2 className="m-0 text-lg font-bold leading-snug text-slate-950 dark:text-slate-50">
              {procedure?.name}
            </h2>
          </div>
        </div>

        {/* CBHPM codes included */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.4px] text-slate-400 dark:text-slate-500">
            Códigos CBHPM incluídos
          </span>
          {calculation?.code_breakdown.map((b) => (
            <div
              key={b.cbhpm_code}
              className="flex items-end justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-3 py-2.5"
            >
              <div className="min-w-0">
                <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{b.cbhpm_code}</span>
                <p className="truncate text-[12px] text-slate-600 dark:text-slate-300">{b.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] font-semibold text-primary dark:text-teal-400">{b.porte}</span>
                <span className="font-grotesk text-sm font-semibold text-slate-950 dark:text-slate-50">
                  {money.format(b.base_value)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-3 sm:grid-cols-2">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Auxiliares
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {auxiliariesCount} {auxiliariesCount === 1 ? "auxiliar" : "auxiliares"}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Anestesiologista
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {requiresAnesthesia ? "Incluso" : "Não incluso"}
            </span>
          </div>
        </div>
      </div>

      {/* Results card */}
      <div className="results-card relative overflow-hidden rounded-3xl border border-primary/15 dark:border-teal-300/20 p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator aria-hidden="true" className="text-primary" size={18} />
            <h2 className="m-0 text-[15px] font-bold text-slate-950 dark:text-slate-50">Honorários</h2>
          </div>
          <span className="clinical-pill rounded-full px-2.5 py-1 text-[11px] font-semibold">CBHPM 2025</span>
        </div>

        <dl className="space-y-3.5 dark:text-slate-200">
          <ResultRow label="Cirurgião principal" value={calculation?.lead_surgeon_fee} />
          <ResultRow
            label={`Auxiliares${auxiliariesCount > 1 ? ` (×${auxiliariesCount})` : ""}`}
            value={calculation?.auxiliaries_fee}
          />
          <ResultRow label="Anestesiologista" value={calculation?.anesthesiologist_fee} />
        </dl>

        <div className="teal-divider my-5" />

        <div
          className="rounded-2xl p-5 text-white"
          style={{ background: "linear-gradient(135deg, hsl(186,72%,28%), hsl(186,68%,22%))", boxShadow: "0 4px 20px hsla(186,72%,28%,0.35)" }}
        >
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.5px] opacity-75">Total Final</div>
          <div className="font-grotesk text-[38px] font-bold leading-none tracking-tight">
            {calculation ? money.format(calculation.final_total) : "—"}
          </div>
          {procedure && (
            <div className="mt-1.5 text-[11px] font-medium opacity-65">{procedure.name}</div>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-3">
          <Info aria-hidden="true" className="mt-px shrink-0 text-slate-400 dark:text-slate-500" size={15} />
          <p className="m-0 text-[11px] font-medium leading-relaxed text-slate-400 dark:text-slate-500">
            Valores calculados conforme Tabela CBHPM 2025/2026. Sujeito à variação por convênio.
          </p>
        </div>
      </div>

      {/* Back button */}
      <div className="text-center">
        <Button
          onClick={() => router.push("/")}
          className="border border-primary/25 bg-transparent text-primary hover:bg-primary/5 dark:border-teal-300/20 dark:text-teal-300"
        >
          <ArrowLeft size={15} /> Novo cálculo
        </Button>
      </div>
    </div>
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

// ─── Page shell (nav + hero live outside Suspense) ────────────────────────────

export default function SharePage() {
  const { isDark, toggle } = useTheme();

  return (
    <main className="hex-bg relative min-h-screen pb-12" style={{ backgroundColor: "hsl(var(--background))" }}>
      {/* Nav */}
      <div className="relative z-10 px-5 pt-5">
        <nav className="nav-bar mx-auto flex max-w-[1080px] items-center justify-between">
          <div className="flex items-center gap-2.5">
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
          </div>
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
            <span
              aria-hidden="true"
              className={`theme-switch-thumb absolute top-1 h-6 w-6 rounded-full transition-transform duration-200 ${isDark ? "translate-x-7" : "translate-x-1"}`}
            />
          </button>
        </nav>
      </div>

      {/* Hero */}
      <div className="relative z-[1] px-5 pb-8 pt-10 text-center">
        <h1 className="m-0 mb-1.5 text-[28px] font-extrabold tracking-tight text-slate-950 dark:text-slate-50">
          Cálculo Compartilhado
        </h1>
        <p className="m-0 text-sm font-medium text-slate-500 dark:text-slate-400">
          Resumo de honorários baseado na tabela CBHPM
        </p>
      </div>

      <div className="relative z-[1] px-5">
        <Suspense
          fallback={
            <div className="flex min-h-[30vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          }
        >
          <ShareContent />
        </Suspense>
      </div>
    </main>
  );
}
