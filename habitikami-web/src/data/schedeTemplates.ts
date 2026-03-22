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
];
