/**
 * content-audit.mjs — the publish gate.
 *
 * This is not a test of the code. It is a test of the *claims*, and it exists
 * because the single worst failure mode for a portfolio is not a bug — it is a
 * confident sentence that turns out to be untrue in an interview.
 *
 * It does four things:
 *
 *   1. Reports every outstanding NEEDS_SOURCE, so nothing stays blank by
 *      accident and it is obvious what is still missing before publishing.
 *   2. Flags any number that reads like a claimed metric. Volumes, latencies,
 *      percentages and team sizes were never sourced, so any that appear were
 *      invented — by a future edit, by a copy-paste, or by a model. This is the
 *      check that catches it.
 *   3. Flags employer-confidentiality risks: internal platform names, client
 *      names and specific volumes attached to day-job entries.
 *   4. Checks structural completeness — every project has a problem, an
 *      approach, architecture, a stack and a status, and points at a real era.
 *
 *   node tools/content-audit.mjs
 */

import { profile, projects, chapters, experience, NEEDS_SOURCE, PROJECT_KINDS } from '../src/data/portfolio.js';

let problems = 0;
let warnings = 0;

const bad = (m) => { problems++; console.log(`  ✗ ${m}`); };
const warn = (m) => { warnings++; console.log(`  ! ${m}`); };
const ok = (m) => console.log(`  ✓ ${m}`);

