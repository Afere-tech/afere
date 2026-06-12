# Calculation Auditor — Worked Valuation Examples

These examples serve as canonical references for the `calculation-auditor` skill. They demonstrate the required level of rigor: every input stated, every intermediate step shown, every rule cited.

All examples use a UC (Unidade de Cobrança) reference value of **R$ 1,00** to isolate the formula from monetary inflation. In production, substitute the actual UC value configured in Afere.

---

## Example 1: Single Procedure, Single Auxiliary

### Scenario

A neurosurgeon performs a lumbar microdiscectomy. One auxiliary surgeon is present.

### Inputs

| Input                  | Value          | Source                    |
|------------------------|----------------|---------------------------|
| Procedure              | Microdiscectomia lombar | Clinical selection  |
| CBHPM Code             | 3.06.04.50-0   | CBHPM 5ª Edição, p. 312   |
| Porte                  | 14             | CBHPM tabela de portes     |
| UC Value               | R$ 1,00        | Configuration              |
| Access Route           | Único (posterior lombar) | Surgeon input     |
| Number of Auxiliaries  | 1              | Surgeon input              |
| Patient Age            | 42 anos        | Surgeon input              |
| Pediatric Adjustment   | None           | Age > 12 anos              |

### Domain Rules Applied

1. **Honorário base do cirurgião** = Porte × UC — CBHPM, Capítulo 4, §1
2. **Auxiliar (1º)** = 30% do honorário do cirurgião — CBHPM, Item 5.1

### Formula

```
honorario_cirurgiao = porte × UC
honorario_cirurgiao = 14 × 1,00

honorario_auxiliar_1 = honorario_cirurgiao × 0,30   // CBHPM Item 5.1
```

### Intermediate Values

```
honorario_cirurgiao   = 14 × 1,00     = R$ 14,00
honorario_auxiliar_1  = 14,00 × 0,30  = R$ 4,20
```

### Final Result

| Destinatário     | Valor     |
|------------------|-----------|
| Cirurgião        | R$ 14,00  |
| Auxiliar 1       | R$ 4,20   |
| **Total**        | **R$ 18,20** |

### Documentation Source

- CBHPM 5ª Edição, Capítulo 4 §1: Cálculo base do honorário
- CBHPM 5ª Edição, Item 5.1: Remuneração do 1º auxiliar (30%)

---

## Example 2: Two Procedures, Same Access Route (Item 4.1)

### Scenario

A neurosurgeon performs a lumbar microdiscectomy and, through the same posterior access, a laminectomy at an adjacent level. Two auxiliary surgeons are present.

### Inputs

| Input                  | Value                           | Source                    |
|------------------------|---------------------------------|---------------------------|
| Procedure 1            | Microdiscectomia lombar         | Clinical selection         |
| CBHPM Code 1           | 3.06.04.50-0                    | CBHPM 5ª Edição, p. 312   |
| Porte 1                | 14                              | CBHPM tabela de portes     |
| Procedure 2            | Laminectomia                    | Clinical selection         |
| CBHPM Code 2           | 3.06.04.24-1                    | CBHPM 5ª Edição, p. 309   |
| Porte 2                | 10                              | CBHPM tabela de portes     |
| UC Value               | R$ 1,00                         | Configuration              |
| Access Route           | Único (posterior lombar)        | Surgeon input              |
| Number of Auxiliaries  | 2                               | Surgeon input              |
| Pediatric Adjustment   | None                            | Age > 12 anos              |

### Domain Rules Applied

1. **Procedimento principal** = procedimento de maior porte. Em caso de empate, o cirurgião seleciona — CBHPM Item 4.1, §1
2. **Procedimento principal** valorado a 100% — CBHPM Item 4.1, §2
3. **2º procedimento (mesmo acesso)** valorado a 50% do seu porte — CBHPM Item 4.1, §2
4. **Auxiliar (1º)** = 30% do honorário total do cirurgião — CBHPM Item 5.1
5. **Auxiliar (2º)** = 30% do honorário do 1º auxiliar — CBHPM Item 5.2

