// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../src/services/HabitService', () => {
    const answers: Record<string, unknown> = {
        getStoredSpreadsheetId: 'sheet',
        getTemptations: [],
        getHabitMeta: { Run: { description: '', type: 'check', slot: 'morning', time: '07:30' } },
        getApiKeyInfo: { has_key: true, masked_key: 'hk_abc…', created_at: '2026-01-01' },
        getPushSettings: { enabled: true, devices: 2, prefs: { habitReminders: true, eveningReminder: true, eveningTime: '21:00', weeklyReport: true, weeklyTime: '18:00', muted: [] }, tz: 'Europe/Rome', hasRefreshToken: true },
        getMoodEntries: { entries: [] },
        getRecentWorksheets: [],
        getWorksheetMetadata: [],
        getLatestConsolidatedSummary: null,
    };
    return { habitService: new Proxy({}, { get: (_t, prop) => (prop === 'getStoredSpreadsheetId' ? () => 'sheet' : async () => (prop in answers ? answers[prop as string] : {})) }) };
});
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve({ pushManager: { getSubscription: async () => ({ endpoint: 'https://p/1', unsubscribe: async () => true, toJSON: () => ({}) }) } }) }, configurable: true });
(globalThis as Record<string, unknown>).PushManager = function () {};
(globalThis as Record<string, unknown>).Notification = { permission: 'granted', requestPermission: async () => 'granted' };

import { LanguageProvider } from '../../src/i18n';
import { HelpView, SettingsView } from '../../src/components/HelpView';

async function render(ui: React.ReactElement) {
    const errors: unknown[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container, { onUncaughtError: e => errors.push(e), onRecoverableError: e => errors.push(e) });
    await act(async () => { root.render(ui); });
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    return { container, errors };
}

describe('HelpView renders', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    it('menu', async () => {
        const { container, errors } = await render(<LanguageProvider><QueryClientProvider client={qc}><HelpView /></QueryClientProvider></LanguageProvider>);
        expect(errors).toEqual([]);
        expect(container.textContent?.length).toBeGreaterThan(50);
    });
    it('help menu has no settings panel', async () => {
        const { container } = await render(<LanguageProvider><QueryClientProvider client={qc}><HelpView /></QueryClientProvider></LanguageProvider>);
        expect(container.textContent).not.toContain('API Key');
    });
    it('settings', async () => {
        const { container, errors } = await render(<LanguageProvider><QueryClientProvider client={qc}><SettingsView onBack={() => {}} /></QueryClientProvider></LanguageProvider>);
        expect(errors).toEqual([]);
        expect(container.textContent).toContain('API');
        expect(container.textContent).toContain('07:30');
    });
});
