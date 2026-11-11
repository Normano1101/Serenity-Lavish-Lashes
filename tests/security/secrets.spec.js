// Checks that no secret keys are in the website code or committed to git.
// Only the *public* (publishable/anon) key may ever reach the browser.
import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Every file in a folder, including subfolders.
function listFiles(folder) {
    if (!existsSync(folder)) return [];
    return readdirSync(folder).flatMap((name) => {
        const path = join(folder, name);
        return statSync(path).isDirectory() ? listFiles(path) : [path];
    });
}

// A Supabase JWT key carries its role inside; "service_role" bypasses every security rule.
function isServiceRoleJwt(token) {
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
        return payload.role === 'service_role';
    } catch {
        return false;
    }
}

function findSecrets(text) {
    const found = [];
    if (/sb_secret_[A-Za-z0-9_-]+/.test(text)) found.push('a secret key (sb_secret_...)');
    for (const token of text.match(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g) ?? []) {
        if (isServiceRoleJwt(token)) found.push('a service_role key');
    }
    return found;
}

test('the website code contains no secret keys', () => {
    // src = the code you write; dist = the built site that gets uploaded (if built).
    const files = [...listFiles('src'), ...listFiles('dist'), 'index.html', 'vite.config.js'];
    const problems = files.flatMap((file) => findSecrets(readFileSync(file, 'utf8')).map((what) => `${file}: ${what}`));
    expect(problems, 'Remove these secrets. Only the publishable key belongs in the site.').toEqual([]);
});

test('.env.local only uses the public key', () => {
    test.skip(!existsSync('.env.local'), 'No .env.local file.');
    const text = readFileSync('.env.local', 'utf8');
    // Anything starting with VITE_ is copied into the public website, so it must not be secret.
    const viteLines = text.split('\n').filter((line) => line.startsWith('VITE_'));
    const problems = viteLines.flatMap((line) => findSecrets(line).map((what) => `${line.split('=')[0]} holds ${what}`));
    expect(problems).toEqual([]);
});

test('.env files are not committed to git', () => {
    const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n');
    expect(tracked.filter((file) => /(^|\/)\.env(\..+)?$/.test(file) && !file.endsWith('.env.example'))).toEqual([]);
    // And git is told to ignore the local one.
    expect(execSync('git check-ignore .env.local || true', { encoding: 'utf8' }).trim()).toBe('.env.local');
});
