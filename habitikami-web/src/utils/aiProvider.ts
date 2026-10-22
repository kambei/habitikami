export type AIProvider = 'gemini' | 'anthropic';

export interface AIProviderConfig {
    provider: AIProvider;
    /** Empty when the server's shared key is used (issue #25). */
    apiKey: string;
    shared?: boolean;
}

const GEMINI_KEY = 'habitikami_gemini_key';
const ANTHROPIC_KEY = 'habitikami_anthropic_key';
const SHARED_PROVIDER_KEY = 'habitikami_ai_shared_provider';

/** Remembers that the server offers a shared key for `provider` (null to forget). */
export function setSharedProvider(provider: AIProvider | null) {
    if (provider) localStorage.setItem(SHARED_PROVIDER_KEY, provider);
    else localStorage.removeItem(SHARED_PROVIDER_KEY);
}

export function getSharedProvider(): AIProvider | null {
    const v = localStorage.getItem(SHARED_PROVIDER_KEY);
    return v === 'gemini' || v === 'anthropic' ? v : null;
}

/**
 * Returns the active AI provider config.
 * Priority: Anthropic > Gemini > the server's shared key
 */
export function getActiveProvider(): AIProviderConfig | null {
    const anthropicKey = localStorage.getItem(ANTHROPIC_KEY);
    const geminiKey = localStorage.getItem(GEMINI_KEY);

    if (anthropicKey) return { provider: 'anthropic', apiKey: anthropicKey };
    if (geminiKey) return { provider: 'gemini', apiKey: geminiKey };
    const shared = getSharedProvider();
    if (shared) return { provider: shared, apiKey: '', shared: true };
    return null;
}

export interface AIStatus { shared: { provider: AIProvider; quota: number; remaining: number } | null }

/** Asks the server whether a shared key exists and remembers it. */
export async function fetchAiStatus(accessToken: string | null): Promise<AIStatus | null> {
    try {
        const res = await fetch('/api/ai/status', { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
        if (!res.ok) return null;
        const data = (await res.json()) as AIStatus;
        setSharedProvider(data.shared?.provider ?? null);
        return data;
    } catch {
        return null;
    }
}

/** Tries the key with a tiny request through the server. */
export async function validateApiKey(provider: AIProvider, apiKey: string, accessToken: string | null): Promise<{ valid: boolean; error?: string }> {
    const res = await fetch('/api/ai/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ provider, apiKey }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { valid: false, error: data.error || `HTTP ${res.status}` };
    return data;
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

export const PROVIDER_CONSOLE_URL: Record<AIProvider, string> = {
    gemini: 'https://aistudio.google.com/app/apikey',
    anthropic: 'https://console.anthropic.com/settings/keys',
};

/**
 * A binary attachment (image or PDF) to send alongside a user message.
 * `dataBase64` is the raw base64 payload, WITHOUT the `data:...;base64,` prefix.
 */
export interface AIAttachment {
    mediaType: string; // e.g. 'application/pdf', 'image/png', 'image/jpeg'
    dataBase64: string;
}

interface AIMessage {
    role: 'user' | 'model';
    content: string;
    attachments?: AIAttachment[];
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
        const anthropicMessages = messages.map(msg => {
            const role = msg.role === 'model' ? 'assistant' as const : 'user' as const;
            if (!msg.attachments || msg.attachments.length === 0) {
                return { role, content: msg.content };
            }
            // Multimodal: text block + one block per attachment (image or PDF document).
            const blocks: any[] = [{ type: 'text', text: msg.content }];
            for (const att of msg.attachments) {
                const source = { type: 'base64', media_type: att.mediaType, data: att.dataBase64 };
                blocks.push(
                    att.mediaType === 'application/pdf'
                        ? { type: 'document', source }
                        : { type: 'image', source },
                );
            }
            return { role, content: blocks };
        });

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
            const errData = await response.json().catch(() => null);
            throw new Error((typeof errData?.error === 'string' ? errData.error : errData?.error?.message) || `Communication error with Anthropic (HTTP ${response.status})`);
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
                parts: [
                    { text: msg.content },
                    ...(msg.attachments || []).map(att => ({
                        inline_data: { mime_type: att.mediaType, data: att.dataBase64 },
                    })),
                ],
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
            const errData = await response.json().catch(() => null);
            throw new Error((typeof errData?.error === 'string' ? errData.error : errData?.error?.message) || `Communication error with Gemini (HTTP ${response.status})`);
        }

        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) throw new Error('Empty response from AI');
        return responseFormat === 'json' ? extractJSON(textResponse) : textResponse;
    }
}
