"""
generate_catalog.py — Two-phase ETL for the Afere procedure catalog.

Phase 1 (parse_catalog): Parses the SBN MCPN PDF to extract (procedure_name,
    cbhpm_code, description, porte) rows. Requires pdftotext -layout (poppler).

Phase 2 (enrich_from_cbhpm_2022): Reads the CBHPM 2022 PDF (pdfplumber) to
    extract the N° de Aux. column for each Chapter-3 surgical code and merges
    those counts into the catalog before writing procedures.json.

Usage:
    python3 data/generate_catalog.py

Dependencies:
    Phase 1: poppler-utils (pdftotext)
    Phase 2: pdfplumber (pip install pdfplumber)

If pdftotext is unavailable, Phase 1 is skipped and procedures.json is only
enriched with auxiliary counts (Phase 2 only).
"""

import json
import re
import subprocess
import pdfplumber
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SBN_PDF = ROOT / "data" / "raw_pdfs" / "cbac6c_d991322923c24d01b46e1fdd39af6e73.pdf"
CBHPM_2022_PDF = ROOT / "data" / "raw_pdfs" / "CBHPM-2022_versao-agosto-2023.pdf"
OUTPUT_JSON = ROOT / "backend" / "internal" / "repository" / "procedures.json"

FIELD_LABELS = (
    "Descrição do",
    "procedimento",
    "CIDs do Procedimento",
    "Indicação",
    "Caráter da Indicação",
    "Contra-Indicação",
    "Exames da Indicação",
    "Códigos CBHPM",
    "OPMEs",
    "Internação Dias",
    "Anestesia",
    "Materiais Especiais",
    "Resolutividade",
    "Seguimento",
    "Rastreabilidade",
    "Comentários",
)

TEXT_REPLACEMENTS = (
    (r"\bPOS-OPERATÓRIO\b", "PÓS-OPERATÓRIO"),
    (r"\bpos-operatória\b", "pós-operatória"),
    (r"\bpos-operatório\b", "pós-operatório"),
    (r"\bcirurgico\b", "cirúrgico"),
    (r"\bcirurgica\b", "cirúrgica"),
    (r"\bmusculo\b", "músculo"),
    (r"\bclinica\b", "clínica"),
    (r"\bRessonancia\b", "Ressonância"),
    (r"\bmetastase\b", "metástase"),
    (r"\bprimaria\b", "primária"),
    (r"\bsecundaria\b", "secundária"),
    (r"\bDiario\b", "Diário"),
    (r"\bDiagnostico\b", "Diagnóstico"),
    (r"\betiologico\b", "etiológico"),
    (r"\bsequela neurologica\b", "sequela neurológica"),
    (r"\bmalformaçoes\b", "malformações"),
    (r"\bLiquórica\b", "liquórica"),
)

# CBHPM 2022 surgical table line format (Chapter 3 only):
#   {code}  {description}  {porte}  {custo_oper}  {n_aux}  {anest}
#
# custo_oper: integer, decimal (33,800), or dash (–)
# n_aux:      integer or dash (– means 0 auxiliaries)
# anest:      integer or dash
#
# Chapters 1 (Consultas), 2 (Clínica), and 4 (Diagnóstico) have no N° Aux
# column at all; codes from those chapters default to 0 in the caller.
_CBHPM_LINE_RE = re.compile(
    r"^(\d\.\d{2}\.\d{2}\.\d{2}-\d)"      # CBHPM code
    r"\s+(.+?)"                              # description (non-greedy)
    r"\s+(\d{1,2}[A-C])"                    # porte
    r"\s+(?:[–\-]|\d+(?:[,.]\d+)?)"         # custo_oper (ignored)
    r"\s+([–\-]|\d+)"                        # N° de Aux  ← captured
    r"\s+(?:[–\-]|\d+)"                      # anest (ignored)
    r"\s*$"
)


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_pt_br(value: str) -> str:
    value = normalize_spaces(value)
    for pattern, replacement in TEXT_REPLACEMENTS:
        value = re.sub(pattern, replacement, value)
    return value


def is_field_line(line: str) -> bool:
    stripped = line.strip()
    return any(stripped.startswith(label) for label in FIELD_LABELS)


def clean_procedure_name(value: str) -> str:
    value = normalize_pt_br(value)
    value = re.sub(r"^\d+(?:\.\d+)*\s*[-–]\s*", "", value)
    return value


def split_code_line(line: str):
    match = re.match(r"\s*(\d\.\d{2}\.\d{2}\.\d{2}-\d)\s+(.+?)\s+(\d{1,2}[A-C])\s*$", line)
    if not match:
        return None
    return {
        "cbhpm_code": match.group(1),
        "description": normalize_pt_br(match.group(2)),
        "porte": match.group(3),
    }


