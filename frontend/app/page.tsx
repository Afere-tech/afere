"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { BookmarkCheck, LogIn, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  "Microdiscectomia",
  "Hematoma subdural",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type ProcedureHit = { id: string; name: string };

type CompositionItem = {
  public_id: string;
  name: string;
  sbn_procedure_id: string;
  sbn_procedure_name: string;
  access_route_type: "same" | "different";
  auxiliaries_count: number;
  requires_anesthesia: boolean;
  created_at: string;
};

// ─── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"search" | "compositions">("search");

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

  // Compositions state
  const [compositions, setCompositions] = useState<CompositionItem[]>([]);
  const [compositionsLoaded, setCompositionsLoaded] = useState(false);

  // ── Fetch compositions (auth-aware) ───────────────────────────────────────

  const fetchCompositions = useCallback(async () => {
    if (!isSignedIn) {
      setCompositions([]);
      setCompositionsLoaded(true);
      return;
    }
    setCompositionsLoaded(false);
    try {
      const token = await getToken();
      const res = await fetch("/api/compositions", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setCompositions(res.ok ? await res.json() : []);
    } catch {
      setCompositions([]);
    } finally {
      setCompositionsLoaded(true);
    }
  }, [isSignedIn, getToken]);

  // Eager load when auth is ready so the badge count is populated.
  useEffect(() => {
    if (isLoaded) fetchCompositions();
  }, [isLoaded, fetchCompositions]);

  // Re-fetch each time the compositions tab is opened.
  useEffect(() => {
    if (activeTab === "compositions" && isLoaded) fetchCompositions();
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

  async function fillExample(ex: string) {
    setQuery(ex);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(true);
    setDropdownOpen(false);
    try {
      const res = await fetch(`/api/procedures/search?q=${encodeURIComponent(ex)}`);
      if (res.ok) {
        const data: ProcedureHit[] = await res.json();
        if (data?.length > 0) { selectHit(data[0]); return; }
      }
    } catch {}
    setSearching(false);
    router.push(`/procedure?q=${encodeURIComponent(ex)}`);
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

        {/* ── Auth bar ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            marginBottom: "10px",
            minHeight: "32px",
          }}
        >
          {isLoaded && (
            isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="modal">
                <button
                  type="button"
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "6px 14px", borderRadius: "8px",
                    border: "1.5px solid rgba(255,255,255,0.6)",
                    background: "rgba(255,255,255,0.55)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    fontSize: "12.5px", fontWeight: 600, fontFamily: "inherit",
                    color: T.primary, cursor: "pointer",
                  }}
                >
                  <LogIn size={13} aria-hidden="true" />
                  Entrar
                </button>
              </SignInButton>
            )
          )}
        </div>

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
          <TabBtn active={activeTab === "search"} onClick={() => setActiveTab("search")}>
            <Search size={13} aria-hidden="true" />
            Pesquisar
          </TabBtn>
          <TabBtn active={activeTab === "compositions"} onClick={() => setActiveTab("compositions")}>
            <BookmarkCheck size={13} aria-hidden="true" />
            Minhas composições
            {isSignedIn && compositions.length > 0 && activeTab !== "compositions" && (
              <span
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  minWidth: "18px", height: "18px", padding: "0 5px",
                  borderRadius: "100px", fontSize: "10px", fontWeight: 700,
                  backgroundColor: T.teal, color: "#fff", lineHeight: 1,
                }}
              >
                {compositions.length > 9 ? "9+" : compositions.length}
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
                margin: "0 0 7px", fontSize: "27px", fontWeight: 800,
                letterSpacing: "-0.5px", color: T.primary, lineHeight: 1.1,
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
            /* ── Compositions tab ── */
            !isLoaded ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div
                  style={{
                    width: "20px", height: "20px", margin: "0 auto",
                    border: "2px solid #CBD5E1", borderTopColor: T.primary,
                    borderRadius: "50%", animation: "spin 0.7s linear infinite",
                  }}
                />
              </div>
            ) : !isSignedIn ? (
              <SignInGate />
            ) : (
              <CompositionList
                compositions={compositions}
                loaded={compositionsLoaded}
                getToken={getToken}
                onDelete={(publicID) =>
                  setCompositions((prev) => prev.filter((c) => c.public_id !== publicID))
                }
              />
            )
          )}

        </div>
      </div>
    </main>
  );
}

// ─── Sign-in gate ─────────────────────────────────────────────────────────────