const say = (title) => console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 54 - title.length))}`);

console.log('\nKAMLENDU // DATA PLANE v6 — content audit\n');

/* ------------------------------------------------------------ 1. blanks */
say('outstanding sources');

const value = (key) => {
  if (!key.startsWith('profile.')) return null;
  return profile[key.slice('profile.'.length)];
};

let blanks = 0;
for (const n of NEEDS_SOURCE) {
  const v = value(n.key);
  const empty = v === null ? true : Array.isArray(v) ? v.length === 0 : !v;
  if (empty) {
    blanks++;
    console.log(`  ○ ${n.key.padEnd(28)} ${n.what}`);
    console.log(`    ${' '.repeat(28)} → ${n.effect}`);
  }
}
if (blanks === 0) ok('everything registered has been supplied');
else console.log(`\n  ${blanks} item(s) still to supply. None of them break the site.`);

/* ---------------------------------------------------- 2. invented numbers */
say('unsourced metrics');

/*
 * Anything that looks like a claimed quantity. Tuned to ignore the things that
 * are legitimately numeric — version numbers, standards, algorithm names and
 * the probability threshold that is part of a described design.
 */
const ALLOW = [
  /Customer 360/i, /SCIM 2\.0/i, /Ed25519/i, /P\(pass\) ≥ 0\.95/i,
  /Basel/i, /SOX/i, /RBI/i, /SEBI/i, /GDPR/i, /128 MB/i, /S3/i, /Db2/i,
  /Iceberg/i, /Next\.js/i, /360/,
];

const METRIC = [
  { re: /\b\d+(\.\d+)?\s*(%|percent)\b/i, what: 'a percentage' },
  { re: /\b\d[\d,.]*\s*(million|billion|bn|k|m)\b/i, what: 'a magnitude' },
  { re: /\b\d+(\.\d+)?\s*(ms|milliseconds?|seconds?|minutes?|hours?)\b/i, what: 'a latency or duration' },
  { re: /\b\d[\d,]*\s*(rows?|records?|events?|users?|customers?|tables?|pipelines?)\b/i, what: 'a volume' },
  { re: /\b(team|squad)\s+of\s+\d+/i, what: 'a team size' },
  { re: /\b\d+\+?\s*(years?|yrs?)\b/i, what: 'a duration of experience' },
  { re: /\b(reduced|improved|increased|saved|cut|boosted)\b[^.]{0,40}\b\d/i, what: 'an improvement claim' },
];

function scan(text, where) {
  if (!text) return;
  const s = String(text);
  if (ALLOW.some((a) => a.test(s))) {
    // Still scan, but only report matches outside the allowed fragments.
    let stripped = s;
    for (const a of ALLOW) stripped = stripped.replace(new RegExp(a.source, 'gi'), '');
    for (const m of METRIC) {
      if (m.re.test(stripped)) bad(`${where}: contains ${m.what} that was never sourced — "${s.slice(0, 80)}…"`);
    }
    return;
  }
  for (const m of METRIC) {
    if (m.re.test(s)) bad(`${where}: contains ${m.what} that was never sourced — "${s.slice(0, 80)}…"`);
  }
}

const walk = (obj, where) => {
  if (typeof obj === 'string') return scan(obj, where);
  if (Array.isArray(obj)) return obj.forEach((v, i) => walk(v, `${where}[${i}]`));
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) walk(v, `${where}.${k}`);
  }
};

walk(profile, 'profile');
walk(projects, 'projects');
walk(experience, 'experience');
walk(chapters, 'chapters');

if (problems === 0) ok('no unsourced metrics anywhere in the content');

/* -------------------------------------------- 3. confidentiality exposure */
say('employer confidentiality');

const INTERNAL = [
  { re: /\bopen party platform\b|\bOPP\b/i, what: 'an internal platform name' },
  { re: /\bclient(s)? (such as|including|like)\b/i, what: 'a named client' },
];

const dayJob = projects.filter((p) => (p.kind || 'work') === 'work');
let exposure = 0;
for (const p of [...dayJob, ...experience]) {
  const text = JSON.stringify(p);
  for (const rule of INTERNAL) {
    if (rule.re.test(text)) {
      exposure++;
      bad(`${p.id || p.org}: exposes ${rule.what} — remove before publishing`);
    }
  }
}
if (exposure === 0) {
  ok('day-job entries stay at category level — no internal system or client names');
}

// A judgement call rather than a defect, so it is a warning and stays visible.
if (projects.some((p) => /upsc/i.test(p.id))) {
  warn('UPSC OS is listed. It is real engineering, but on a portfolio shown to');
  console.log('    employers it also signals intent to leave for the civil service.');
  console.log('    Keep it for a general portfolio; consider removing it for job applications.');
}

/* --------------------------------------------------- 4. structural checks */
say('structure');

const required = ['name', 'tag', 'kind', 'scene', 'blurb', 'status'];
const deep = ['problem', 'approach', 'architecture', 'stack'];

for (const p of projects) {
  for (const f of required) {
    if (!p[f]) bad(`project "${p.id}" is missing ${f}`);
  }
  for (const f of deep) {
    const v = p[f];
    if (!v || (Array.isArray(v) && !v.length)) {
      bad(`project "${p.id}" has no ${f} — a case study without one is a card`);
    }
  }
  if (!chapters.some((c) => c.scene === p.scene)) {
    bad(`project "${p.id}" points at scene "${p.scene}", which no chapter uses`);
  }
  if (!PROJECT_KINDS.some((k) => k.key === p.kind)) {
    bad(`project "${p.id}" has kind "${p.kind}", which the work chapter cannot group`);
  }
  if (p.blurb && p.blurb.length > 190) {
    warn(`project "${p.id}" blurb is ${p.blurb.length} chars — it is a list item, keep it under ~160`);
  }
}

if (!profile.summary) bad('profile.summary is empty — it is the most-read sentence on the site');
else if (profile.summary.length > 460) warn(`profile.summary is ${profile.summary.length} chars; aim for under 400`);

if (!profile.principles?.length) warn('profile.principles is empty — this is the section that differentiates');
if (!profile.stack?.length) bad('profile.stack is empty — the grouped skills block will not render');

const counts = PROJECT_KINDS.map((k) => `${k.key} ${projects.filter((p) => p.kind === k.key).length}`);
ok(`${projects.length} projects (${counts.join(', ')})`);
ok(`${profile.stack.reduce((n, g) => n + g.items.length, 0)} skills across ${profile.stack.length} groups`);
ok(`${profile.principles.length} stated engineering principles`);

/* ------------------------------------------------------------------ done */
console.log('');
if (problems) {
  console.log(`${problems} problem(s), ${warnings} warning(s) — fix the problems before publishing.\n`);
  process.exit(1);
}
console.log(
  `No fabricated claims, no confidentiality exposure, every case study complete.` +
  (warnings ? ` ${warnings} judgement call(s) flagged above.` : '') +
  (blanks ? ` ${blanks} optional source(s) outstanding.` : '') +
  '\n'
);
