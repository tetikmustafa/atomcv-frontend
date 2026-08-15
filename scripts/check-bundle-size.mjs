#!/usr/bin/env node
/**
 * Measures the initial JavaScript each prerendered route loads, and checks it
 * against `bundle-budget.json`.
 *
 * Why not size-limit or bundlesize: both measure files you can name. Next.js
 * emits content-hashed chunks whose names change every build and carry no
 * indication of which route pulls them, so neither tool can express "the
 * initial JS for /en" — which is the number Bölüm 52.3 actually budgets.
 * This reads the script tags out of the prerendered HTML instead, which is
 * exactly the set the browser downloads before the page is interactive.
 */
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const APP_DIR = join('.next', 'server', 'app');
const NEXT_DIR = '.next';
const BUDGET_FILE = 'bundle-budget.json';

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const gzipCache = new Map();

function gzipBytes(chunkPath) {
  if (!gzipCache.has(chunkPath)) {
    gzipCache.set(chunkPath, gzipSync(readFileSync(chunkPath), { level: 9 }).length);
  }
  return gzipCache.get(chunkPath);
}

function scriptsIn(html) {
  return [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((match) => match[1]);
}

function toChunkPath(src) {
  return join(
    NEXT_DIR,
    src
      .replace(/^\/_next\//, '')
      .split('/')
      .join(sep),
  );
}

const kb = (bytes) => bytes / 1024;
const fmt = (bytes) => kb(bytes).toFixed(1).padStart(6);

let budget;
try {
  // Strip a byte-order mark. Windows editors and PowerShell's `Set-Content`
  // add one, and JSON.parse rejects it with an error that says nothing about
  // encoding.
  budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf8').replace(/^﻿/, ''));
} catch (error) {
  console.error(`Cannot read ${BUDGET_FILE}: ${error.message}`);
  process.exit(1);
}

let htmlFiles;
try {
  htmlFiles = walk(APP_DIR).filter((path) => path.endsWith('.html'));
} catch {
  console.error(`No prerendered output in ${APP_DIR}. Run \`npm run build\` first.`);
  process.exit(1);
}

if (htmlFiles.length === 0) {
  console.error(`No prerendered routes found in ${APP_DIR}.`);
  process.exit(1);
}

/**
 * Framework error pages and development-only routes are not product surface.
 * They also distort the shared baseline: `dev/*` renders as a 404 in a
 * production build, so leaving it in drags the intersection down to whatever
 * the not-found page loads and every real route then looks heavier than it is.
 */
function isProductRoute(name) {
  return !name.startsWith('/_') && !name.includes('/dev/');
}

const routes = htmlFiles
  .map((file) => ({
    name:
      '/' +
      relative(APP_DIR, file)
        .replace(/\.html$/, '')
        .split(sep)
        .join('/'),
    scripts: new Set(scriptsIn(readFileSync(file, 'utf8'))),
  }))
  .filter((route) => route.scripts.size > 0 && isProductRoute(route.name))
  .sort((a, b) => a.name.localeCompare(b.name));

if (routes.length === 0) {
  console.error('No route loaded any JavaScript. The measurement is probably wrong.');
  process.exit(1);
}

// Chunks every route loads. This is the framework floor plus whatever the root
// layout drags in — the part feature work does not control.
const shared = [...routes[0].scripts].filter((src) =>
  routes.every((route) => route.scripts.has(src)),
);
const sharedBytes = shared.reduce((total, src) => total + gzipBytes(toChunkPath(src)), 0);

/**
 * First matching class wins, so an unrecognised route falls through to the
 * strictest one that matches — `app` matches everything. A new route is
 * budgeted tightly until someone decides otherwise, rather than silently
 * inheriting the most generous ceiling.
 */
function classify(name) {
  for (const [className, config] of Object.entries(budget.classes)) {
    if (config.match.some((pattern) => new RegExp(pattern).test(name))) {
      return { className, ...config };
    }
  }
  throw new Error(`No budget class matches ${name}. Give one class a ".*" pattern.`);
}

const measured = routes.map((route) => {
  const total = [...route.scripts].reduce((sum, src) => sum + gzipBytes(toChunkPath(src)), 0);
  return { name: route.name, total, own: total - sharedBytes, budget: classify(route.name) };
});

const failures = [];

console.log('\nInitial JS per route (gzipped)\n');
console.log('  route                        class        total      own');
console.log('  ' + '-'.repeat(60));

for (const route of measured) {
  const overTotal = kb(route.total) > route.budget.totalKb;
  const overOwn = kb(route.own) > route.budget.ownKb;
  if (overTotal || overOwn) failures.push({ route, overTotal, overOwn });

  const flag = overTotal || overOwn ? ' <-- over' : '';
  console.log(
    `  ${route.name.padEnd(28)} ${route.budget.className.padEnd(10)} ${fmt(route.total)} ${fmt(route.own)}${flag}`,
  );
}

console.log('  ' + '-'.repeat(60));
console.log(`  shared by every route                    ${fmt(sharedBytes)}\n`);

const sharedOver = kb(sharedBytes) > budget.sharedKb;

if (sharedOver) {
  console.error(
    `Shared baseline is ${kb(sharedBytes).toFixed(1)} KB, budget ${budget.sharedKb} KB.\n` +
      'This number should only move when a dependency is added or upgraded. If that is\n' +
      'what happened, raise the budget in the same commit so the change is reviewable.\n',
  );
}

for (const { route, overTotal, overOwn } of failures) {
  if (overOwn) {
    console.error(
      `${route.name}: our own code is ${kb(route.own).toFixed(1)} KB, budget ` +
        `${route.budget.ownKb} KB for a ${route.budget.className} route.\n` +
        'Check for a heavy import that should be behind next/dynamic (CLAUDE.md rule 4).\n',
    );
  }
  if (overTotal) {
    console.error(
      `${route.name}: total is ${kb(route.total).toFixed(1)} KB, over the ` +
        `${route.budget.totalKb} KB ceiling for a ${route.budget.className} route ` +
        '(Bölüm 52.3).\n',
    );
  }
}

if (sharedOver || failures.length > 0) process.exit(1);

console.log('Within budget.\n');