function SignInGate() {
  return (
    <div style={{ textAlign: "center", padding: "40px 0" }}>
      <div
        style={{
          width: "48px", height: "48px", margin: "0 auto 18px",
          borderRadius: "50%", backgroundColor: "#F1F5F9",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <LogIn size={22} aria-hidden="true" style={{ color: T.muted }} />
      </div>
      <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 600, color: T.primary }}>
        Entre para ver suas composições
      </p>
      <p style={{ margin: "0 0 22px", fontSize: "12.5px", lineHeight: 1.6, color: T.muted }}>
        Suas composições são salvas na sua conta e ficam disponíveis em qualquer dispositivo.
      </p>
      <SignInButton mode="modal">
        <button
          type="button"
          style={{
            display: "inline-flex", alignItems: "center", gap: "7px",
            padding: "10px 24px", borderRadius: "10px", border: "none",
            backgroundColor: T.btnBg, color: "#FFFFFF",
            fontSize: "13.5px", fontWeight: 600, fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <LogIn size={14} aria-hidden="true" />
          Entrar
        </button>
      </SignInButton>
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        gap: "6px", padding: "8px 14px", borderRadius: "9px", border: "none",
        fontSize: "13px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
        transition: "background-color 140ms ease, color 140ms ease, box-shadow 140ms ease",
        backgroundColor: active ? "#FFFFFF" : "transparent",
        color: active ? T.primary : T.muted,
        boxShadow: active ? "0 1px 3px rgba(15,23,42,0.10), 0 1px 1px rgba(15,23,42,0.06)" : "none",
      }}
    >
      {children}
    </button>
  );
}

// ─── Composition list ─────────────────────────────────────────────────────────

function CompositionList({
  compositions,
  loaded,
  getToken,
  onDelete,
}: {
  compositions: CompositionItem[];
  loaded: boolean;
  getToken: () => Promise<string | null>;
  onDelete: (publicID: string) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<CompositionItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/compositions/${pendingDelete.public_id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok || res.status === 404) {
        onDelete(pendingDelete.public_id);
        setPendingDelete(null);
      }
    } catch {
      // leave item on network error
    } finally {
      setDeleting(false);
    }
  }

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

  if (compositions.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <BookmarkCheck
          size={36}
          aria-hidden="true"
          style={{ color: T.inputBorder, margin: "0 auto 14px", display: "block" }}
        />
        <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 600, color: T.secondary }}>
          Nenhuma composição salva ainda
        </p>
        <p style={{ margin: 0, fontSize: "12.5px", lineHeight: 1.6, color: T.muted }}>
          Monte uma composição e clique em{" "}
          <span style={{ fontWeight: 600, color: T.primary }}>&ldquo;Salvar composição&rdquo;</span>{" "}
          para guardá-la aqui.
        </p>
      </div>
    );
  }

  return (
    <>
      <div>
        <p style={{ margin: "0 0 14px", fontSize: "11.5px", fontWeight: 600, color: T.muted, letterSpacing: "0.2px" }}>
          {compositions.length} composição{compositions.length !== 1 ? "ões" : ""} salva{compositions.length !== 1 ? "s" : ""}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {compositions.map((comp) => (
            <CompositionRow
              key={comp.public_id}
              comp={comp}
              onRequestDelete={setPendingDelete}
            />
          ))}
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDeleteDialog
          composition={pendingDelete}
          deleting={deleting}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) setPendingDelete(null); }}
        />
      )}
    </>
  );
}