def parse_catalog(text: str) -> list[dict]:
    """
    Parse the SBN MCPN PDF (plain text from pdftotext -layout) into a flat
    list of {procedure_name, cbhpm_code, description, porte} rows.
    """
    lines = text.splitlines()
    procedures: list[dict] = []
    current_name = None
    current_codes: list[dict] = []
    last_code = None
    collecting_name = False
    in_codes = False

    def flush_current():
        nonlocal current_name, current_codes, last_code
        if current_name:
            for item in current_codes:
                procedures.append(
                    {
                        "procedure_name": clean_procedure_name(current_name),
                        "cbhpm_code": item["cbhpm_code"],
                        "description": item["description"],
                        "porte": item["porte"],
                    }
                )
        current_name = None
        current_codes = []
        last_code = None

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        if stripped.startswith("Nome Procedimento"):
            flush_current()
            current_name = line.split("Nome Procedimento", 1)[1].strip()
            collecting_name = True
            in_codes = False
            continue

        if collecting_name:
            if is_field_line(line):
                collecting_name = False
            elif current_name is not None:
                current_name = f"{current_name} {stripped}"
                continue

        if stripped.startswith("Códigos CBHPM"):
            in_codes = True
            last_code = None
            continue

        if in_codes:
            if stripped.startswith("OPMEs") or stripped.startswith("Internação Dias"):
                in_codes = False
                last_code = None
                continue

            code_item = split_code_line(line)
            if code_item:
                current_codes.append(code_item)
                last_code = code_item
                continue

            if last_code and not is_field_line(line):
                last_code["description"] = normalize_pt_br(
                    f"{last_code['description']} {stripped}"
                )

    flush_current()
    return procedures


def parse_cbhpm_aux(pdf_path: Path) -> dict[str, int]:
    """
    Extract N° de Aux. values from the CBHPM 2022 PDF (Chapter 3 surgical table).

    Returns a dict mapping CBHPM code → num_auxiliaries.  Only Chapter-3 codes
    appear; Chapter-1, -2, and -4 codes have no such column and default to 0.
    """
    aux_by_code: dict[str, int] = {}
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            for line in text.splitlines():
                m = _CBHPM_LINE_RE.match(line)
                if m:
                    code = m.group(1)
                    n_aux_raw = m.group(4)
                    aux_by_code[code] = 0 if n_aux_raw in ("–", "-") else int(n_aux_raw)
    return aux_by_code


def enrich_with_aux(catalog: list[dict], aux_map: dict[str, int]) -> list[dict]:
    """Merge auxiliary counts into every catalog entry; default to 0 if absent."""
    for entry in catalog:
        entry["num_auxiliaries"] = aux_map.get(entry["cbhpm_code"], 0)
    return catalog


def main() -> None:
    # ── Phase 1: parse SBN MCPN PDF ──────────────────────────────────────────
    try:
        result = subprocess.run(
            ["pdftotext", "-layout", str(SBN_PDF), "-"],
            check=True, capture_output=True, text=True,
        )
        raw_text = result.stdout
        catalog = parse_catalog(raw_text)

        seen: set[tuple] = set()
        deduplicated: list[dict] = []
        for item in catalog:
            key = (item["cbhpm_code"], item["description"])
            if key not in seen:
                seen.add(key)
                deduplicated.append(item)

        print(
            f"Phase 1: parsed {len(deduplicated)} unique entries "
            f"(removed {len(catalog) - len(deduplicated)} duplicates)"
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(
            "Phase 1: pdftotext not available — loading existing procedures.json "
            "and only applying auxiliary-count enrichment."
        )
        deduplicated = json.loads(OUTPUT_JSON.read_text(encoding="utf-8"))

    # ── Phase 2: enrich with N° de Aux. from CBHPM 2022 ─────────────────────
    print(f"Phase 2: extracting N° Aux from {CBHPM_2022_PDF.name}…")
    aux_map = parse_cbhpm_aux(CBHPM_2022_PDF)
    print(f"  Found aux counts for {len(aux_map)} Chapter-3 CBHPM codes.")

    enriched = enrich_with_aux(deduplicated, aux_map)

    covered = sum(1 for e in enriched if e.get("num_auxiliaries", 0) > 0)
    not_in_ch3 = sorted(
        {e["cbhpm_code"] for e in enriched if e["cbhpm_code"] not in aux_map}
    )

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(
        json.dumps(enriched, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(enriched)} entries to {OUTPUT_JSON}")
    print(f"  {covered} entries have num_auxiliaries > 0")
    if not_in_ch3:
        print(
            f"  {len(not_in_ch3)} codes not in CBHPM 2022 Ch.3 table "
            f"(defaulted to 0 — correct for Ch.1/2/4):"
        )
        for c in not_in_ch3:
            print(f"    {c}")


if __name__ == "__main__":
    main()
