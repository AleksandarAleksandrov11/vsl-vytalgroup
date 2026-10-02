// Ejecuta integrations/apps-script/Code.gs (el Apps Script real) contra una hoja de Google simulada.
// La simulación imita lo que importa de Sheets: texto sin formato (@) y apóstrofo, fechas reales,
// fórmulas evaluadas con el separador de la configuración regional (es_ES ";" y en_US ","), filas
// reservadas, validación, formato condicional, filtro, bloqueo y correo.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const CODE = fs.readFileSync(path.join(__dirname, '..', 'integrations', 'apps-script', 'Code.gs'), 'utf8');
const MADRID = 'Europe/Madrid';
const res = [];
const ok = (c, n, x = '') => res.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  · ' + x : ''}`);
const isDate = (v) => Object.prototype.toString.call(v) === '[object Date]';

// ------------------------------------------------------------------ fechas
function wall(date, tz) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const o = {};
  f.formatToParts(new Date(date.getTime())).forEach((p) => { o[p.type] = p.value; });
  return o;
}
function offsetMin(date, tz) {
  const p = wall(date, tz);
  return Math.round((Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}
function formatDate(date, tz, fmt) {
  const p = wall(date, tz);
  const off = offsetMin(date, tz);
  const z = (off < 0 ? '-' : '+') + String(Math.floor(Math.abs(off) / 60)).padStart(2, '0') + String(Math.abs(off) % 60).padStart(2, '0');
  return fmt.replace(/yyyy|MM|dd|HH|mm|ss|Z/g, (t) => ({ yyyy: p.year, MM: p.month, dd: p.day, HH: p.hour, mm: p.minute, ss: p.second, Z: z })[t]);
}
function fromWall(y, mo, d, h, mi, tz) {
  const w = Date.UTC(y, mo - 1, d, h, mi, 0);
  const t = w - offsetMin(new Date(w), tz) * 60000;
  return new Date(w - offsetMin(new Date(t), tz) * 60000);
}
const serial = (date, tz) => { const p = wall(date, tz); return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) / 86400000 + 25569; };

// ------------------------------------------------------------------ hoja simulada
const letter = (n) => { let s = ''; while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); } return s; };
const colNum = (l) => l.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
const a1 = (r) => `${letter(r.c)}${r.r}:${letter(r.c + r.nc - 1)}${r.r + r.nr - 1}`;

class Spreadsheet {
  constructor(env, locale, tz) { Object.assign(this, { env, locale, tz, sheets: [] }); }
  tick(n) { this.env.ticks[n] = (this.env.ticks[n] || 0) + 1; }
  getSheetByName(n) { this.tick('getSheetByName'); return this.sheets.find((s) => s.name === n) || null; }
  getSheets() { this.tick('getSheets'); return this.sheets.slice(); }
  insertSheet(name, index = this.sheets.length) {
    this.tick('insertSheet');
    if (this.sheets.some((s) => s.name === name)) throw new Error(`Ya existe una hoja llamada ${name}`);
    if (index < 0 || index > this.sheets.length) throw new Error('Índice de hoja no válido');
    const sh = new Sheet(this, name);
    this.sheets.splice(index, 0, sh);
    return sh;
  }
  deleteSheet(sh) { this.tick('deleteSheet'); this.sheets = this.sheets.filter((s) => s !== sh); }
  getSpreadsheetLocale() { this.tick('getSpreadsheetLocale'); return this.locale; }
  getSpreadsheetTimeZone() { this.tick('getSpreadsheetTimeZone'); return this.tz; }
  setSpreadsheetTimeZone(tz) { this.tick('setSpreadsheetTimeZone'); this.tz = tz; }
}

class Sheet {
  constructor(ss, name) { Object.assign(this, { ss, name, cells: new Map(), maxRows: 1000, maxCols: 26, frozen: 0, hidden: new Set(), widths: {}, rules: [], filter: null, merges: [], gridlines: true, tab: null }); }
  tick(n) { this.ss.tick(n); }
  at(r, c) { return this.cells.get(`${r},${c}`); }
  cell(r, c) {
    let x = this.at(r, c);
    if (!x) { x = { v: '', f: null, nf: null, dv: null, wrap: false, quoted: false }; this.cells.set(`${r},${c}`, x); }
    return x;
  }
  filled(x) { return !!x && (!!x.f || (x.v !== '' && x.v !== null && x.v !== undefined)); }
  // Lo que hace Sheets con un valor escrito por setValues/setValue (como si lo tecleara alguien)
  input(r, c, val) {
    const x = this.cell(r, c);
    x.f = null; x.quoted = false;
    if (isDate(val) || typeof val === 'number' || typeof val === 'boolean') { x.v = val; return; }
    const s = val === null || val === undefined ? '' : String(val);
    if (x.nf === '@') { x.v = s; return; }
    if (s.startsWith("'")) { x.v = s.slice(1); x.quoted = true; return; }
    if (s.startsWith('=')) { x.f = s; x.v = ''; return; }
    if (/^[+-]?\d+(\.\d+)?$/.test(s)) { x.v = Number(s); return; }
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2}))?$/.exec(s);
    if (m && this.ss.locale === 'es_ES') { x.v = fromWall(+m[3], +m[2], +m[1], +(m[4] || 0), +(m[5] || 0), this.ss.tz); return; }
    x.v = s;
  }
  value(r, c) {
    const x = this.at(r, c);
    if (!x) return '';
    if (x.f) { const v = evaluate(x.f, this); return Array.isArray(v) ? v[0][0] : v && v.err ? v.err : v; }
    return x.v;
  }
  getName() { return this.name; }
  setName(n) { this.tick('setName'); if (this.ss.sheets.some((s) => s !== this && s.name === n)) throw new Error('Nombre repetido'); this.name = n; return this; }
  getIndex() { return this.ss.sheets.indexOf(this) + 1; }
  getMaxRows() { this.tick('getMaxRows'); return this.maxRows; }
  getMaxColumns() { this.tick('getMaxColumns'); return this.maxCols; }
  getLastRow() { this.tick('getLastRow'); let m = 0; for (const [k, x] of this.cells) if (this.filled(x)) m = Math.max(m, +k.split(',')[0]); return m; }
  getLastColumn() { this.tick('getLastColumn'); let m = 0; for (const [k, x] of this.cells) if (this.filled(x)) m = Math.max(m, +k.split(',')[1]); return m; }
  getRange(a, b, c, d) {
    this.tick('getRange');
    if (typeof a === 'string') {
      const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(a);
      const r1 = +m[2]; const c1 = colNum(m[1]);
      return new Range(this, r1, c1, m[3] ? +m[4] - r1 + 1 : 1, m[3] ? colNum(m[3]) - c1 + 1 : 1);
    }
    return new Range(this, a, b, c === undefined ? 1 : c, d === undefined ? 1 : d);
  }
  shift(rows, at, n) {
    const moved = new Map();
    for (const [k, x] of this.cells) {
      let [r, c] = k.split(',').map(Number);
      if (rows && r > at) r += n;
      if (!rows && c > at) c += n;
      moved.set(`${r},${c}`, x);
    }
    this.cells = moved;
    const grow = (rg) => {
      const start = rows ? rg.r : rg.c; const size = rows ? 'nr' : 'nc';
      if (at < start) { if (rows) rg.r += n; else rg.c += n; } else if (at < start + rg[size] - 1) rg[size] += n;
    };
    this.rules.forEach((rule) => rule.ranges.forEach(grow));
    if (this.filter) grow(this.filter.range);
  }
  insertColumnsAfter(col, n) {
    this.tick('insertColumnsAfter');
    this.shift(false, col, n);
    this.maxCols += n;
    this.hidden = new Set([...this.hidden].map((h) => (h > col ? h + n : h)));
    const w = {}; Object.entries(this.widths).forEach(([k, v]) => { w[+k > col ? +k + n : k] = v; }); this.widths = w;
    return this;
  }
  insertColumnAfter(col) { return this.insertColumnsAfter(col, 1); }
  insertRowsAfter(row, n) { this.tick('insertRowsAfter'); this.shift(true, row, n); this.maxRows += n; return this; }
  setFrozenRows(n) { this.tick('setFrozenRows'); this.frozen = n; }
  setColumnWidth(c, w) { this.tick('setColumnWidth'); this.widths[c] = w; return this; }
  setRowHeight() { this.tick('setRowHeight'); return this; }
  hideColumns(c, n = 1) { this.tick('hideColumns'); for (let i = 0; i < n; i++) this.hidden.add(c + i); }
  getConditionalFormatRules() { this.tick('getConditionalFormatRules'); return this.rules.slice(); }
  setConditionalFormatRules(rules) { this.tick('setConditionalFormatRules'); this.rules = rules.slice(); }
  getFilter() { this.tick('getFilter'); return this.filter; }
  setHiddenGridlines(b) { this.gridlines = !b; return this; }
  setTabColor(c) { this.tab = c; return this; }
}