function CompositionRow({
  comp,
  onRequestDelete,
}: {
  comp: CompositionItem;
  onRequestDelete: (comp: CompositionItem) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [trashHovered, setTrashHovered] = useState(false);

  const date = new Date(comp.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  const href = `/procedure?composition=${encodeURIComponent(comp.public_id)}`;

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block", textDecoration: "none",
        borderRadius: "10px",
        border: `1.5px solid ${hovered ? T.inputFocus : T.cardBorder}`,
        padding: "12px 14px",
        backgroundColor: hovered ? T.dropHover : T.surface,
        transition: "border-color 130ms ease, background-color 110ms ease",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px" }}>
        {/* Left: composition name + procedure + meta */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: "0 0 2px", fontSize: "13.5px", fontWeight: 700,
              color: T.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {comp.name}
          </p>
          <p
            style={{
              margin: "0 0 5px", fontSize: "11.5px", color: T.secondary,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {comp.sbn_procedure_name}
          </p>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: T.muted }}>{date}</span>
            {comp.auxiliaries_count > 0 && (
              <span style={{ fontSize: "10.5px", fontWeight: 600, color: T.teal, background: "#CCFBF1", borderRadius: "4px", padding: "1px 6px" }}>
                {comp.auxiliaries_count} aux.
              </span>
            )}
            {comp.requires_anesthesia && (
              <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#6D28D9", background: "#EDE9FE", borderRadius: "4px", padding: "1px 6px" }}>
                Anest.
              </span>
            )}
            <span style={{ fontSize: "10.5px", color: T.muted }}>
              {comp.access_route_type === "same" ? "Mesma via" : "Vias diferentes"}
            </span>
          </div>
        </div>

        {/* Right: delete */}
        <button
          type="button"
          aria-label="Remover composição"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRequestDelete(comp); }}
          onMouseEnter={() => setTrashHovered(true)}
          onMouseLeave={() => setTrashHovered(false)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "30px", height: "30px",
            border: `1px solid ${trashHovered ? "#FECACA" : T.cardBorder}`,
            borderRadius: "7px",
            backgroundColor: trashHovered ? "#FFF1F1" : "transparent",
            color: trashHovered ? "#DC2626" : T.muted,
            cursor: "pointer",
            transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
            flexShrink: 0, marginTop: "2px",
          }}
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
    </Link>
  );
}

// ─── Confirm delete dialog ────────────────────────────────────────────────────

function ConfirmDeleteDialog({
  composition,
  deleting,
  onConfirm,
  onCancel,
}: {
  composition: CompositionItem;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const [cancelHovered, setCancelHovered] = useState(false);
  const [confirmHovered, setConfirmHovered] = useState(false);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
        backgroundColor: "rgba(15,23,42,0.42)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        animation: "fadeIn 120ms ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "380px",
          backgroundColor: "#FFFFFF",
          borderRadius: "18px",
          border: "1px solid rgba(226,232,240,0.9)",
          padding: "28px 28px 24px",
          boxShadow:
            "0 4px 6px rgba(15,23,42,0.06), 0 12px 32px rgba(15,23,42,0.14), 0 32px 56px -8px rgba(15,23,42,0.10)",
          animation: "slideUp 160ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Icon */}
        <div style={{
          width: "46px", height: "46px", borderRadius: "50%",
          backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "18px",
        }}>
          <Trash2 size={20} aria-hidden="true" style={{ color: "#DC2626" }} />
        </div>

        {/* Title */}
        <h2 id="confirm-delete-title" style={{
          margin: "0 0 8px", fontSize: "16px", fontWeight: 700,
          color: T.primary, letterSpacing: "-0.2px", lineHeight: 1.2,
        }}>
          Remover composição?
        </h2>

        {/* Body */}
        <p style={{
          margin: "0 0 26px", fontSize: "13.5px", lineHeight: 1.6,
          color: T.secondary,
        }}>
          A composição{" "}
          <span style={{ fontWeight: 700, color: T.primary }}>
            &ldquo;{composition.name}&rdquo;
          </span>{" "}
          será removida permanentemente. Esta ação não pode ser desfeita.
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            onMouseEnter={() => setCancelHovered(true)}
            onMouseLeave={() => setCancelHovered(false)}
            style={{
              flex: 1, height: "40px", borderRadius: "10px",
              border: `1.5px solid ${cancelHovered ? "#CBD5E1" : "#E2E8F0"}`,
              backgroundColor: cancelHovered ? "#F8FAFC" : "transparent",
              color: T.secondary, fontSize: "13.5px", fontWeight: 600,
              fontFamily: "inherit", cursor: deleting ? "default" : "pointer",
              transition: "background-color 120ms ease, border-color 120ms ease",
              opacity: deleting ? 0.5 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            onMouseEnter={() => setConfirmHovered(true)}
            onMouseLeave={() => setConfirmHovered(false)}
            style={{
              flex: 1, height: "40px", borderRadius: "10px",
              border: "none",
              backgroundColor: deleting ? "#FCA5A5" : confirmHovered ? "#B91C1C" : "#DC2626",
              color: "#FFFFFF", fontSize: "13.5px", fontWeight: 600,
              fontFamily: "inherit", cursor: deleting ? "default" : "pointer",
              transition: "background-color 120ms ease",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            }}
          >
            {deleting
              ? <><span style={{ width: "13px", height: "13px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Removendo...</>
              : "Remover"}
          </button>
        </div>
      </div>
    </div>,
    document.body
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
