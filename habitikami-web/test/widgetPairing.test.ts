import { describe, it, expect } from 'vitest';
import { buildPairingUri, buildPairingWebUrl, redirectPairingLink, isAndroidBrowser } from '../src/utils/widgetPairing';

describe('widget pairing links', () => {
    it('builds the custom-scheme URI the Android app registers', () => {
        const uri = buildPairingUri('hk_abc/123', 'https://habits.example.com');
        expect(uri.startsWith('web+habitikami://widget-config?')).toBe(true);
        const params = new URLSearchParams(uri.split('?')[1]);
        expect(params.get('url')).toBe('https://habits.example.com');
        expect(params.get('key')).toBe('hk_abc/123');
    });

    it('keeps the key in the hash of the web link so it never reaches the server', () => {
        const url = buildPairingWebUrl('secret', 'https://habits.example.com');
        expect(url.split('#')[0]).toBe('https://habits.example.com/widget-config');
        expect(url).toContain('#');
        expect(url.split('#')[0]).not.toContain('secret');
    });

    it('forwards a pairing page to the custom scheme and cleans the URL', () => {
        const loc = { pathname: '/widget-config', hash: '#url=https%3A%2F%2Fh.example.com&key=k1', href: '' };
        const replaced: string[] = [];
        const hist = { replaceState: (_d: unknown, _u: string, url: string) => { replaced.push(url); } };
        expect(redirectPairingLink(loc, hist)).toBe(true);
        expect(loc.href).toBe(buildPairingUri('k1', 'https://h.example.com'));
        expect(replaced).toEqual(['/']);
    });

    it('ignores other pages and incomplete links', () => {
        const hist = { replaceState: () => {} };
        expect(redirectPairingLink({ pathname: '/', hash: '', href: '' }, hist)).toBe(false);
        const partial = { pathname: '/widget-config', hash: '#key=only', href: '' };
        expect(redirectPairingLink(partial, hist)).toBe(false);
        expect(partial.href).toBe('');
    });

    it('detects Android browsers from the user agent', () => {
        expect(isAndroidBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129')).toBe(true);
        expect(isAndroidBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129')).toBe(false);
    });
});