### Formula

```
// Ordenação por porte (maior = principal)
procedimento_principal   = procedimento com porte 14 (Microdiscectomia)
procedimento_secundario  = procedimento com porte 10 (Laminectomia)

// Honorário do cirurgião
honorario_cirurgiao = (porte_1 × UC × 1,00) + (porte_2 × UC × 0,50)

// Auxiliares
honorario_auxiliar_1 = honorario_cirurgiao × 0,30        // CBHPM 5.1
honorario_auxiliar_2 = honorario_auxiliar_1 × 0,30       // CBHPM 5.2
```

### Intermediate Values

```
parcela_procedimento_1  = 14 × 1,00 × 1,00  = R$ 14,00
parcela_procedimento_2  = 10 × 1,00 × 0,50  = R$ 5,00

honorario_cirurgiao     = 14,00 + 5,00      = R$ 19,00

honorario_auxiliar_1    = 19,00 × 0,30      = R$ 5,70
honorario_auxiliar_2    = 5,70  × 0,30      = R$ 1,71
```

### Final Result

| Destinatário     | Valor     |
|------------------|-----------|
| Cirurgião        | R$ 19,00  |
| Auxiliar 1       | R$ 5,70   |
| Auxiliar 2       | R$ 1,71   |
| **Total**        | **R$ 26,41** |

### Documentation Source

- CBHPM 5ª Edição, Item 4.1 §1: Definição de procedimento principal
- CBHPM 5ª Edição, Item 4.1 §2: Percentuais para procedimentos no mesmo acesso (100% + 50%)
- CBHPM 5ª Edição, Item 5.1: Remuneração do 1º auxiliar (30%)
- CBHPM 5ª Edição, Item 5.2: Remuneração do 2º auxiliar (30% do auxiliar 1)

---

## Example 3: Two Procedures, Different Access Routes (Item 4.2)

### Scenario

A neurosurgeon performs a craniotomy for brain tumor resection and, through a separate lumbar access, a lumbar drain placement. Two different access routes — cranial and posterior lumbar. One auxiliary surgeon is present.

### Inputs

| Input                   | Value                              | Source                    |
|-------------------------|------------------------------------|---------------------------|
| Procedure 1             | Craniotomia para ressecção tumoral | Clinical selection         |
| CBHPM Code 1            | 3.06.01.30-0                       | CBHPM 5ª Edição, p. 287   |
| Porte 1                 | 22                                 | CBHPM tabela de portes     |
| Access Route 1          | Cranial                            | Surgeon input              |
| Procedure 2             | Derivação lombar externa           | Clinical selection         |
| CBHPM Code 2            | 3.06.03.10-0                       | CBHPM 5ª Edição, p. 305   |
| Porte 2                 | 8                                  | CBHPM tabela de portes     |
| Access Route 2          | Posterior lombar                   | Surgeon input              |
| UC Value                | R$ 1,00                            | Configuration              |
| Number of Auxiliaries   | 1                                  | Surgeon input              |
| Pediatric Adjustment    | None                               | Age > 12 anos              |

### Domain Rules Applied

1. **Acessos diferentes** → cada grupo de acesso valorado de forma independente — CBHPM Item 4.2, §1
2. **Dentro de cada grupo**, aplicam-se as regras do Item 4.1 — CBHPM Item 4.2, §2
3. Com um único procedimento por acesso, cada um é valorado a 100% — CBHPM Item 4.1 §2 (aplicado por grupo)
4. **Honorário total do cirurgião** = soma dos honorários de cada grupo de acesso
5. **Auxiliar (1º)** = 30% do honorário total do cirurgião — CBHPM Item 5.1

### Formula

```
// Grupo 1: acesso cranial
honorario_grupo_cranial  = porte_1 × UC × 1,00

// Grupo 2: acesso lombar
honorario_grupo_lombar   = porte_2 × UC × 1,00

// Total do cirurgião
honorario_cirurgiao = honorario_grupo_cranial + honorario_grupo_lombar

// Auxiliar
honorario_auxiliar_1 = honorario_cirurgiao × 0,30
```