class Range {
  constructor(sh, r, c, nr, nc) {
    if (nr < 1 || nc < 1) throw new Error('El rango tiene que tener al menos una fila y una columna');
    if (r < 1 || c < 1 || r + nr - 1 > sh.maxRows || c + nc - 1 > sh.maxCols) throw new Error(`Rango fuera de la hoja: ${a1({ r, c, nr, nc })} en ${sh.name} (${sh.maxRows}×${sh.maxCols})`);
    Object.assign(this, { sheet: sh, r, c, nr, nc });
  }
  each(fn) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) fn(this.sheet.cell(this.r + i, this.c + j), i, j); }
  tick(n) { this.sheet.tick(n); return this; }
  getRow() { return this.r; }
  getColumn() { return this.c; }
  getNumRows() { return this.nr; }
  getNumColumns() { return this.nc; }
  getSheet() { return this.sheet; }
  getValues() { this.tick('getValues'); return Array.from({ length: this.nr }, (_, i) => Array.from({ length: this.nc }, (_, j) => this.sheet.value(this.r + i, this.c + j))); }
  getValue() { this.tick('getValue'); return this.sheet.value(this.r, this.c); }
  setValues(v) {
    this.tick('setValues');
    if (v.length !== this.nr || v.some((row) => row.length !== this.nc)) throw new Error(`Las dimensiones no coinciden con ${a1(this)}`);
    v.forEach((row, i) => row.forEach((x, j) => this.sheet.input(this.r + i, this.c + j, x)));
    return this;
  }
  setValue(x) { this.tick('setValue'); this.sheet.input(this.r, this.c, x); return this; }
  setFormula(f) { this.tick('setFormula'); const x = this.sheet.cell(this.r, this.c); x.f = f; x.v = ''; return this; }
  clearContent() { this.tick('clearContent'); this.each((x) => { x.v = ''; x.f = null; }); return this; }
  setNumberFormat(nf) { this.tick('setNumberFormat'); this.each((x) => { x.nf = nf; }); return this; }
  setDataValidation(dv) { this.tick('setDataValidation'); this.each((x) => { x.dv = dv; }); return this; }
  setWrap(b) { this.tick('setWrap'); this.each((x) => { x.wrap = b; }); return this; }
  setFontWeight() { return this.tick('style'); }
  setBackground() { return this.tick('style'); }
  setFontColor() { return this.tick('style'); }
  setFontSize() { return this.tick('style'); }
  setFontStyle() { return this.tick('style'); }
  setHorizontalAlignment() { return this.tick('style'); }
  setVerticalAlignment() { return this.tick('style'); }
  setBorder() { return this.tick('style'); }
  merge() { this.tick('merge'); this.sheet.merges.push(a1(this)); return this; }
  createFilter() {
    this.tick('createFilter');
    if (this.sheet.filter) throw new Error('La hoja ya tiene un filtro');
    const sh = this.sheet;
    const f = {
      range: { r: this.r, c: this.c, nr: this.nr, nc: this.nc },
      criteria: {},
      getRange: () => new Range(sh, f.range.r, f.range.c, f.range.nr, f.range.nc),
      remove: () => { sh.filter = null; },
      getColumnFilterCriteria: (c) => { if (c < f.range.c || c >= f.range.c + f.range.nc) throw new Error('Columna fuera del filtro'); return f.criteria[c] || null; },
      setColumnFilterCriteria: (c, crit) => { f.criteria[c] = crit; return f; },
    };
    sh.filter = f;
    return f;
  }
}

const builders = {
  newDataValidation: () => {
    const b = { requireValueInList: (list, dropdown) => Object.assign(b, { list: list.slice(), dropdown }), setAllowInvalid: (x) => Object.assign(b, { allowInvalid: x }), build: () => ({ list: b.list, dropdown: b.dropdown, allowInvalid: b.allowInvalid }) };
    return b;
  },
  newConditionalFormatRule: () => {
    const b = {
      whenFormulaSatisfied: (f) => Object.assign(b, { formula: f }),
      setBackground: (c) => Object.assign(b, { bg: c }),
      setRanges: (rs) => Object.assign(b, { ranges: rs.map((r) => ({ r: r.r, c: r.c, nr: r.nr, nc: r.nc })) }),
      build: () => { const rule = { formula: b.formula, bg: b.bg, ranges: b.ranges, getBooleanCondition: () => ({ getCriteriaValues: () => [rule.formula] }) }; return rule; },
    };
    return b;
  },
};

