#!/usr/bin/env node
/**
 * Crea su GitHub le issue atomiche di issues.json (label, milestone, issue con dipendenze).
 *
 * Idempotente: label, milestone e issue già esistenti (stesso nome/titolo) vengono riusate.
 * Le dipendenze ("depends_on") diventano "Dipende da: #n" nel corpo dell'issue.
 *
 * Uso:
 *   GITHUB_TOKEN=ghp_... [GITHUB_REPO=kambei/habitikami] node scripts/github-issues/create-issues.mjs [--dry-run]
 * Il token deve avere il permesso Issues: write (classic: scope "repo"; fine-grained: Issues read/write).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(join(here, 'issues.json'), 'utf8'));

const DRY = process.argv.includes('--dry-run');
const REPO = process.env.GITHUB_REPO || plan.repo;
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!TOKEN && !DRY) {
    console.error('GITHUB_TOKEN non impostato. Usa --dry-run per vedere cosa verrebbe creato.');
    process.exit(1);
}
const API = `https://api.github.com/repos/${REPO}`;

async function gh(method, path, body) {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
}
async function ghAll(path) {
    const out = [];
    for (let page = 1; ; page++) {
        const sep = path.includes('?') ? '&' : '?';
        const chunk = await gh('GET', `${path}${sep}per_page=100&page=${page}`);
        out.push(...chunk);
        if (chunk.length < 100) return out;
    }
}

// Ordine topologico: prima le dipendenze, poi chi ne dipende.
function ordered(issues) {
    const byKey = new Map(issues.map((i) => [i.key, i]));
    const seen = new Set();
    const out = [];
    const visit = (i, stack = []) => {
        if (seen.has(i.key)) return;
        if (stack.includes(i.key)) throw new Error(`Ciclo di dipendenze: ${[...stack, i.key].join(' -> ')}`);
        for (const d of i.depends_on) visit(byKey.get(d), [...stack, i.key]);
        seen.add(i.key);
        out.push(i);
    };
    issues.forEach((i) => visit(i));
    return out;
}

async function main() {
    console.log(`${DRY ? '[dry-run] ' : ''}Repository: ${REPO}`);

    // Label
    const have = new Set(DRY ? [] : (await ghAll('/labels')).map((l) => l.name));
    for (const [name, { color, description }] of Object.entries(plan.labels)) {
        if (have.has(name)) continue;
        console.log(`label     + ${name}`);
        if (!DRY) await gh('POST', '/labels', { name, color, description });
    }

    // Milestone
    const msNumber = new Map(DRY ? [] : (await ghAll('/milestones?state=all')).map((m) => [m.title, m.number]));
    for (const { title, description } of plan.milestones) {
        if (msNumber.has(title)) continue;
        console.log(`milestone + ${title}`);
        if (!DRY) msNumber.set(title, (await gh('POST', '/milestones', { title, description })).number);
    }

    // Issue
    const existing = DRY ? [] : (await ghAll('/issues?state=all')).filter((i) => !i.pull_request);
    const numberByTitle = new Map(existing.map((i) => [i.title, i.number]));
    const numberByKey = new Map();
    const created = [];

    for (const issue of ordered(plan.issues)) {
        const deps = issue.depends_on.map((k) => numberByKey.get(k));
        let body = issue.body;
        if (deps.length) body += `\n\n**Dipende da:** ${deps.map((n) => (typeof n === 'number' ? `#${n}` : '(non creata)')).join(', ')}`;
        body += `\n\n---\n_Origine: \`${plan.source}\`. Issue atomica generata da \`scripts/github-issues/issues.json\`._`;

        if (numberByTitle.has(issue.title)) {
            const n = numberByTitle.get(issue.title);
            numberByKey.set(issue.key, n);
            console.log(`issue     = #${n} ${issue.title} (già presente)`);
            continue;
        }
        console.log(`issue     + ${issue.title}  [${issue.labels.join(', ')}]${deps.length ? '  dipende da ' + deps.map((n) => `#${n}`).join(' ') : ''}`);
        if (DRY) { numberByKey.set(issue.key, `?${issue.key}`); continue; }

        const res = await gh('POST', '/issues', {
            title: issue.title,
            body,
            labels: issue.labels,
            milestone: msNumber.get(issue.milestone),
        });
        numberByKey.set(issue.key, res.number);
        created.push(res);
    }

    console.log(`\nCreate ${created.length} issue${DRY ? ' (simulazione)' : ''}.`);
    for (const i of created) console.log(`  #${i.number}  ${i.html_url}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
