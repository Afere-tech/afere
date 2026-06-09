"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ─── Fixed design tokens — no dark/light switching on this page ──────────────

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
} as const;

const EXAMPLES = [
  "Cateter de PIC",
  "Craniotomia descompressiva",
  "Derivação ventrículo-peritoneal",
  "Aneurisma cerebral",
];

type ProcedureHit = { id: string; name: string };

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [hits, setHits] = useState<ProcedureHit[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

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

    // Keyboard-highlighted item takes priority
    if (activeIdx >= 0 && hits[activeIdx]) {
      selectHit(hits[activeIdx]);
      return;
    }

    // Hits already cached from the debounce — use the first one
    if (hits.length > 0) {
      selectHit(hits[0]);
      return;
    }

    const q = query.trim();
    if (!q) { inputRef.current?.focus(); return; }

    // Debounce hasn't fired yet — do an immediate fetch
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(true);
    setDropdownOpen(false);
    try {
      const res = await fetch(`/api/procedures/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: ProcedureHit[] = await res.json();
        if (data?.length > 0) {
          selectHit(data[0]);
          return;
        }
      }
    } catch {}

    // Genuine fallback: no results — let procedure page handle the empty state
    setSearching(false);
    router.push(`/procedure?q=${encodeURIComponent(q)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownOpen || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
    }
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
        backgroundColor: T.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "620px" }}>

        {/* ── Card ── */}
        <div
          style={{
            backgroundColor: T.surface,
            borderRadius: "12px",
            border: `1px solid ${T.cardBorder}`,
            padding: "44px 40px 36px",
            boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 20px rgba(15,23,42,0.05)",
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
            <p
              style={{
                margin: 0,
                fontSize: "13.5px",
                fontWeight: 500,
                color: T.secondary,
                letterSpacing: "0.1px",
              }}
            >
              Valoração de Procedimentos Médicos
            </p>
          </div>

          {/* ── Search form ── */}
          <form ref={formRef} onSubmit={handleSubmit} autoComplete="off">
            <label
              htmlFor="procedure-search"
              style={{
                display: "block",
                marginBottom: "7px",
                fontSize: "13px",
                fontWeight: 600,
                color: T.secondary,
              }}
            >
              Procedimento
            </label>

            <div style={{ position: "relative", marginBottom: "10px" }}>
              <Search
                size={15}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "13px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: T.inputFocus,
                  pointerEvents: "none",
                  zIndex: 1,
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
                onFocus={() => {
                  setFocused(true);
                  if (hits.length > 0) setDropdownOpen(true);
                }}
                onBlur={() => setFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="Digite o nome do procedimento..."
                style={{
                  width: "100%",
                  height: "48px",
                  paddingLeft: "38px",
                  paddingRight: "14px",
                  fontSize: "14.5px",
                  fontFamily: "inherit",
                  color: T.primary,
                  backgroundColor: T.surface,
                  border: `1.5px solid ${focused ? T.inputFocus : T.inputBorder}`,
                  borderRadius: showDropdown ? "10px 10px 0 0" : "10px",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 150ms ease, border-radius 80ms ease",
                  boxShadow: focused ? `0 0 0 3px ${T.inputFocus}28` : "none",
                }}
              />

              {/* ── Autocomplete dropdown ── */}
              {showDropdown && (
                <ul
                  role="listbox"
                  aria-label="Procedimentos encontrados"
                  style={{
                    position: "absolute",
                    top: "47px",
                    left: 0,
                    right: 0,
                    backgroundColor: T.surface,
                    border: `1.5px solid ${T.inputFocus}`,
                    borderTop: `1px solid #EEF1F5`,
                    borderRadius: "0 0 10px 10px",
                    boxShadow: "0 8px 24px rgba(15,23,42,0.09)",
                    maxHeight: "240px",
                    overflowY: "auto",
                    listStyle: "none",
                    margin: 0,
                    padding: "4px 0",
                    zIndex: 50,
                  }}
                >
                  {hits.map((hit, i) => (
                    <li
                      key={hit.id}
                      id={`hit-${i}`}
                      role="option"
                      aria-selected={i === activeIdx}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        selectHit(hit);
                      }}
                      onMouseEnter={() => setActiveIdx(i)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "9px 14px",
                        cursor: "pointer",
                        backgroundColor: i === activeIdx ? T.dropHover : "transparent",
                        transition: "background-color 80ms ease",
                      }}
                    >
                      <Search
                        size={12}
                        aria-hidden="true"
                        style={{ color: T.inputFocus, flexShrink: 0 }}
                      />
                      <span
                        style={{
                          fontSize: "13.5px",
                          fontWeight: 500,
                          color: T.primary,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {hit.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <PesquisarButton disabled={!query.trim()} loading={searching} />
          </form>

          {/* ── Helper text ── */}
          <p
            style={{
              margin: "16px 0 0",
              fontSize: "12.5px",
              lineHeight: "1.65",
              color: T.muted,
            }}
          >
            Pesquise um procedimento para revisar os códigos CBHPM sugeridos,
            selecionar a composição desejada e calcular a valoração final.
          </p>

          {/* ── Examples ── */}
          <div style={{ marginTop: "22px" }}>
            <p
              style={{
                margin: "0 0 9px",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                color: T.muted,
              }}
            >
              Exemplos
            </p>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {EXAMPLES.map((ex) => (
                <ExampleChip key={ex} label={ex} onClick={() => fillExample(ex)} />
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
        width: "100%",
        height: "46px",
        backgroundColor: inactive ? T.btnDisabled : hovered ? T.btnHover : T.btnBg,
        color: "#FFFFFF",
        border: "none",
        borderRadius: "10px",
        fontSize: "14px",
        fontWeight: 600,
        letterSpacing: "0.1px",
        fontFamily: "inherit",
        cursor: inactive ? "default" : "pointer",
        transition: "background-color 140ms ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
      }}
    >
      {loading && (
        <span
          aria-hidden="true"
          style={{
            width: "14px",
            height: "14px",
            border: "2px solid rgba(255,255,255,0.4)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            display: "inline-block",
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
        borderRadius: "100px",
        fontSize: "12px",
        fontWeight: 500,
        fontFamily: "inherit",
        color: hovered ? T.primary : T.muted,
        cursor: "pointer",
        transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
      }}
    >
      {label}
    </button>
  );
}