// ------------------------------------------------------------------ fórmulas (con el separador de la configuración regional)
class FormulaError extends Error { constructor(code, why) { super(why); this.code = code; } }
function evaluate(formula, sheet) {
  try {
    const sep = sheet.ss.locale === 'es_ES' ? ';' : ',';
    const toks = tokenize(formula.slice(1), sep, sheet);
    let i = 0;
    const peek = () => toks[i];
    const take = (t, v) => { const k = toks[i]; if (!k || k.t !== t || (v !== undefined && k.v !== v)) throw new FormulaError('#ERROR!', `Se esperaba ${v || t}`); i++; return k; };
    const expr = () => {
      let a = concat();
      while (peek() && peek().t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(peek().v)) { const op = toks[i++].v; const b = concat(); a = compare(a, op, b); }
      return a;
    };
    const concat = () => { let a = add(); while (peek() && peek().v === '&') { i++; a = String(scalar(a)) + String(scalar(add())); } return a; };
    const add = () => {
      let a = unary();
      while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) { const op = toks[i++].v; const b = unary(); a = op === '+' ? num(a) + num(b) : num(a) - num(b); }
      return a;
    };
    const unary = () => { if (peek() && peek().v === '-') { i++; return -num(unary()); } return primary(); };
    const primary = () => {
      const k = toks[i++];
      if (!k) throw new FormulaError('#ERROR!', 'Fórmula incompleta');
      if (k.t === 'num' || k.t === 'str' || k.t === 'bool' || k.t === 'ref') return k.v;
      if (k.v === '(') { const v = expr(); take('op', ')'); return v; }
      if (k.t === 'fn') {
        take('op', '(');
        const args = [];
        if (!(peek() && peek().v === ')')) { args.push(expr()); while (peek() && peek().t === 'sep') { i++; args.push(expr()); } }
        take('op', ')');
        // Un error dentro de una función es un valor (#N/A…) que IFERROR puede recoger, como en Sheets
        try { return call(k.v, args, sheet); } catch (e) { if (e instanceof FormulaError) return { err: e.code, why: e.message }; throw e; }
      }
      throw new FormulaError('#ERROR!', `Token inesperado ${k.v}`);
    };
    const v = expr();
    if (i !== toks.length) throw new FormulaError('#ERROR!', 'Sobra texto en la fórmula');
    return v;
  } catch (e) {
    if (e instanceof FormulaError) return { err: e.code, why: e.message };
    throw e;
  }
}
function tokenize(src, sep, sheet) {
  const other = sep === ';' ? ',' : ';';
  const toks = [];
  let i = 0;
  const ref = (sheetName, rest) => {
    const m = /^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?/.exec(rest);
    if (!m) throw new FormulaError('#ERROR!', 'Referencia no válida');
    toks.push({ t: 'ref', v: { range: { sheet: sheetName, c1: colNum(m[1]), r1: +m[2] || 1, c2: colNum(m[3] || m[1]), r2: m[3] ? +m[4] || null : +m[2] || null } } });
    return m[0].length;
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ') { i++; continue; }
    if (ch === '"') {
      let j = i + 1; let s = '';
      for (;;) {
        if (j >= src.length) throw new FormulaError('#ERROR!', 'Comillas sin cerrar');
        if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; }
        s += src[j++];
      }
      toks.push({ t: 'str', v: s }); i = j + 1; continue;
    }
    if (ch === "'") {
      const j = src.indexOf("'", i + 1);
      const name = src.slice(i + 1, j);
      if (src[j + 1] !== '!') throw new FormulaError('#ERROR!', 'Falta ! tras el nombre de la hoja');
      i = j + 2 + ref(name, src.slice(j + 2)); continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      const w = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i))[0];
      if (src[i + w.length] === '!') { i += w.length + 1 + ref(w, src.slice(i + w.length + 1)); continue; }
      if (src[i + w.length] === '(') { toks.push({ t: 'fn', v: w.toUpperCase() }); i += w.length; continue; }
      if (/^(TRUE|FALSE)$/i.test(w)) { toks.push({ t: 'bool', v: /^TRUE$/i.test(w) }); i += w.length; continue; }
      i += ref(sheet.name, src.slice(i)); continue;
    }
    if (/\d/.test(ch)) { const n = /^\d+(\.\d+)?/.exec(src.slice(i))[0]; toks.push({ t: 'num', v: Number(n) }); i += n.length; continue; }
    if (ch === sep) { toks.push({ t: 'sep' }); i++; continue; }
    if (ch === other) throw new FormulaError('#ERROR!', `"${other}" no es separador en ${sheet.ss.locale}`);
    const two = src.slice(i, i + 2);
    if (['<=', '>=', '<>'].includes(two)) { toks.push({ t: 'op', v: two }); i += 2; continue; }
    if ('()&+-*/<>='.includes(ch)) { toks.push({ t: 'op', v: ch }); i++; continue; }
    throw new FormulaError('#ERROR!', `Carácter inesperado ${ch}`);
  }
  return toks;
}
const isErr = (v) => !!v && typeof v === 'object' && !!v.err;
const scalar = (v) => { if (isErr(v)) throw new FormulaError(v.err, v.why); if (v && v.range) throw new FormulaError('#VALUE!', 'Rango donde se esperaba un valor'); return v; };
const num = (v) => { const s = scalar(v); const n = typeof s === 'number' ? s : typeof s === 'boolean' ? +s : Number(s); if (Number.isNaN(n)) throw new FormulaError('#VALUE!', `${s} no es un número`); return n; };
const compare = (a, op, b) => { a = scalar(a); b = scalar(b); return { '=': a === b, '<>': a !== b, '<': a < b, '>': a > b, '<=': a <= b, '>=': a >= b }[op]; };
function rangeValues(v, sheet) {
  if (!v || !v.range) throw new FormulaError('#VALUE!', 'Se esperaba un rango');
  const sh = sheet.ss.sheets.find((s) => s.name === v.range.sheet);
  if (!sh) throw new FormulaError('#REF!', `No existe la hoja ${v.range.sheet}`);
  const { r1, c1, c2 } = v.range;
  const r2 = v.range.r2 || sh.maxRows;
  if (c2 > sh.maxCols) throw new FormulaError('#REF!', 'Columna fuera de la hoja');
  const out = [];
  for (let r = r1; r <= Math.min(r2, Math.max(r1, sh.getLastRow())); r++) {
    const row = [];
    for (let c = c1; c <= c2; c++) { const x = sh.at(r, c); const val = x ? x.v : ''; row.push(isDate(val) ? serial(val, sheet.ss.tz) : val); }
    out.push(row);
  }
  return out;
}
function matcher(crit) {
  const m = /^(>=|<=|<>|>|<|=)?(.*)$/.exec(String(scalar(crit)));
  const op = m[1] || '='; const raw = m[2];
  const n = raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : null;
  return (v) => {
    if (n !== null) return typeof v === 'number' && compare(v, op, n);
    const s = String(v).toLowerCase(); const t = raw.toLowerCase();
    return op === '<>' ? s !== t : op === '=' ? s === t && v !== '' : false;
  };
}
function call(name, args, sheet) {
  switch (name) {
    case 'IF': return num(args[0]) ? args[1] : args[2];
    case 'IFERROR': return isErr(args[0]) ? args[1] : args[0];
    case 'TODAY': return Math.floor(serial(new Date(), sheet.ss.tz));
    case 'COUNTA': return rangeValues(args[0], sheet).flat().filter((v) => v !== '').length;
    case 'COUNTIF': { const f = matcher(args[1]); return rangeValues(args[0], sheet).flat().filter(f).length; }
    case 'COUNTIFS': {
      const pairs = []; for (let k = 0; k < args.length; k += 2) pairs.push([rangeValues(args[k], sheet).flat(), matcher(args[k + 1])]);
      return pairs[0][0].filter((_, idx) => pairs.every(([vals, f]) => f(vals[idx]))).length;
    }
    case 'QUERY': {
      const data = rangeValues(args[0], sheet);
      const q = String(scalar(args[1]));
      if (num(args[2]) !== 0) throw new FormulaError('#VALUE!', 'Encabezados distintos de 0');
      const m = /^select ([A-Z]+), count\(([A-Z]+)\) where ([A-Z]+) <> '' and ([A-Z]+) <> '' group by ([A-Z]+) order by count\(([A-Z]+)\) desc, ([A-Z]+) label ([A-Z]+) '', count\(([A-Z]+)\) ''$/.exec(q);
      if (!m || ![m[3], m[5], m[7], m[8]].every((x) => x === m[1]) || ![m[4], m[6], m[9]].every((x) => x === m[2])) throw new FormulaError('#VALUE!', `Consulta no reconocida: ${q}`);
      const start = args[0].range.c1;
      const gi = colNum(m[1]) - start; const ci = colNum(m[2]) - start;
      if (gi < 0 || ci < 0 || gi >= data[0]?.length) throw new FormulaError('#VALUE!', 'Columna fuera del rango de la consulta');
      const counts = new Map();
      data.forEach((row) => { const g = row[gi]; if (g !== '' && row[ci] !== '') counts.set(String(g), (counts.get(String(g)) || 0) + 1); });
      if (!counts.size) throw new FormulaError('#N/A', 'La consulta no devuelve filas');
      return [...counts.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).map(([g, n]) => [g, n]);
    }
    default: throw new FormulaError('#NAME?', `Función desconocida ${name}`);
  }
}
// Pinta la hoja entera: evalúa las fórmulas, despliega las tablas y detecta errores y choques
function render(sheet) {
  const grid = new Map(); const errors = [];
  for (const [k, x] of sheet.cells) if (!x.f && sheet.filled(x)) grid.set(k, x.v);
  for (const [k, x] of sheet.cells) {
    if (!x.f) continue;
    const [r, c] = k.split(',').map(Number);
    let v = evaluate(x.f, sheet);
    if (Array.isArray(v)) {
      const clash = v.some((row, i) => row.some((_, j) => (i || j) && grid.has(`${r + i},${c + j}`)));
      if (clash) v = { err: '#REF!', why: 'La tabla no cabe: pisaría otras celdas' };
      else v.forEach((row, i) => row.forEach((val, j) => grid.set(`${r + i},${c + j}`, val)));
    }
    if (!Array.isArray(v)) grid.set(k, v);
    if (isErr(v)) errors.push(`${letter(c)}${r}: ${v.err} (${v.why})`);
  }
  const get = (ref) => { const m = /^([A-Z]+)(\d+)$/.exec(ref); return grid.get(`${m[2]},${colNum(m[1])}`); };
  return { grid, errors, get };
}

