"use client";

import { BookmarkCheck, Search, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg:          "#F1F5F9",
  surface:     "#FFFFFF",
  cardBorder:  "#E2E8F0",
  primary:     "#0F172A",
  secondary:   "#475569",
  muted:       "#64748B",
  inputBorder: "#CBD5E1",
  inputFocus:  "#94A3B8",
  btnBg:       "#1E293B",
  btnHover:    "#334155",
  btnDisabled: "#CBD5E1",
  dropHover:   "#F8FAFC",
  teal:        "#0F766E",
} as const;

const EXAMPLES = [
  "Cateter de PIC",
  "Craniotomia descompressiva",
  "Derivação ventrículo-peritoneal",
  "Aneurisma cerebral",
];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// ─── Types ────────────────────────────────────────────────────────────────────

type ProcedureHit = { id: string; name: string };

// Mirrors generated.CalculationSummary from the backend.
type CalcSummary = {
  public_id: string;
  procedure_name: string;
  procedure_sbn_code: string;
  surgeon_value: number;
  auxiliaries_total_value: number;
  anesthesiologist_value: number;
  team_total_value: number;
  auxiliaries_count: number;
  requires_anesthesia: boolean;
  access_route_type: "same" | "different";
  created_at: string;
};

// ─── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"search" | "saved">("search");

  // Search state
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [hits, setHits] = useState<ProcedureHit[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Saved calcs state
  const [savedCalcs, setSavedCalcs] = useState<CalcSummary[]>([]);
  const [calcsLoaded, setCalcsLoaded] = useState(false);

  // ── Fetch saved calcs from the API ────────────────────────────────────────

  const fetchCalcs = async () => {
    setCalcsLoaded(false);
    try {
      const res = await fetch("/api/calculations");
      setSavedCalcs(res.ok ? await res.json() : []);
    } catch {
      setSavedCalcs([]);
    } finally {
      setCalcsLoaded(true);
    }
  };

  // Eager load on mount so the badge count is populated immediately.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCalcs(); }, []);

  // Re-fetch each time the tab is opened to pick up any calcs saved mid-session.
  useEffect(() => {
    if (activeTab === "saved") fetchCalcs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Debounced search ───────────────────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setHits([]);
      setDropdownOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/procedures/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data: ProcedureHit[] = await res.json();
          setHits(data ?? []);
          setDropdownOpen((data ?? []).length > 0);
          setActiveIdx(-1);
        }
      } catch {
        // leave existing hits on network error
      }
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ── Close dropdown on outside click ───────────────────────────────────────

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // ── Navigation ─────────────────────────────────────────────────────────────

  function selectHit(hit: ProcedureHit) {
    setDropdownOpen(false);
    router.push(`/procedure?sbn=${encodeURIComponent(hit.id)}`);
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (activeIdx >= 0 && hits[activeIdx]) { selectHit(hits[activeIdx]); return; }
    if (hits.length > 0) { selectHit(hits[0]); return; }
    const q = query.trim();
    if (!q) { inputRef.current?.focus(); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(true);
    setDropdownOpen(false);
    try {
      const res = await fetch(`/api/procedures/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: ProcedureHit[] = await res.json();
        if (data?.length > 0) { selectHit(data[0]); return; }
      }
    } catch {}
    setSearching(false);
    router.push(`/procedure?q=${encodeURIComponent(q)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownOpen || hits.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Escape") { setDropdownOpen(false); }
  }

  function fillExample(ex: string) {
    setQuery(ex);
    inputRef.current?.focus();
  }

  const showDropdown = dropdownOpen && hits.length > 0;

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#E8EEF4",
        backgroundImage: [
          "radial-gradient(ellipse 700px 500px at 75% 15%, rgba(14,165,233,0.13) 0%, transparent 70%)",
          "radial-gradient(ellipse 600px 480px at 20% 88%, rgba(20,184,166,0.12) 0%, transparent 70%)",
        ].join(", "),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "620px" }}>

        {/* ── Tab bar ── */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "12px",
            background: "rgba(255,255,255,0.42)",
            borderRadius: "12px",
            padding: "4px",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.5)",
          }}
        >
          <TabBtn
            active={activeTab === "search"}
            onClick={() => setActiveTab("search")}
          >
            <Search size={13} aria-hidden="true" />
            Pesquisar
          </TabBtn>
          <TabBtn
            active={activeTab === "saved"}
            onClick={() => setActiveTab("saved")}
          >
            <BookmarkCheck size={13} aria-hidden="true" />
            Cálculos salvos
            {savedCalcs.length > 0 && activeTab !== "saved" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "18px",
                  height: "18px",
                  padding: "0 5px",
                  borderRadius: "100px",
                  fontSize: "10px",
                  fontWeight: 700,
                  backgroundColor: T.teal,
                  color: "#fff",
                  lineHeight: 1,
                }}
              >
                {savedCalcs.length > 9 ? "9+" : savedCalcs.length}
              </span>
            )}
          </TabBtn>
        </div>

        {/* ── Card ── */}
        <div
          style={{
            background: "rgba(255,255,255,0.68)",
            backdropFilter: "blur(28px) saturate(160%)",
            WebkitBackdropFilter: "blur(28px) saturate(160%)",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.58)",
            padding: "44px 40px 36px",
            boxShadow:
              "0 2px 4px rgba(15,23,42,0.05), 0 8px 24px rgba(15,23,42,0.09), 0 32px 56px -8px rgba(15,23,42,0.11)",
          }}
        >

          {/* ── Brand ── */}
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "18px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/afere-icon.svg"
                alt=""
                aria-hidden="true"
                width={60}
                height={60}
                style={{ borderRadius: "14px", display: "block" }}
              />
            </div>
            <h1
              style={{
                margin: "0 0 7px",
                fontSize: "27px",
                fontWeight: 800,
                letterSpacing: "-0.5px",
                color: T.primary,
                lineHeight: 1.1,
              }}
            >
              Afere
            </h1>
            <p style={{ margin: 0, fontSize: "13.5px", fontWeight: 500, color: T.secondary, letterSpacing: "0.1px" }}>
              Valoração de Procedimentos Médicos
            </p>
          </div>

          {/* ── Tab content ── */}
          {activeTab === "search" ? (
            <>
              {/* Formulário de busca */}
              <form ref={formRef} onSubmit={handleSubmit} autoComplete="off">
                <label
                  htmlFor="procedure-search"
                  style={{ display: "block", marginBottom: "7px", fontSize: "13px", fontWeight: 600, color: T.secondary }}
                >
                  Procedimento
                </label>

                <div style={{ position: "relative", marginBottom: "10px" }}>
                  <Search
                    size={15}
                    aria-hidden="true"
                    style={{
                      position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)",
                      color: T.inputFocus, pointerEvents: "none", zIndex: 1,
                    }}
                  />
                  <input
                    id="procedure-search"
                    ref={inputRef}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={showDropdown}
                    aria-activedescendant={activeIdx >= 0 ? `hit-${activeIdx}` : undefined}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => { setFocused(true); if (hits.length > 0) setDropdownOpen(true); }}
                    onBlur={() => setFocused(false)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite o nome do procedimento..."
                    style={{
                      width: "100%", height: "48px", paddingLeft: "38px", paddingRight: "14px",
                      fontSize: "14.5px", fontFamily: "inherit", color: T.primary,
                      backgroundColor: T.surface,
                      border: `1.5px solid ${focused ? T.inputFocus : T.inputBorder}`,
                      borderRadius: showDropdown ? "10px 10px 0 0" : "10px",
                      outline: "none", boxSizing: "border-box",
                      transition: "border-color 150ms ease, border-radius 80ms ease",
                      boxShadow: focused ? `0 0 0 3px ${T.inputFocus}28` : "none",
                    }}
                  />

                  {showDropdown && (
                    <ul
                      role="listbox"
                      aria-label="Procedimentos encontrados"
                      style={{
                        position: "absolute", top: "47px", left: 0, right: 0,
                        backgroundColor: T.surface,
                        border: `1.5px solid ${T.inputFocus}`,
                        borderTop: "1px solid #EEF1F5",
                        borderRadius: "0 0 10px 10px",
                        boxShadow: "0 8px 24px rgba(15,23,42,0.09)",
                        maxHeight: "240px", overflowY: "auto",
                        listStyle: "none", margin: 0, padding: "4px 0", zIndex: 50,
                      }}
                    >
                      {hits.map((hit, i) => (
                        <li
                          key={hit.id}
                          id={`hit-${i}`}
                          role="option"
                          aria-selected={i === activeIdx}
                          onPointerDown={(e) => { e.preventDefault(); selectHit(hit); }}
                          onMouseEnter={() => setActiveIdx(i)}
                          style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            padding: "9px 14px", cursor: "pointer",
                            backgroundColor: i === activeIdx ? T.dropHover : "transparent",
                            transition: "background-color 80ms ease",
                          }}
                        >
                          <Search size={12} aria-hidden="true" style={{ color: T.inputFocus, flexShrink: 0 }} />
                          <span style={{ fontSize: "13.5px", fontWeight: 500, color: T.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {hit.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <PesquisarButton disabled={!query.trim()} loading={searching} />
              </form>

              <p style={{ margin: "16px 0 0", fontSize: "12.5px", lineHeight: "1.65", color: T.muted }}>
                Pesquise um procedimento para revisar os códigos CBHPM sugeridos,
                selecionar a composição desejada e calcular a valoração final.
              </p>

              <div style={{ marginTop: "22px" }}>
                <p style={{ margin: "0 0 9px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: T.muted }}>
                  Exemplos
                </p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {EXAMPLES.map((ex) => (
                    <ExampleChip key={ex} label={ex} onClick={() => fillExample(ex)} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <SavedCalcsList
              calcs={savedCalcs}
              loaded={calcsLoaded}
              onDelete={(publicID) =>
                setSavedCalcs((prev) => prev.filter((c) => c.public_id !== publicID))
              }
            />
          )}

        </div>
      </div>
    </main>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding: "8px 14px",
        borderRadius: "9px",
        border: "none",
        fontSize: "13px",
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        transition: "background-color 140ms ease, color 140ms ease, box-shadow 140ms ease",
        backgroundColor: active ? "#FFFFFF" : "transparent",
        color: active ? T.primary : T.muted,
        boxShadow: active
          ? "0 1px 3px rgba(15,23,42,0.10), 0 1px 1px rgba(15,23,42,0.06)"
          : "none",
      }}
    >
      {children}
    </button>
  );
}

// ─── Saved calculations list ──────────────────────────────────────────────────

function SavedCalcsList({
  calcs,
  loaded,
  onDelete,
}: {
  calcs: CalcSummary[];
  loaded: boolean;
  onDelete: (publicID: string) => void;
}) {
  if (!loaded) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div
          style={{
            width: "20px", height: "20px", margin: "0 auto 12px",
            border: "2px solid #CBD5E1", borderTopColor: T.primary,
            borderRadius: "50%", animation: "spin 0.7s linear infinite",
          }}
        />
      </div>
    );
  }

  if (calcs.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <BookmarkCheck
          size={36}
          aria-hidden="true"
          style={{ color: T.inputBorder, margin: "0 auto 14px", display: "block" }}
        />
        <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 600, color: T.secondary }}>
          Nenhum cálculo salvo ainda
        </p>
        <p style={{ margin: 0, fontSize: "12.5px", lineHeight: 1.6, color: T.muted }}>
          Calcule um procedimento e clique em{" "}
          <span style={{ fontWeight: 600, color: T.primary }}>"Salvar cálculo"</span>{" "}
          para guardá-lo aqui.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ margin: "0 0 14px", fontSize: "11.5px", fontWeight: 600, color: T.muted, letterSpacing: "0.2px" }}>
        {calcs.length} cálculo{calcs.length !== 1 ? "s" : ""} salvo{calcs.length !== 1 ? "s" : ""}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {calcs.map((calc) => (
          <SavedCalcRow key={calc.public_id} calc={calc} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function SavedCalcRow({
  calc,
  onDelete,
}: {
  calc: CalcSummary;
  onDelete: (publicID: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [trashHovered, setTrashHovered] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const date = new Date(calc.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const href = calc.procedure_sbn_code
    ? `/procedure?sbn=${encodeURIComponent(calc.procedure_sbn_code)}`
    : `/procedure?q=${encodeURIComponent(calc.procedure_name)}`;

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Apagar "${calc.procedure_name}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/calculations/${calc.public_id}`, { method: "DELETE" });
      if (res.ok || res.status === 404) {
        onDelete(calc.public_id);
      }
    } catch {
      // leave item in list on network error
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        textDecoration: "none",
        borderRadius: "10px",
        border: `1.5px solid ${hovered ? T.inputFocus : T.cardBorder}`,
        padding: "12px 14px",
        backgroundColor: hovered ? T.dropHover : T.surface,
        transition: "border-color 130ms ease, background-color 110ms ease",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px" }}>
        {/* Left: name + meta */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: "13.5px",
              fontWeight: 600,
              color: T.primary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {calc.procedure_name}
          </p>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: T.muted }}>{date}</span>
            {calc.auxiliaries_count > 0 && (
              <span
                style={{
                  fontSize: "10.5px", fontWeight: 600, color: T.teal,
                  background: "#CCFBF1", borderRadius: "4px", padding: "1px 6px",
                }}
              >
                {calc.auxiliaries_count} aux.
              </span>
            )}
            {calc.requires_anesthesia && (
              <span
                style={{
                  fontSize: "10.5px", fontWeight: 600, color: "#6D28D9",
                  background: "#EDE9FE", borderRadius: "4px", padding: "1px 6px",
                }}
              >
                Anest.
              </span>
            )}
          </div>
        </div>

        {/* Right: total + delete */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                margin: "0 0 1px",
                fontSize: "15px",
                fontWeight: 700,
                color: T.primary,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}
            >
              {money.format(calc.team_total_value)}
            </p>
            <p style={{ margin: 0, fontSize: "10.5px", color: T.muted }}>Total equipe</p>
          </div>

          <button
            type="button"
            aria-label="Apagar cálculo"
            disabled={deleting}
            onClick={handleDelete}
            onMouseEnter={() => setTrashHovered(true)}
            onMouseLeave={() => setTrashHovered(false)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "30px",
              height: "30px",
              border: `1px solid ${trashHovered ? "#FECACA" : T.cardBorder}`,
              borderRadius: "7px",
              backgroundColor: trashHovered ? "#FFF1F1" : "transparent",
              color: trashHovered ? "#DC2626" : T.muted,
              cursor: deleting ? "default" : "pointer",
              opacity: deleting ? 0.5 : 1,
              transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
              flexShrink: 0,
            }}
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </Link>
  );
}

// ─── Search sub-components ────────────────────────────────────────────────────

function PesquisarButton({ disabled, loading }: { disabled: boolean; loading: boolean }) {
  const [hovered, setHovered] = useState(false);
  const inactive = disabled || loading;

  return (
    <button
      type="submit"
      disabled={inactive}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%", height: "46px",
        backgroundColor: inactive ? T.btnDisabled : hovered ? T.btnHover : T.btnBg,
        color: "#FFFFFF", border: "none", borderRadius: "10px",
        fontSize: "14px", fontWeight: 600, letterSpacing: "0.1px",
        fontFamily: "inherit", cursor: inactive ? "default" : "pointer",
        transition: "background-color 140ms ease",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
      }}
    >
      {loading && (
        <span
          aria-hidden="true"
          style={{
            width: "14px", height: "14px",
            border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff",
            borderRadius: "50%", display: "inline-block",
            animation: "spin 0.7s linear infinite",
          }}
        />
      )}
      {loading ? "Pesquisando..." : "Pesquisar"}
    </button>
  );
}

function ExampleChip({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "5px 12px",
        backgroundColor: hovered ? "#F1F5F9" : "transparent",
        border: `1px solid ${hovered ? T.inputBorder : T.cardBorder}`,
        borderRadius: "100px", fontSize: "12px", fontWeight: 500,
        fontFamily: "inherit", color: hovered ? T.primary : T.muted,
        cursor: "pointer",
        transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
      }}
    >
      {label}
    </button>
  );
}