### Intermediate Values

```
honorario_grupo_cranial  = 22 × 1,00 × 1,00 = R$ 22,00
honorario_grupo_lombar   = 8  × 1,00 × 1,00 = R$ 8,00

honorario_cirurgiao      = 22,00 + 8,00     = R$ 30,00

honorario_auxiliar_1     = 30,00 × 0,30     = R$ 9,00
```

### Final Result

| Destinatário     | Valor     |
|------------------|-----------|
| Cirurgião        | R$ 30,00  |
| Auxiliar 1       | R$ 9,00   |
| **Total**        | **R$ 39,00** |

### Documentation Source

- CBHPM 5ª Edição, Item 4.2 §1: Valoração independente por acesso cirúrgico
- CBHPM 5ª Edição, Item 4.2 §2: Aplicação das regras do Item 4.1 dentro de cada grupo
- CBHPM 5ª Edição, Item 5.1: Remuneração do 1º auxiliar (30% do total do cirurgião)

---

## Example 4: Pediatric Adjustment (Item 4.6)

### Scenario

A neurosurgeon performs a ventriculoperitoneal shunt placement on a 4-year-old child. One auxiliary surgeon.

### Inputs

| Input                  | Value                              | Source                    |
|------------------------|------------------------------------|---------------------------|
| Procedure              | Derivação ventriculoperitoneal     | Clinical selection         |
| CBHPM Code             | 3.06.02.10-0                       | CBHPM 5ª Edição, p. 297   |
| Porte                  | 16                                 | CBHPM tabela de portes     |
| UC Value               | R$ 1,00                            | Configuration              |
| Access Route           | Único                              | Surgeon input              |
| Number of Auxiliaries  | 1                                  | Surgeon input              |
| Patient Age            | 4 anos                             | Surgeon input              |
| Pediatric Adjustment   | Item 4.6 (menor de 7 anos)         | Age < 7 anos               |

### Domain Rules Applied

1. **Honorário base** = Porte × UC — CBHPM Capítulo 4 §1
2. **Acréscimo pediátrico Item 4.6** (menor de 7 anos) = +30% sobre o honorário base do cirurgião — CBHPM Item 4.6
3. **Auxiliar (1º)** = 30% do honorário ajustado do cirurgião — CBHPM Item 5.1

### Formula

```
honorario_base_cirurgiao     = porte × UC
acrescimo_pediatrico         = honorario_base_cirurgiao × 0,30   // CBHPM Item 4.6
honorario_ajustado_cirurgiao = honorario_base_cirurgiao + acrescimo_pediatrico

honorario_auxiliar_1         = honorario_ajustado_cirurgiao × 0,30
```

### Intermediate Values

```
honorario_base_cirurgiao     = 16 × 1,00          = R$ 16,00
acrescimo_pediatrico         = 16,00 × 0,30        = R$ 4,80
honorario_ajustado_cirurgiao = 16,00 + 4,80        = R$ 20,80

honorario_auxiliar_1         = 20,80 × 0,30        = R$ 6,24
```

### Final Result

| Destinatário         | Valor       |
|----------------------|-------------|
| Cirurgião (ajustado) | R$ 20,80    |
| Auxiliar 1           | R$ 6,24     |
| **Total**            | **R$ 27,04** |

### Documentation Source

- CBHPM 5ª Edição, Item 4.6: Acréscimo de 30% para pacientes menores de 7 anos
- CBHPM 5ª Edição, Item 5.1: Base de cálculo do auxiliar = honorário ajustado do cirurgião

### Risk Note

The pediatric multiplier (30%) applies to the surgeon's honorarium **before** computing the auxiliary fee. If the auxiliary base is incorrectly set to the unadjusted porte value, the auxiliary will be underpaid and the total will be wrong. This ordering dependency must be enforced in code.