// ------------------------------------------------------------------ entorno
function makeEnv({ locale = 'es_ES', tz = MADRID, props = {}, mailFails = false } = {}) {
  const env = { mails: [], logs: [], errors: [], ticks: {}, flushes: 0, props: { ...props }, mailFails };
  env.ss = new Spreadsheet(env, locale, tz);
  env.lock = { held: false, waitLock() { if (this.held) throw new Error('Bloqueo ocupado'); this.held = true; }, releaseLock() { this.held = false; } };
  const store = {
    getProperties: () => ({ ...env.props }),
    getProperty: (k) => (k in env.props ? env.props[k] : null),
    setProperty: (k, v) => { env.props[k] = String(v); return store; },
  };
  const ctx = {
    console: { log: (...a) => env.logs.push(a.map(String).join(' ')), error: (...a) => env.errors.push(a.map(String).join(' ')) },
    SpreadsheetApp: { getActiveSpreadsheet: () => env.ss, flush: () => { env.flushes++; }, BorderStyle: { SOLID: 'SOLID' }, ...builders },
    LockService: { getScriptLock: () => env.lock },
    PropertiesService: { getScriptProperties: () => store },
    Utilities: { formatDate, getUuid: () => crypto.randomUUID() },
    MailApp: {
      sendEmail: (m) => { if (env.mailFails) throw new Error('Servicio de correo no disponible'); env.mails.push({ ...m, lockHeld: env.lock.held }); },
      getRemainingDailyQuota: () => 100,
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => { const o = { getContent: () => t, setMimeType: () => o }; return o; } },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  env.ctx = ctx;
  env.post = (body) => JSON.parse(ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).getContent());
  env.leads = () => env.ss.sheets.find((s) => s.name === 'Leads');
  env.row = (r) => Array.from({ length: 16 }, (_, j) => { const x = env.leads().at(r, j + 1); return x ? x.v : ''; });
  env.reset = () => { env.ticks = {}; env.flushes = 0; };
  return env;
}
const HEADERS = ['Fecha y hora', 'Nombre', 'Teléfono', 'Email', 'Perfil', 'Equipo de interés', 'Modelo', 'Estado', 'Notas', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'event_id'];
const LEGACY = ['Fecha', 'Nombre', 'Teléfono', 'Email', 'Perfil', 'Equipo de interés', 'Modelo', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'event_id'];
const base = { nombre: 'Laura Gómez', telefono: '+34 612 345 678', email: '', perfil: 'Fisioterapeuta', equipo: 'Ecógrafo', modelo: 'Acclarix AX8 (EDAN)', consentimiento: 'Sí · 2026-10-02T10:00:00Z', utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'ecografos-otono', utm_content: 'video-1', utm_term: 'fisios-madrid', event_id: '11111111-1111-4111-8111-111111111111', website: '' };
const id = () => crypto.randomUUID();
const dayText = (daysAgo, hh = '10:30') => formatDate(new Date(Date.now() - daysAgo * 86400000), MADRID, 'dd/MM/yyyy') + ' ' + hh;
const wallDate = (text) => { const [d, mo, y, h, mi] = text.split(/[/ :]/).map(Number); return fromWall(y, mo, d, h, mi, MADRID); };
const snapshot = (sh) => JSON.stringify({
  cells: [...sh.cells.entries()].filter(([, x]) => sh.filled(x) || x.nf || x.dv || x.wrap).map(([k, x]) => [k, isDate(x.v) ? `D${x.v.getTime()}` : x.v, x.f, x.nf, x.dv && x.dv.list.join('/'), x.wrap, x.quoted]).sort((p, q) => (p[0] < q[0] ? -1 : 1)),
  maxRows: sh.maxRows, maxCols: sh.maxCols, hidden: [...sh.hidden].sort(), widths: sh.widths, frozen: sh.frozen,
  rules: sh.rules.map((r) => [r.formula, r.bg, r.ranges.map(a1)]), filter: sh.filter && [a1(sh.filter.range), sh.filter.criteria],
});
const formulasOf = (sh) => [...sh.cells.entries()].filter(([, x]) => x.f).map(([k, x]) => [k, x.f]);

