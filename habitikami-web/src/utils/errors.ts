/** Message and HTTP status of an unknown error (Error, gapi response, string). */
export function errorMessage(e: unknown, fallback = 'Unknown error'): string {
    if (!e) return fallback;
    if (typeof e === 'string') return e;
    const err = e as { result?: { error?: { message?: string } }; message?: string; error?: string };
    return err.result?.error?.message || err.message || err.error || fallback;
}

export function errorStatus(e: unknown): number | undefined {
    const err = e as { status?: number; result?: { error?: { code?: number } } } | null;
    const s = err?.status ?? err?.result?.error?.code;
    return typeof s === 'number' ? s : undefined;
}