---

## Example 5: Three Procedures, Same Access Route, Two Auxiliaries

### Scenario

A neurosurgeon performs an anterior cervical discectomy, an anterior cervical fusion at the same level, and foraminotomy at an adjacent level, all through the same anterior cervical access. Two auxiliary surgeons.

### Inputs

| Input                  | Value                               | Source                    |
|------------------------|-------------------------------------|---------------------------|
| Procedure 1            | Discectomia cervical anterior       | Clinical selection         |
| CBHPM Code 1           | 3.06.04.10-1                        | CBHPM 5ª Edição, p. 307   |
| Porte 1                | 14                                  | CBHPM tabela de portes     |
| Procedure 2            | Artrodese cervical anterior         | Clinical selection         |
| CBHPM Code 2           | 3.06.04.12-8                        | CBHPM 5ª Edição, p. 307   |
| Porte 2                | 12                                  | CBHPM tabela de portes     |
| Procedure 3            | Foraminotomia cervical anterior     | Clinical selection         |
| CBHPM Code 3           | 3.06.04.14-4                        | CBHPM 5ª Edição, p. 308   |
| Porte 3                | 8                                   | CBHPM tabela de portes     |
| UC Value               | R$ 1,00                             | Configuration              |
| Access Route           | Único (anterior cervical)           | Surgeon input              |
| Number of Auxiliaries  | 2                                   | Surgeon input              |
| Pediatric Adjustment   | None                                | Age > 12 anos              |

### Domain Rules Applied

1. **Procedimento principal** = maior porte → Procedimento 1 (porte 14) — CBHPM Item 4.1 §1
2. **2º procedimento** valorado a 50% — CBHPM Item 4.1 §2
3. **3º procedimento** valorado a 50% — CBHPM Item 4.1 §2 (mesmo percentual para o 3º)
4. **Auxiliar 1** = 30% do honorário do cirurgião — CBHPM Item 5.1
5. **Auxiliar 2** = 30% do honorário do Auxiliar 1 — CBHPM Item 5.2

### Formula

```
// Ordenação: 14 > 12 > 8
honorario_cirurgiao = (14 × UC × 1,00) + (12 × UC × 0,50) + (8 × UC × 0,50)

honorario_auxiliar_1 = honorario_cirurgiao × 0,30
honorario_auxiliar_2 = honorario_auxiliar_1 × 0,30
```

### Intermediate Values

```
parcela_proc_1      = 14 × 1,00 × 1,00 = R$ 14,00
parcela_proc_2      = 12 × 1,00 × 0,50 = R$ 6,00
parcela_proc_3      =  8 × 1,00 × 0,50 = R$ 4,00

honorario_cirurgiao = 14,00 + 6,00 + 4,00 = R$ 24,00

honorario_auxiliar_1 = 24,00 × 0,30 = R$ 7,20
honorario_auxiliar_2 =  7,20 × 0,30 = R$ 2,16
```

### Final Result

| Destinatário     | Valor       |
|------------------|-------------|
| Cirurgião        | R$ 24,00    |
| Auxiliar 1       | R$ 7,20     |
| Auxiliar 2       | R$ 2,16     |
| **Total**        | **R$ 33,36** |

### Documentation Source

- CBHPM 5ª Edição, Item 4.1 §1: Seleção do procedimento principal por porte
- CBHPM 5ª Edição, Item 4.1 §2: 2º e 3º procedimentos no mesmo acesso valorados a 50%
- CBHPM 5ª Edição, Item 5.1: 1º auxiliar = 30% do cirurgião
- CBHPM 5ª Edição, Item 5.2: 2º auxiliar = 30% do 1º auxiliar

### Risk Note

The CBHPM Item 4.1 percentage for the 3rd and subsequent procedures must be verified against the current edition. Some editions apply a different rate to the 3rd procedure (e.g., 40% instead of 50%). This is a known area of ambiguity between CBHPM editions. Always cite the edition year when referencing these percentages.