// Hoja con la estructura de la versión anterior (13 columnas, con Modelo) y leads reales de ejemplo
function legacySheet(env, { withModelo = true } = {}) {
  const sh = env.ss.insertSheet('Leads', 0);
  const head = withModelo ? LEGACY : LEGACY.filter((h) => h !== 'Modelo');
  head.concat('Seguimiento propio').forEach((h, j) => { sh.cell(1, j + 1).v = h; });
  const rows = [
    [dayText(10), 'Lucía Martín Ortega', '+34 611 222 333', '', 'Fisioterapeuta', 'Ecógrafo', 'Acclarix AX8 (EDAN)', 'facebook', 'paid', 'ecografos-otono', '', '', 'evt-1', 'Llamar el lunes'],
    [wallDate(dayText(3, '18:05')), 'Marta Ruiz Gil', '', 'marta.ruiz@example.com', 'Clínica', 'Láser de alta potencia', '', 'instagram', 'paid', 'catalogo-2026', 'carrusel', '', 'evt-2', ''],
    [dayText(1, '09:15'), 'Carlos Sanz Pereira', '+351 912 345 678', '', 'Médico', 'Diatermia', '', 'facebook', 'paid', 'diatermias-pt', '', '', 'evt-3', ''],
    ['ayer por la tarde', 'Nombre raro', '', 'x@example.com', 'Otro', '=1+1', '', '', '', '', '', '', 'evt-4', ''],
  ];
  rows.forEach((row, i) => {
    const vals = withModelo ? row : row.filter((_, j) => j !== 6).map((v, j) => (j === 5 && row[6] ? `${v} · ${row[6]}` : v));
    vals.forEach((v, j) => { sh.cell(i + 2, j + 1).v = v; if (j === 2 && v) sh.cell(i + 2, j + 1).quoted = true; });
  });
  sh.hidden.add(head.length);
  return { sh, rows };
}

// ================================================================== pruebas
// 1. Hoja nueva: setup() en es_ES
{
  const env = makeEnv({ tz: 'America/New_York' });
  env.ctx.setup();
  const sh = env.leads();
  const head = HEADERS.map((_, j) => sh.at(1, j + 1).v);
  ok(head.join('|') === HEADERS.join('|') && sh.frozen === 1 && sh.hidden.has(15) && sh.hidden.size === 1, 'setup(): crea "Leads" con las 15 columnas (A Fecha y hora … O event_id oculta) y la fila 1 congelada', head.join(', '));
  ok(env.ss.tz === MADRID, 'setup(): la hoja pasa a la zona horaria Europe/Madrid (para fechas y "hoy")', env.ss.tz);
  ok(sh.maxRows >= 1001 && sh.at(1001, 1).nf === 'dd/MM/yyyy HH:mm' && sh.at(2, 3).nf === '@' && sh.at(1001, 3).nf === '@', 'Filas reservadas: ≥ 1000 filas con la fecha y el teléfono (texto) ya formateados', `${sh.maxRows} filas`);
  const dv = sh.at(500, 8).dv;
  ok(dv && dv.list.join('|') === 'Nuevo|Contactado|Propuesta enviada|Cliente|Descartado' && dv.dropdown === true && dv.allowInvalid === false && sh.at(500, 9).wrap === true, 'Estado: desplegable con los 5 estados en toda la columna; Notas con ajuste de texto');
  const colors = sh.rules.map((r) => `${r.formula}→${r.bg}`).join(' ');
  ok(sh.rules.length === 5 && colors === '=$H2="Nuevo"→#FFF4CC =$H2="Contactado"→#DDEBFF =$H2="Propuesta enviada"→#E8DDFF =$H2="Cliente"→#D1FAE5 =$H2="Descartado"→#EEEEEE' && sh.rules.every((r) => a1(r.ranges[0]) === `A2:O${sh.maxRows}`), 'Colores por estado: formato condicional de fila completa (A:O) en toda la hoja', colors);
  ok(sh.filter && a1(sh.filter.range) === `A1:O${sh.maxRows}`, 'Filtro activado en la cabecera, sobre todas las filas reservadas', sh.filter && a1(sh.filter.range));
  ok(sh.widths[1] >= 120 && sh.widths[4] >= 200 && sh.widths[9] >= 250 && Object.keys(sh.widths).length === 15, 'Anchos de columna fijados para leer bien desde el primer día', JSON.stringify(sh.widths));
  const sum = env.ss.sheets.find((s) => s.name === 'Resumen');
  ok(sum && sum.getIndex() === 2 && env.props.LAYOUT_VERSION === '4', 'setup(): crea la pestaña "Resumen" (detrás de Leads) y marca la hoja como migrada');
  ok(env.logs.some((l) => /aaswebmarketing@gmail\.com/.test(l) && /Correos que quedan hoy: 100/.test(l)) && env.logs.some((l) => /Sin LEAD_SECRET/.test(l)), 'setup(): comprueba el permiso de email e informa del destinatario y del secreto', env.logs.join(' / '));
  const r = render(sum);
  ok(!r.errors.length && r.get('C5') === 0 && r.get('C8') === 0 && r.get('B12') === 'Sin datos todavía' && r.get('B35') === 'Sin datos todavía', 'Resumen vacío sin errores: totales a 0 y "Sin datos todavía" en las tablas', r.errors.join(' | '));
  const r1 = env.ctx.doGet().getContent();
  ok(JSON.parse(r1).ok === true && JSON.parse(r1).service === 'VytalGroup leads' && /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(JSON.parse(r1).time), 'doGet(): { ok: true, service: "VytalGroup leads", time }', r1);
}

