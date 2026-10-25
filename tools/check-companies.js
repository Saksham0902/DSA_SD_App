#!/usr/bin/env node
/* Validate companies-data.js before committing. Usage: node tools/check-companies.js companies-data.js */
const fs = require('fs'), path = require('path');
const file = path.resolve(process.argv[2] || 'companies-data.js');
const src = fs.readFileSync(file, 'utf8');
const sandbox = { window: {} };
try { new Function('window', src)(sandbox.window) } catch (e) { console.error('FAIL: the file does not run:', e.message); process.exit(1) }
const D = sandbox.window.CO_DATA, bad = [];
const DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/, FULL = /^\d{4}-\d{2}-\d{2}$/;
if (!D || typeof D !== 'object') { console.error('FAIL: window.CO_DATA is missing'); process.exit(1) }
if (!FULL.test(D.checked || '')) bad.push('checked must be YYYY-MM-DD');
const ids = new Set(Object.keys(D.sources || {}));
for (const [id, s] of Object.entries(D.sources || {})) {
  if (!Array.isArray(s) || s.length < 4) bad.push(`source ${id}: needs [title, url, date, kind]`);
  else { if (!/^(https?:\/\/|[\w-]+\.html)/.test(s[1])) bad.push(`source ${id}: bad url`); if (!['official', 'news', 'candidates', 'guide'].includes(s[3])) bad.push(`source ${id}: bad kind`) }
}
const today = new Date().toISOString().slice(0, 10);
function item(u, where) {
  if (!u.t || !u.x) bad.push(`${where}: needs t and x`);
  if (!DATE.test(u.d || '')) bad.push(`${where}: bad date ${u.d}`);
  if (u.sort && !FULL.test(u.sort)) bad.push(`${where}: bad sort ${u.sort}`);
  if (u.added && !FULL.test(u.added)) bad.push(`${where}: bad added ${u.added}`);
  if ((u.sort || u.d) > today + 'z') bad.push(`${where}: date in the future`);
  if (!['official', 'news', 'candidates', 'guide'].includes(u.st)) bad.push(`${where}: bad st ${u.st}`);
  if (!['ai', 'policy', 'process'].includes(u.tag)) bad.push(`${where}: bad tag ${u.tag}`);
  if (!Array.isArray(u.src) || !u.src.length) bad.push(`${where}: needs at least one source`);
  (u.src || []).forEach(s => { if (!ids.has(s)) bad.push(`${where}: unknown source ${s}`) });
}
(D.trends || []).forEach((t, i) => item(t, `trend ${t.id || i}`));
const seen = new Set();
(D.companies || []).forEach(c => {
  const w = `company ${c.id}`;
  if (!c.id || seen.has(c.id)) bad.push(`${w}: missing or duplicate id`); seen.add(c.id);
  for (const k of ['name', 'mono', 'stance', 'stanceLabel', 'summary']) if (!c[k]) bad.push(`${w}: missing ${k}`);
  if (!['allowed', 'pilot', 'oa', 'some', 'reported', 'ask', 'banned', 'none'].includes(c.stance)) bad.push(`${w}: bad stance ${c.stance}`);
  if (!Array.isArray(c.loop) || !c.loop.length) bad.push(`${w}: loop is empty`);
  if (!Array.isArray(c.updates) || !c.updates.length) bad.push(`${w}: no updates`);
  (c.updates || []).forEach((u, i) => item(u, `${w} update ${i}`));
  (c.prep || []).forEach(p => { if (!Array.isArray(p) || p.length !== 2) bad.push(`${w}: bad prep entry`) });
});
if (bad.length) { console.error('FAIL\n- ' + bad.join('\n- ')); process.exit(1) }
console.log(`OK: ${D.companies.length} companies, ${D.companies.reduce((a, c) => a + c.updates.length, 0)} updates, ${D.trends.length} trends, checked ${D.checked}`);
