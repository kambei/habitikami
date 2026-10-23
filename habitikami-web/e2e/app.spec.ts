import { test, expect } from '@playwright/test';
import { setupApp, todayCell, todayDate } from './helpers';

test.describe('Habitikami', () => {
    test('table shows today and a tap writes the cell', async ({ context, page }) => {
        await setupApp(context, page);
        const today = await todayDate(page);
        const row = page.locator('tr', { has: page.locator('td', { hasText: today }) });
        await expect(row).toBeVisible({ timeout: 15000 });
        expect(await todayCell(page, 'Run')).toBe('FALSE');
        // Run is the first habit column: its checkbox is the first one in the row
        await row.locator('td[title^="Run"] div.cursor-pointer').first().click();
        await expect.poll(() => todayCell(page, 'Run')).toBe('TRUE');
    });

    test('Focus completes the first pending habit', async ({ context, page }) => {
        await setupApp(context, page, { tab: 'Focus' });
        await expect(page.getByRole('button', { name: 'Complete' })).toBeVisible({ timeout: 15000 });
        const name = (await page.locator('h2').first().textContent())?.trim();
        await page.getByRole('button', { name: 'Complete' }).click();
        await expect.poll(() => todayCell(page, name === 'Water' ? 'Water' : name ?? 'Run')).not.toBe('FALSE');
    });

    test('grid view opens a note from the cell and saves it', async ({ context, page }) => {
        await setupApp(context, page);
        await page.getByRole('button', { name: 'Switch to grid view' }).click();
        const todayBtn = page.locator('button[title^="' + (await todayDate(page)) + '"]').first();
        await expect(todayBtn).toBeVisible({ timeout: 15000 });
        await todayBtn.click({ button: 'right' });
        const box = page.getByRole('textbox').last();
        await expect(box).toBeVisible();
        await box.fill('rainy day');
        await page.getByRole('button', { name: 'Save' }).click();
        await expect.poll(() => page.evaluate(() => (window as unknown as { __fakeSheets: { sheets: Record<string, string[][]> } }).__fakeSheets.sheets.HabitNotes?.some(r => r[2] === 'rainy day'))).toBe(true);
    });

    test('Stats renders the report and exports the CSV', async ({ context, page }) => {
        await setupApp(context, page, { tab: 'Graphs' });
        await expect(page.getByText('Longest streaks')).toBeVisible({ timeout: 20000 });
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'CSV' }).click();
        expect((await download).suggestedFilename()).toMatch(/^habitikami_\d{8}-\d{8}\.csv$/);
    });

    test('hamburger opens Settings and Trophies; Help shows the CBT menu', async ({ context, page }) => {
        await setupApp(context, page);
        await page.getByRole('button', { name: 'Menu' }).click();
        await page.getByRole('button', { name: 'Settings' }).click();
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 15000 });
        await expect(page).toHaveURL(/#Settings$/);
        await page.getByRole('button', { name: 'Menu' }).click();
        await page.getByRole('button', { name: 'Trophies' }).click();
        await expect(page.getByRole('heading', { name: /Trophies/ })).toBeVisible();
        await page.locator('header').getByRole('button', { name: 'Help', exact: true }).first().click();
        await expect(page.getByText('Guided Session')).toBeVisible({ timeout: 15000 });
        await expect(page.getByRole('heading', { name: 'Settings' })).toHaveCount(0);
    });

    test('offline taps wait in the queue and sync when back online', async ({ context, page }) => {
        await setupApp(context, page);
        const today = await todayDate(page);
        const row = page.locator('tr', { has: page.locator('td', { hasText: today }) });
        await expect(row).toBeVisible({ timeout: 15000 });
        await context.setOffline(true);
        await page.evaluate(() => window.dispatchEvent(new Event('offline')));
        await row.locator('td[title^="Read"] div.cursor-pointer').first().click();
        await expect(page.getByRole('button', { name: /Offline|to sync|waiting for the network/ })).toBeVisible();
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('habitikami_offline_queue') || '[]').length)).toBe(1);
        await context.setOffline(false);
        await page.waitForTimeout(500);
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await expect.poll(() => todayCell(page, 'Read'), { timeout: 15000 }).toBe('TRUE');
        await expect.poll(() => page.evaluate(() => localStorage.getItem('habitikami_offline_queue'))).toBeNull();
    });
});