// 2. Leads: contrato de la web, validaciones, duplicados, inyección y correo
{
  const env = makeEnv();
  env.ctx.setup();
  env.reset();
  const before = Date.now();
  const r = env.post(base);
  const row = env.row(2);
  ok(JSON.stringify(r) === '{"ok":true}', 'Lead válido: responde exactamente { ok: true }', JSON.stringify(r));
  const fecha = row[0];
  ok(isDate(fecha) && fecha.getTime() >= before - 1000 && formatDate(fecha, MADRID, 'dd/MM/yyyy HH:mm') === env.mails[0].body.match(/Fecha: (.*)/)[1], 'Fecha y hora: valor de fecha real (no texto), en hora de Madrid', isDate(fecha) ? formatDate(fecha, MADRID, 'dd/MM/yyyy HH:mm') : String(fecha));
  ok(row.slice(1, 15).join('|') === 'Laura Gómez|+34 612 345 678||Fisioterapeuta|Ecógrafo|Acclarix AX8 (EDAN)|Nuevo||facebook|paid_social|ecografos-otono|video-1|fisios-madrid|' + base.event_id, 'Lead válido: cada dato en su columna, Estado "Nuevo" y Notas vacía', row.slice(1, 15).join(' | '));
  const tel = env.leads().at(2, 3);
  ok(tel.v === '+34 612 345 678' && tel.nf === '@' && !tel.quoted, 'Teléfono guardado como texto (con el + y sin apóstrofo visible)', JSON.stringify(tel.v));
  const m = env.mails[0];
  ok(env.mails.length === 1 && m.to === 'aaswebmarketing@gmail.com' && m.subject === 'Nuevo lead: Laura Gómez · Acclarix AX8 (EDAN)' && !m.replyTo, 'Email: a aaswebmarketing@gmail.com, asunto con nombre y modelo', m.subject);
  ok(m.body === ['Nuevo lead desde la web de VytalGroup', '', 'Nombre: Laura Gómez', 'Teléfono: +34 612 345 678  (WhatsApp: https://wa.me/34612345678)', 'Perfil: Fisioterapeuta', 'Equipo de interés: Ecógrafo', 'Modelo: Acclarix AX8 (EDAN)', 'Campaña: facebook / paid_social / ecografos-otono', `Fecha: ${m.body.match(/Fecha: (.*)/)[1]}`].join('\n'), 'Email: las mismas informaciones que ahora (WhatsApp, perfil, equipo, modelo, campaña y fecha)', m.body.replace(/\n/g, ' ⏎ '));
  ok(m.lockHeld === false, 'Email: se envía después de soltar el bloqueo');
  const work = ['setNumberFormat', 'setDataValidation', 'setWrap', 'setConditionalFormatRules', 'createFilter', 'insertRowsAfter', 'style'].filter((k) => env.ticks[k]);
  const calls = Object.values(env.ticks).reduce((a, b) => a + b, 0);
  ok(!work.length && env.flushes === 1 && calls <= 12, `Rendimiento: ${calls} llamadas a la hoja, una sola escritura y nada de formatear fila a fila`, `${JSON.stringify(env.ticks)} · flush ${env.flushes}`);
  const dup = env.post(base);
  ok(JSON.stringify(dup) === '{"ok":true,"duplicate":true}' && env.leads().getLastRow() === 2 && env.mails.length === 1, 'Duplicado: el mismo event_id responde { ok: true, duplicate: true } sin otra fila ni otro email');
  ok(JSON.stringify(env.post({ ...base, event_id: id(), website: 'http://spam' })) === '{"ok":true}' && env.leads().getLastRow() === 2 && env.mails.length === 1, 'Campo trampa: responde { ok: true } y no guarda ni avisa');
  const errs = [
    [{ ...base, event_id: id(), perfil: '' }, 'Faltan campos: perfil'],
    [{ ...base, event_id: '' }, 'Faltan campos: event_id'],
    [{ ...base, event_id: id(), consentimiento: '' }, 'Faltan campos: consentimiento'],
    [{ ...base, event_id: id(), telefono: '', email: '' }, 'Falta el teléfono o el correo'],
    [{ ...base, event_id: id(), telefono: '12' }, 'Teléfono no válido'],
    [{ ...base, event_id: id(), telefono: '+34 6123 4567 8901 2345' }, 'Teléfono no válido'],
    [{ ...base, event_id: id(), telefono: '', email: 'laura@gmail' }, 'Correo no válido'],
    ['no es json', 'El cuerpo no es un JSON válido'],
  ];
  const wrong = errs.map(([b, msg]) => [env.post(b), msg]).filter(([x, msg]) => JSON.stringify(x) !== JSON.stringify({ ok: false, error: msg }));
  ok(!wrong.length && env.leads().getLastRow() === 2, 'Validaciones: campos obligatorios, teléfono o correo, 8 a 15 cifras, formato de correo y JSON, con los mismos mensajes', wrong.map(([x]) => JSON.stringify(x)).join(' '));
  ok(JSON.parse(env.ctx.doPost({}).getContent()).error === 'Petición vacía', 'Petición vacía: { ok: false, error: "Petición vacía" }');
  const e1 = env.post({ ...base, event_id: id(), telefono: '', email: ' Marta.Ruiz@Example.com ', modelo: 'Sin decidir', equipo: 'Diatermia' });
  const er = env.row(3);
  const em = env.mails[1];
  ok(e1.ok && er[2] === '' && er[3] === 'marta.ruiz@example.com' && er[5] === 'Diatermia' && er[6] === '' && em.replyTo === 'marta.ruiz@example.com' && em.subject === 'Nuevo lead: Laura Gómez · Diatermia' && !/Modelo:|Teléfono:/.test(em.body), 'Por correo y "Sin decidir": correo limpio, Modelo vacío, asunto con el equipo y "Responder" al lead', er.slice(1, 8).join(' | '));
  const evil = env.post({ ...base, event_id: id(), nombre: '=HYPERLINK("http://x";"clic")', telefono: '=1+1 612345678', utm_source: '+SUM(1)', utm_medium: '-2', utm_campaign: '@cmd', utm_content: 'x'.repeat(1500) });
  const sh = env.leads();
  const formulas = [...sh.cells.values()].filter((x) => x.f).length;
  const ev = env.row(4);
  ok(evil.ok && !formulas && ev[1] === '=HYPERLINK("http://x";"clic")' && ev[2] === '1+1 612345678' && ev[9] === '+SUM(1)' && ev[10] === '-2' && ev[11] === '@cmd', 'Inyección: lo que empieza por = + - @ queda como texto (ninguna fórmula en la hoja)', ev.slice(1, 12).map(String).map((s) => s.slice(0, 25)).join(' | '));
  ok(String(ev[12]).length === 1000, 'Límite de 1000 caracteres por celda', String(String(ev[12]).length));
}

// 3. Si el email falla, el lead se guarda igual
{
  const env = makeEnv({ mailFails: true });
  env.ctx.setup();
  const r = env.post({ ...base, event_id: id() });
  ok(JSON.stringify(r) === '{"ok":true}' && env.leads().getLastRow() === 2 && env.errors.some((e) => /no se pudo enviar el aviso/.test(e)) && !env.lock.held, 'Fallo del email: el lead queda guardado, responde { ok: true } y deja el error en el registro', env.errors.join(' / '));
}

