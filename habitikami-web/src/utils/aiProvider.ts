export type AIProvider = 'gemini' | 'anthropic';

export interface AIProviderConfig {
    provider: AIProvider;
    apiKey: string;
}

const GEMINI_KEY = 'habitikami_gemini_key';
const ANTHROPIC_KEY = 'habitikami_anthropic_key';

/**
 * Returns the active AI provider config.
 * Priority: Anthropic > Gemini
 */
export function getActiveProvider(): AIProviderConfig | null {
    const anthropicKey = localStorage.getItem(ANTHROPIC_KEY);
    const geminiKey = localStorage.getItem(GEMINI_KEY);

    if (anthropicKey) return { provider: 'anthropic', apiKey: anthropicKey };
    if (geminiKey) return { provider: 'gemini', apiKey: geminiKey };
    return null;
}

export function hasAnyProvider(): boolean {
    return getActiveProvider() !== null;
}

export function getGeminiKey(): string {
    return localStorage.getItem(GEMINI_KEY) || '';
}

export function getAnthropicKey(): string {
    return localStorage.getItem(ANTHROPIC_KEY) || '';
}

export function setGeminiKey(key: string) {
    if (key) localStorage.setItem(GEMINI_KEY, key);
    else localStorage.removeItem(GEMINI_KEY);
}

export function setAnthropicKey(key: string) {
    if (key) localStorage.setItem(ANTHROPIC_KEY, key);
    else localStorage.removeItem(ANTHROPIC_KEY);
}

export function clearAllKeys() {
    localStorage.removeItem(GEMINI_KEY);
    localStorage.removeItem(ANTHROPIC_KEY);
}

export function getProviderLabel(provider: AIProvider): string {
    return provider === 'anthropic' ? 'Claude (Anthropic)' : 'Gemini (Google)';
}

interface AIMessage {
    role: 'user' | 'model';
    content: string;
}

/**
 * Extract JSON from a response that might contain extra text
 */
function extractJSON(text: string): string {
    // Try direct parse first
    try {
        JSON.parse(text);
        return text;
    } catch {
        // noop
    }

    // Try to find a JSON object in the text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
        try {
            JSON.parse(match[0]);
            return match[0];
        } catch {
            // noop
        }
    }

    throw new Error('No valid JSON found in response');
}

/**
 * Unified AI call that handles both Gemini and Anthropic providers.
 * Returns the raw text response (JSON string) from the AI.
 */
export async function callAI(
    config: AIProviderConfig,
    systemPrompt: string,
    systemAck: string,
    messages: AIMessage[],
    accessToken: string | null,
    responseFormat: 'json' | 'text' = 'json',
): Promise<string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    if (config.provider === 'anthropic') {
        const anthropicMessages = messages.map(msg => ({
            role: msg.role === 'model' ? 'assistant' as const : 'user' as const,
            content: msg.content,
        }));

        if (anthropicMessages.length === 0) {
            console.error('[AI] Attempted to call Anthropic with zero messages. System Prompt:', systemPrompt);
            throw new Error('AI Provider error: At least one message is required for Anthropic.');
        }

        const response = await fetch('/api/anthropic/chat', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                apiKey: config.apiKey,
                system: systemPrompt,
                messages: anthropicMessages,
            }),
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'Communication error with Anthropic');
        }

        const data = await response.json();
        const textResponse = data.content?.[0]?.text;
        if (!textResponse) throw new Error('Empty response from AI');
        return responseFormat === 'json' ? extractJSON(textResponse) : textResponse;
    } else {
        const apiMessages = [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: systemAck }] },
            ...messages.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.content }],
            })),
        ];

        const body: any = {
            apiKey: config.apiKey,
            contents: apiMessages,
        };

        if (responseFormat === 'json') {
            body.generationConfig = {
                responseMimeType: 'application/json',
            };
        }

        const response = await fetch('/api/gemini/chat', {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'Communication error with Gemini');
        }

        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) throw new Error('Empty response from AI');
        return responseFormat === 'json' ? extractJSON(textResponse) : textResponse;
    }
}
