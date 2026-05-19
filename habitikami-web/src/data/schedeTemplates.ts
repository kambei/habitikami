export interface SchedaTemplate {
    id: string;
    titleKey: string;
    descriptionKey: string;
    template: string;
    systemPromptKey: string;
}

export const schedeTemplates: SchedaTemplate[] = [
    {
        id: 'diario-emozioni',
        titleKey: 'schedaDiarioTitle',
        descriptionKey: 'schedaDiarioDesc',
        systemPromptKey: 'schedaDiarioPrompt',
        template: `# Diario delle Emozioni (Scheda 18b)

## Episodio

**Data:** {{data}}
**Situazione:** {{situazione}}

### 1. Emozione
- **Tipo:** {{emozione_tipo}}
- **Intensità (0-100):** {{emozione_intensita}}

### 2. Sintomi percepiti
| Sintomo | Intensità (0-100) |
|---|---|
| {{sintomo_1}} | {{sintomo_1_intensita}} |
| {{sintomo_2}} | {{sintomo_2_intensita}} |
| {{sintomo_3}} | {{sintomo_3_intensita}} |

### 3. Pensiero automatico
- **Cosa ho pensato stesse succedendo?** {{pensiero_automatico}}
- **Grado di convinzione (0-100):** {{convinzione}}

### 4. Interpretazioni alternative
- **Quale potrebbe essere uno scenario alternativo?** {{scenario_alternativo}}
- **Rivaluto la convinzione nel pensiero automatico (0-100):** {{convinzione_rivalutata}}

### 5. Emozioni alternative
- **Quale emozione sperimenterei nello scenario alternativo?** {{emozione_alternativa}}
- **Intensità rivalutata (0-100):** {{intensita_rivalutata}}
- **Altre interpretazioni / scenari di contorno:** {{altre_interpretazioni}}

---

### Note
{{note}}`,
    },
    {
        id: 'ristrutturazione-cognitiva',
        titleKey: 'schedaRistrutturazioneTitle',
        descriptionKey: 'schedaRistrutturazioneDesc',
        systemPromptKey: 'schedaRistrutturazionePrompt',
        template: `# Scheda per la Ristrutturazione Cognitiva (Panico)

> Compila tenendo a mente una situazione in cui hai sperimentato il panico.

**Data:** {{data}}
**Situazione:** {{situazione}}

| Sintomo | Pensiero automatico | Ansia (0-100) | Già provato in altri contesti? | Pensiero alternativo | Ansia (0-100) |
|---|---|---|---|---|---|
| {{sintomo_1}} | {{pensiero_1}} | {{ansia_1}} | {{contesto_1}} | {{alternativo_1}} | {{ansia_alt_1}} |
| {{sintomo_2}} | {{pensiero_2}} | {{ansia_2}} | {{contesto_2}} | {{alternativo_2}} | {{ansia_alt_2}} |
| {{sintomo_3}} | {{pensiero_3}} | {{ansia_3}} | {{contesto_3}} | {{alternativo_3}} | {{ansia_alt_3}} |

### Note
{{note}}`,
    },
    {
        id: 'antipanico-prima',
        titleKey: 'schedaAntipanicoPrimaTitle',
        descriptionKey: 'schedaAntipanicoPrimaDesc',
        systemPromptKey: 'schedaAntipanicoPrimaPrompt',
        template: `# Protocollo Anti-Panico — PRIMA

## Diario dei Segnali Precoci

**Data:** {{data}}

### Identificazione dei Trigger

| Situazione Esterna | Sensazione Fisica (Iniziale) | Primo Pensiero di Allerta |
|---|---|---|
| {{situazione_esterna}} | {{sensazione_fisica}} | {{pensiero_allerta}} |

### Strategia di Risposta Anticipata
{{strategia_anticipata}}

---

## Gerarchia della Paura

*Situazioni temute in ordine di intensità (0-100)*

- **Lieve (20-40):** {{paura_lieve}}
- **Moderato (50-70):** {{paura_moderato}}
- **Intenso (80-100):** {{paura_intenso}}

### Obiettivo Finale
*Cosa vorrei fare se non avessi paura?*
{{obiettivo_finale}}

---

### Note
{{note}}`,
    },
    {
        id: 'antipanico-durante',
        titleKey: 'schedaAntipanicoDuranteTitle',
        descriptionKey: 'schedaAntipanicoDuranteDesc',
        systemPromptKey: 'schedaAntipanicoDurantePrompt',
        template: `# Protocollo Anti-Panico — DURANTE

**Data:** {{data}}

## Defusione Cognitiva

- **Pensiero "Fuso":** {{pensiero_fuso}}
- **Pensiero "Defuso":** {{pensiero_defuso}}

### Spazio di Osservazione Libera
*Scrivi i pensieri come se fossero nuvole che passano.*
{{osservazione_libera}}

---

## Tecnica 5-4-3-2-1

| Senso | Elementi percepiti |
|---|---|
| 5 Vista | {{vista}} |
| 4 Tatto | {{tatto}} |
| 3 Udito | {{udito}} |
| 2 Olfatto | {{olfatto}} |
| 1 Gusto | {{gusto}} |

---

## Accettazione Radicale

### Mapping delle Sensazioni Fisiche
- **Dove sento l'ansia nel corpo:** {{localizzazione_ansia}}
- **Forma/Colore della sensazione:** {{forma_colore}}
- **Temperatura:** {{temperatura}}

### Affermazione di Impegno
{{affermazione_impegno}}

---

### Note
{{note}}`,
    },
    {
        id: 'antipanico-dopo',
        titleKey: 'schedaAntipanicoDopoTitle',
        descriptionKey: 'schedaAntipanicoDopoDesc',
        systemPromptKey: 'schedaAntipanicoDopoPrompt',
        template: `# Protocollo Anti-Panico — DOPO

**Data:** {{data}}

## Analisi di Realtà

| Catastrofe prevista | Esito reale | Grado di discrepanza |
|---|---|---|
| {{catastrofe_prevista}} | {{esito_reale}} | {{discrepanza}} |

**Cosa ho imparato sulla mia capacità di resistere?**
{{lezione_resistenza}}

---

## Ristrutturazione Sintomi

| Sintomo | Pensiero Catastrofico | Spiegazione Medica | Nuovo Pensiero |
|---|---|---|---|
| {{sintomo_1}} | {{catastrofico_1}} | {{medica_1}} | {{nuovo_1}} |
| {{sintomo_2}} | {{catastrofico_2}} | {{medica_2}} | {{nuovo_2}} |
| {{sintomo_3}} | {{catastrofico_3}} | {{medica_3}} | {{nuovo_3}} |

---

## Risorse e Successi

- **Cosa ha funzionato:** {{cosa_funzionato}}
- **Vittorie di oggi:** {{vittorie}}

### Lettera al "Me Futuro" in preda al panico
{{lettera_me_futuro}}

---

## La Bussola ACT

- **La vita che voglio (3 valori guida):** {{valori_guida}}
- **Azioni Impegnate:** {{azioni_impegnate}}

> "Non scelgo l'ansia, scelgo la direzione verso cui camminare."

---

### Note
{{note}}`,
    },
];