// 4. LEAD_SECRET opcional y NOTIFY_EMAIL desde las propiedades
{
  const env = makeEnv({ props: { LEAD_SECRET: 's3creto', NOTIFY_EMAIL: 'ventas@example.com, javier@example.com' } });
  env.ctx.setup();
  const no = env.post({ ...base, event_id: id() });
  const bad = env.post({ ...base, event_id: id(), secret: 'otro' });
  const yes = env.post({ ...base, event_id: id(), secret: 's3creto' });
  const stored = [...env.leads().cells.values()].some((x) => x.v === 's3creto');
  ok(JSON.stringify(no) === '{"ok":false,"error":"No autorizado"}' && JSON.stringify(bad) === JSON.stringify(no) && JSON.stringify(yes) === '{"ok":true}' && env.leads().getLastRow() === 2 && !stored, 'LEAD_SECRET: sin el secreto correcto "No autorizado"; con él, se guarda (y el secreto no se guarda en la hoja)');
  ok(env.mails.length === 1 && env.mails[0].to === 'ventas@example.com, javier@example.com', 'NOTIFY_EMAIL: el aviso va a la dirección de la propiedad del script', env.mails[0] && env.mails[0].to);
  const env2 = makeEnv();
  env2.ctx.setup();
  ok(env2.post({ ...base, event_id: id(), secret: 'lo-que-sea' }).ok === true, 'Sin LEAD_SECRET: funciona como ahora (el campo "secret" se ignora)');
}

// 5. Migración de la hoja actual (13 columnas con Modelo) desde setup()
{
  const env = makeEnv({ tz: 'America/New_York' });
  const { rows } = legacySheet(env);
  env.ctx.setup();
  const sh = env.leads();
  const head = Array.from({ length: 16 }, (_, j) => sh.at(1, j + 1).v);
  ok(head.slice(0, 15).join('|') === HEADERS.join('|') && head[15] === 'Seguimiento propio' && env.ss.sheets.filter((s) => /anterior/.test(s.name)).length === 0, 'Migración: la misma pestaña pasa a 15 columnas (Estado y Notas tras Modelo) y tus columnas propias se desplazan con sus datos', head.join(', '));
  const lost = rows.map((old, i) => {
    const now = env.row(i + 2);
    const expect = [null, old[1], old[2], old[3], old[4], old[5], old[6], '', '', old[7], old[8], old[9], old[10], old[11], old[12], old[13]];
    return expect.map((v, j) => (j === 0 || String(now[j]) === String(v) ? '' : `fila ${i + 2} col ${letter(j + 1)}: ${now[j]} ≠ ${v}`)).filter(Boolean);
  }).flat();
  ok(sh.getLastRow() === 5 && !lost.length, 'Migración: no se pierde ni un dato (4 leads, cada valor en su nueva columna)', lost.join(' | '));
  const f = [2, 3, 4, 5].map((r) => sh.at(r, 1).v);
  ok(isDate(f[0]) && formatDate(f[0], MADRID, 'dd/MM/yyyy HH:mm') === rows[0][0] && isDate(f[1]) && isDate(f[2]) && formatDate(f[2], MADRID, 'dd/MM/yyyy HH:mm') === rows[2][0] && f[3] === 'ayer por la tarde', 'Migración: las fechas de texto pasan a fechas reales con la misma hora; lo que no se entiende se queda tal cual', f.map((v) => (isDate(v) ? formatDate(v, MADRID, 'dd/MM/yyyy HH:mm') : v)).join(' | '));
  ok([2, 3, 4, 5].every((r) => (sh.at(r, 8) ? sh.at(r, 8).v : '') === '') && sh.hidden.has(15) && !sh.hidden.has(13) && sh.at(5, 6).v === '=1+1' && !sh.at(5, 6).f, 'Migración: los leads antiguos quedan con Estado vacío, event_id sigue oculta en la O y no se ejecuta nada como fórmula');
  const snap = snapshot(sh);
  const sumSnap = JSON.stringify(formulasOf(env.ss.getSheetByName('Resumen')));
  env.ctx.setup();
  ok(snapshot(sh) === snap && JSON.stringify(formulasOf(env.ss.getSheetByName('Resumen'))) === sumSnap && env.ss.sheets.length === 2, 'Migración idempotente: ejecutar setup() otra vez no cambia nada');
  const dup = env.post({ ...base, event_id: 'evt-2' });
  ok(dup.duplicate === true && sh.getLastRow() === 5, 'Duplicados: también se detectan con los event_id de los leads antiguos');
  env.reset();
  env.post({ ...base, event_id: id() });
  env.post({ ...base, event_id: id(), perfil: 'Clínica', equipo: 'Diatermia', modelo: 'Reatherm (I-Tech)', utm_campaign: 'diatermias-pt', utm_content: 'carrusel' });
  ok(!env.ticks.insertColumnsAfter && !env.ticks.setNumberFormat && sh.at(6, 8).v === 'Nuevo' && sh.at(7, 8).v === 'Nuevo', 'Tras migrar: los leads nuevos entran con Estado "Nuevo" sin volver a migrar');
  const r = render(env.ss.getSheetByName('Resumen'));
  const table = (col, row) => { const out = []; for (let i = row; ; i++) { const k = r.grid.get(`${i},${col}`); if (k === undefined) break; out.push(`${k}:${r.grid.get(`${i},${col + 1}`)}`); } return out.join(' '); };
  ok(!r.errors.length, 'Resumen (es_ES): ningún #ERROR!', r.errors.join(' | '));
  ok(r.get('C5') === 6 && r.get('C6') === 2 && r.get('C7') === 4 && r.get('C8') === 2, 'Resumen: totales, hoy, últimos 7 días y pendientes (los antiguos no cuentan como pendientes)', `${r.get('C5')} / ${r.get('C6')} / ${r.get('C7')} / ${r.get('C8')}`);
  ok(table(2, 12) === 'Clínica:2 Fisioterapeuta:2 Médico:1 Otro:1' && table(5, 12) === 'Diatermia:2 Ecógrafo:2 =1+1:1 Láser de alta potencia:1' && table(8, 12) === 'Acclarix AX8 (EDAN):2 Reatherm (I-Tech):1', 'Resumen: conteo por perfil, equipo y modelo, de mayor a menor', `${table(2, 12)} ‖ ${table(5, 12)} ‖ ${table(8, 12)}`);
  ok(table(2, 35) === 'diatermias-pt:2 ecografos-otono:2 catalogo-2026:1' && table(5, 35) === 'carrusel:2 video-1:1' && table(8, 35) === 'facebook:4 instagram:1', 'Resumen: conteo por campaña, anuncio y origen', `${table(2, 35)} ‖ ${table(5, 35)} ‖ ${table(8, 35)}`);
  ok(formulasOf(env.ss.getSheetByName('Resumen')).every(([, fx]) => !/,(?=(?:[^"]*"[^"]*")*[^"]*$)/.test(fx)), 'Resumen (es_ES): las fórmulas usan ";" como separador');
}

// 6. Migración desde el primer envío, sin haber ejecutado setup()
{
  const env = makeEnv();
  legacySheet(env);
  const r = env.post({ ...base, event_id: id() });
  const sh = env.leads();
  ok(r.ok === true && sh.at(1, 8).v === 'Estado' && sh.getLastRow() === 6 && sh.at(6, 8).v === 'Nuevo' && sh.at(6, 2).v === 'Laura Gómez' && env.ss.getSheetByName('Resumen') && env.props.LAYOUT_VERSION === '4' && isDate(sh.at(2, 1).v), 'Migración desde el primer doPost: migra, crea el Resumen y guarda el lead nuevo debajo de los antiguos');
}

// 7. Migración que se cortó a medias (cabecera nueva pero fechas de texto): setup() la termina
{
  const env = makeEnv({ locale: 'en_US' });
  const sh = env.ss.insertSheet('Leads', 0);
  HEADERS.forEach((h, j) => { sh.cell(1, j + 1).v = h; });
  [dayText(2), 'Ana', '', 'ana@example.com', 'Clínica', 'Ecógrafo', '', '', '', '', '', '', '', '', 'evt-a'].forEach((v, j) => { sh.cell(2, j + 1).v = v; });
  env.ctx.setup();
  ok(isDate(sh.at(2, 1).v) && sh.at(500, 3).nf === '@' && sh.rules.length === 5, 'Migración a medias: setup() convierte las fechas y aplica los formatos que faltaban');
}

// 8. Hoja aún más antigua (12 columnas, sin Modelo)
{
  const env = makeEnv();
  const { rows } = legacySheet(env, { withModelo: false });
  env.ctx.setup();
  const sh = env.leads();
  ok(sh.at(1, 7).v === 'Modelo' && sh.at(2, 6).v === 'Ecógrafo' && sh.at(2, 7).v === 'Acclarix AX8 (EDAN)' && sh.at(2, 15).v === 'evt-1' && sh.at(2, 16).v === rows[0][13] && sh.at(1, 8).v === 'Estado', 'Migración sin Modelo: separa "Equipo · Modelo" y llega a las 15 columnas', [6, 7, 8, 15, 16].map((c) => sh.at(2, c) && sh.at(2, c).v).join(' | '));
}

// 9. Estructura desconocida: se aparta como "Leads anterior …" y se crea una nueva
{
  const env = makeEnv();
  const sh = env.ss.insertSheet('Leads', 0);
  ['Fecha', 'Nombre', 'Contactar por', 'Teléfono', 'WhatsApp'].forEach((h, j) => { sh.cell(1, j + 1).v = h; });
  ['27/09/2026 10:30:00', 'Prueba antigua', 'WhatsApp'].forEach((v, j) => { sh.cell(2, j + 1).v = v; });
  const r = env.post({ ...base, event_id: id() });
  const old = env.ss.sheets.find((s) => /^Leads anterior \d{2}-\d{2}-\d{4} \d{2}\.\d{2}$/.test(s.name));
  ok(r.ok && old && old.at(2, 2).v === 'Prueba antigua' && env.leads().at(1, 1).v === 'Fecha y hora' && env.leads().getLastRow() === 2, 'Estructura desconocida: la pestaña se guarda como "Leads anterior dd-MM-yyyy HH.mm" y el lead entra en una "Leads" nueva', old && old.name);
}

// 10. Resumen en en_US y reconstrucción
{
  const env = makeEnv({ locale: 'en_US' });
  env.ctx.setup();
  env.post({ ...base, event_id: id() });
  env.post({ ...base, event_id: id(), perfil: 'Clínica' });
  const sum = () => env.ss.getSheetByName('Resumen');
  const r = render(sum());
  ok(!r.errors.length && r.get('C5') === 2 && r.get('C6') === 2 && r.get('B12') === 'Clínica' && r.get('C12') === 1 && formulasOf(sum()).some(([, fx]) => /COUNTIFS\('Leads'!A2:A,">="&TODAY\(\),/.test(fx)), 'Resumen (en_US): sin errores y con "," como separador', r.errors.join(' | '));
  const leadsBefore = snapshot(env.leads());
  const good = JSON.stringify(formulasOf(sum()));
  sum().cell(5, 3).f = '=COUNTA(1;2)';
  sum().cell(40, 2).v = 'basura';
  env.ctx.rebuildSummary();
  ok(JSON.stringify(formulasOf(sum())) === good && !sum().at(40, 2) && sum().getIndex() === 2 && !render(sum()).errors.length && snapshot(env.leads()) === leadsBefore, 'rebuildSummary(): rehace el Resumen desde cero, en su sitio y sin tocar Leads');
  const es = makeEnv();
  ok(isErr(evaluate('=IF(1,2,3)', es.ss.insertSheet('x'))), 'La simulación reproduce el #ERROR! de es_ES con "," (la prueba sirve para algo)');
}

// 11. Hoja llena: se reservan 1000 filas más con sus formatos
{
  const env = makeEnv();
  env.ctx.setup();
  const sh = env.leads();
  for (let i = 0; i < 3; i++) env.post({ ...base, event_id: id() });
  sh.maxRows = sh.getLastRow() + 15;
  for (const k of [...sh.cells.keys()]) if (+k.split(',')[0] > sh.maxRows) sh.cells.delete(k);
  const last = sh.getLastRow();
  const r = env.post({ ...base, event_id: id() });
  ok(r.ok && sh.maxRows === last + 15 + 1000 && sh.at(sh.maxRows, 3).nf === '@' && sh.at(sh.maxRows, 8).dv && sh.rules.every((x) => a1(x.ranges[0]) === `A2:O${sh.maxRows}`) && a1(sh.filter.range) === `A1:O${sh.maxRows}` && sh.at(last + 1, 2).v === 'Laura Gómez', 'Hoja casi llena: añade 1000 filas con fecha, teléfono, estado, colores y filtro, y guarda el lead', `${sh.maxRows} filas`);
}

// 12. testLead()
{
  const env = makeEnv();
  env.ctx.setup();
  const out = env.ctx.testLead();
  const rows = [...Array(env.leads().getLastRow() - 1)].map((_, i) => env.leads().at(i + 2, 2).v);
  ok(out === true && rows.length === 1 && rows[0] === 'PRUEBA testLead (borrar)' && env.mails.length === 1 && env.logs.some((l) => /Mismo event_id otra vez: \{"ok":true,"duplicate":true\}/.test(l)) && env.logs.some((l) => /^Todo bien/.test(l)), 'testLead(): guarda un lead de prueba marcado en el nombre y comprueba el duplicado', env.logs.slice(-3).join(' / '));
  const env2 = makeEnv({ props: { LEAD_SECRET: 'abc' } });
  env2.ctx.setup();
  ok(env2.ctx.testLead() === true, 'testLead(): funciona también con LEAD_SECRET activo');
}

console.log(res.join('\n'));
const fails = res.filter((x) => x.startsWith('FAIL')).length;
console.log(`\n${res.length - fails}/${res.length} OK`);
process.exit(fails ? 1 : 0);
