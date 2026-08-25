// A small, honest SQL subset. Supports:
//   SELECT <cols|*|aggregates> FROM <table>
//   [WHERE <expr>] [GROUP BY <col>] [ORDER BY <col> ASC|DESC] [LIMIT <n>]
// Operators: = != <> > < >= <= LIKE, IN (..), IS NULL, AND, OR, parentheses.
// Meta: SHOW TABLES · DESCRIBE <table> · EXPLAIN <query> · HELP

const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'BY', 'LIMIT', 'AND', 'OR',
  'NOT', 'LIKE', 'IN', 'IS', 'NULL', 'ASC', 'DESC', 'AS', 'TRUE', 'FALSE',
]);
const AGGREGATES = new Set(['COUNT', 'AVG', 'SUM', 'MIN', 'MAX']);

// ── tokenizer ────────────────────────────────────────────────
function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '-' && input[i + 1] === '-') {
      while (i < input.length && input[i] !== '\n') i++;
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c;
      let j = i + 1;
      let s = '';
      let closed = false;
      while (j < input.length) {
        if (input[j] === quote && input[j + 1] === quote) { s += quote; j += 2; continue; }
        if (input[j] === quote) { closed = true; break; }
        s += input[j++];
      }
      if (!closed) throw new Error(`unterminated string starting at position ${i}`);
      tokens.push({ t: quote === "'" ? 'str' : 'word', v: s, u: s.toUpperCase() });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      tokens.push({ t: 'num', v: parseFloat(input.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_\\]/.test(c)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_.\\[\]]/.test(input[j])) j++;
      const w = input.slice(i, j);
      tokens.push({ t: 'word', v: w, u: w.toUpperCase() });
      i = j;
      continue;
    }
    const two = input.slice(i, i + 2);
    if (['>=', '<=', '!=', '<>'].includes(two)) {
      tokens.push({ t: 'op', v: two === '<>' ? '!=' : two });
      i += 2;
      continue;
    }
    if ('=<>(),*;'.includes(c)) { tokens.push({ t: 'op', v: c }); i++; continue; }
    throw new Error(`I don't understand the character "${c}" at position ${i}.`);
  }
  return tokens;
}

// ── parser ───────────────────────────────────────────────────
function parse(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const atWord = (u) => peek() && peek().t === 'word' && peek().u === u;
  const atOp = (v) => peek() && peek().t === 'op' && peek().v === v;
  const next = () => tokens[p++];
  const eatOp = (v, what) => {
    if (!atOp(v)) throw new Error(`expected "${v}" ${what}`);
    p++;
  };
  const eatWord = (u, what) => {
    if (!atWord(u)) throw new Error(`expected ${u} ${what}`);
    p++;
  };

  eatWord('SELECT', 'to start the query');

  // select list
  const select = [];
  for (;;) {
    if (atOp('*')) { p++; select.push({ kind: 'star' }); }
    else {
      const tok = next();
      if (!tok || tok.t !== 'word') throw new Error('expected a column name after SELECT');
      if (AGGREGATES.has(tok.u) && atOp('(')) {
        p++;
        let arg;
        if (atOp('*')) { p++; arg = '*'; }
        else {
          const a = next();
          if (!a || a.t !== 'word') throw new Error(`expected a column inside ${tok.u}( )`);
          arg = a.v;
        }
        eatOp(')', `to close ${tok.u}(`);
        select.push({ kind: 'agg', fn: tok.u, arg, label: `${tok.u.toLowerCase()}(${arg})` });
      } else {
        if (KEYWORDS.has(tok.u)) throw new Error(`"${tok.v}" is a keyword, not a column`);
        select.push({ kind: 'col', name: tok.v, label: tok.v });
      }
    }
    if (atOp(',')) { p++; continue; }
    break;
  }

  eatWord('FROM', 'after the column list');
  const tableTok = next();
  if (!tableTok || tableTok.t !== 'word') throw new Error('expected a table name after FROM');
  const table = tableTok.v;

  let where = null;
  let groupBy = null;
  let orderBy = null;
  let limit = null;

  if (atWord('WHERE')) { p++; where = parseOr(); }
  if (atWord('GROUP')) {
    p++;
    eatWord('BY', 'after GROUP');
    const g = next();
    if (!g || g.t !== 'word') throw new Error('expected a column after GROUP BY');
    groupBy = g.v;
  }
  if (atWord('ORDER')) {
    p++;
    eatWord('BY', 'after ORDER');
    const o = next();
    if (!o || o.t !== 'word') throw new Error('expected a column after ORDER BY');
    let dir = 'ASC';
    if (atWord('ASC')) p++;
    else if (atWord('DESC')) { p++; dir = 'DESC'; }
    orderBy = { col: o.v, dir };
  }
  if (atWord('LIMIT')) {
    p++;
    const n = next();
    if (!n || n.t !== 'num') throw new Error('expected a number after LIMIT');
    limit = n.v;
  }
  if (atOp(';')) p++;
  if (p < tokens.length) throw new Error(`unexpected "${tokens[p].v}" after the end of the query`);

  return { select, table, where, groupBy, orderBy, limit };

  function parseOr() {
    let left = parseAnd();
    while (atWord('OR')) { p++; left = { op: 'OR', left, right: parseAnd() }; }
    return left;
  }
  function parseAnd() {
    let left = parseCond();
    while (atWord('AND')) { p++; left = { op: 'AND', left, right: parseCond() }; }
    return left;
  }
  function parseCond() {
    if (atOp('(')) {
      p++;
      const inner = parseOr();
      eatOp(')', 'to close the group');
      return inner;
    }
    const colTok = next();
    if (!colTok || colTok.t !== 'word') throw new Error('expected a column name in WHERE');
    const col = colTok.v;

    if (atWord('IS')) {
      p++;
      let negate = false;
      if (atWord('NOT')) { p++; negate = true; }
      eatWord('NULL', 'after IS');
      return { op: negate ? 'IS NOT NULL' : 'IS NULL', col };
    }
    let negate = false;
    if (atWord('NOT')) { p++; negate = true; }
    if (atWord('LIKE')) {
      p++;
      const v = next();
      if (!v || v.t !== 'str') throw new Error('LIKE needs a quoted pattern, e.g. LIKE \'%spark%\'');
      return { op: negate ? 'NOT LIKE' : 'LIKE', col, value: v.v };
    }
    if (atWord('IN')) {
      p++;
      eatOp('(', 'after IN');
      const values = [];
      for (;;) {
        const v = next();
        if (!v || (v.t !== 'str' && v.t !== 'num')) throw new Error('IN needs a list of values');
        values.push(v.v);
        if (atOp(',')) { p++; continue; }
        break;
      }
      eatOp(')', 'to close IN(');
      return { op: negate ? 'NOT IN' : 'IN', col, values };
    }
    if (negate) throw new Error('NOT must be followed by LIKE or IN');

    const opTok = next();
    if (!opTok || opTok.t !== 'op' || !['=', '!=', '>', '<', '>=', '<='].includes(opTok.v)) {
      throw new Error(`expected a comparison operator after "${col}"`);
    }
    const valTok = next();
    if (!valTok) throw new Error(`expected a value after "${opTok.v}"`);
    let value;
    if (valTok.t === 'str' || valTok.t === 'num') value = valTok.v;
    else if (valTok.u === 'TRUE') value = true;
    else if (valTok.u === 'FALSE') value = false;
    else if (valTok.u === 'NULL') value = null;
    else throw new Error(`"${valTok.v}" is not a value — quote it if you meant text`);
    return { op: opTok.v, col, value };
  }
}

// ── evaluation ───────────────────────────────────────────────
const flat = (v) => (Array.isArray(v) ? v.join(', ') : v);
const norm = (v) => (typeof v === 'string' ? v.toLowerCase() : v);

function likeToRegex(pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i');
}

function evalCond(node, row, table) {
  if (node.op === 'AND') return evalCond(node.left, row, table) && evalCond(node.right, row, table);
  if (node.op === 'OR') return evalCond(node.left, row, table) || evalCond(node.right, row, table);

  assertColumn(table, node.col);
  const raw = row[node.col];
  const cell = flat(raw);

  switch (node.op) {
    case 'IS NULL': return cell === null || cell === undefined;
    case 'IS NOT NULL': return cell !== null && cell !== undefined;
    case 'LIKE': return cell != null && likeToRegex(node.value).test(String(cell));
    case 'NOT LIKE': return cell == null || !likeToRegex(node.value).test(String(cell));
    case 'IN': return node.values.some((v) => norm(v) === norm(cell));
    case 'NOT IN': return !node.values.some((v) => norm(v) === norm(cell));
    case '=': return norm(cell) === norm(node.value);
    case '!=': return norm(cell) !== norm(node.value);
    case '>': return cell > node.value;
    case '<': return cell < node.value;
    case '>=': return cell >= node.value;
    case '<=': return cell <= node.value;
    default: throw new Error(`unsupported operator ${node.op}`);
  }
}

function assertTable(name) {
  if (!DB[name]) {
    throw new Error(
      `there is no table called "${name}". Available: ${TABLE_NAMES.join(', ')}.`
    );
  }
  return DB[name];
}

function assertColumn(table, col) {
  if (col === '*') return;
  if (!table.columns.some((c) => c.name === col)) {
    throw new Error(
      `no column "${col}" here. This table has: ${table.columns.map((c) => c.name).join(', ')}.`
    );
  }
}

function aggregate(fn, arg, rows) {
  if (fn === 'COUNT') return arg === '*' ? rows.length : rows.filter((r) => r[arg] != null).length;
  const nums = rows.map((r) => Number(r[arg])).filter((n) => !Number.isNaN(n));
  if (!nums.length) return null;
  if (fn === 'SUM') return nums.reduce((a, b) => a + b, 0);
  if (fn === 'AVG') return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
  if (fn === 'MIN') return Math.min(...nums);
  if (fn === 'MAX') return Math.max(...nums);
  return null;
}

function execute(ast) {
  const table = assertTable(ast.table);
  let rows = table.rows;

  if (ast.where) rows = rows.filter((r) => evalCond(ast.where, r, table));

  const aggs = ast.select.filter((s) => s.kind === 'agg');
  const plainCols = ast.select.filter((s) => s.kind === 'col');
  const hasStar = ast.select.some((s) => s.kind === 'star');

  // grouped
  if (ast.groupBy) {
    assertColumn(table, ast.groupBy);
    const buckets = new Map();
    for (const r of rows) {
      const key = flat(r[ast.groupBy]);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(r);
    }
    const columns = [ast.groupBy, ...aggs.map((a) => a.label)];
    let out = [...buckets.entries()].map(([key, group]) => {
      const row = { [ast.groupBy]: key };
      for (const a of aggs) {
        assertColumn(table, a.arg);
        row[a.label] = aggregate(a.fn, a.arg, group);
      }
      return row;
    });
    out = sortRows(out, ast.orderBy, columns);
    if (ast.limit != null) out = out.slice(0, ast.limit);
    return { columns: columns.map((c) => ({ name: c, type: '' })), rows: out };
  }

  // aggregate over the whole set
  if (aggs.length && !plainCols.length && !hasStar) {
    const row = {};
    for (const a of aggs) {
      if (a.arg !== '*') assertColumn(table, a.arg);
      row[a.label] = aggregate(a.fn, a.arg, rows);
    }
    return { columns: aggs.map((a) => ({ name: a.label, type: '' })), rows: [row] };
  }

  // projection
  let columns;
  if (hasStar) columns = table.columns;
  else {
    plainCols.forEach((c) => assertColumn(table, c.name));
    columns = plainCols.map((c) => table.columns.find((tc) => tc.name === c.name));
  }

  // Sort the full rows first, so ORDER BY works on columns you did not select.
  let ordered = rows;
  if (ast.orderBy) {
    assertColumn(table, ast.orderBy.col);
    ordered = sortRows(rows, ast.orderBy, table.columns.map((c) => c.name), table);
  }
  if (ast.limit != null) ordered = ordered.slice(0, ast.limit);

  const out = ordered.map((r) => {
    const o = {};
    columns.forEach((c) => { o[c.name] = r[c.name]; });
    return o;
  });
  return { columns, rows: out };
}

function sortRows(rows, orderBy, columnNames, table) {
  if (!orderBy) return rows;
  if (!columnNames.includes(orderBy.col)) {
    if (table) assertColumn(table, orderBy.col);
    throw new Error(`cannot sort by "${orderBy.col}" — it is not in the selected columns.`);
  }
  const dir = orderBy.dir === 'DESC' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = flat(a[orderBy.col]);
    const y = flat(b[orderBy.col]);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return String(x).localeCompare(String(y)) * dir;
  });
}

// ── EXPLAIN ──────────────────────────────────────────────────
function describeCond(node) {
  if (node.op === 'AND' || node.op === 'OR') {
    return `(${describeCond(node.left)} ${node.op} ${describeCond(node.right)})`;
  }
  if (node.op === 'IS NULL' || node.op === 'IS NOT NULL') return `${node.col} ${node.op}`;
  if (node.op === 'IN' || node.op === 'NOT IN') return `${node.col} ${node.op} (${node.values.join(', ')})`;
  return `${node.col} ${node.op} ${typeof node.value === 'string' ? `'${node.value}'` : node.value}`;
}

function buildPlan(ast) {
  const table = assertTable(ast.table);
  const lines = [];
  let depth = 0;
  const push = (s) => lines.push('  '.repeat(depth) + (depth ? '-> ' : '') + s);

  if (ast.limit != null) { push(`Limit  (rows=${ast.limit})`); depth++; }
  if (ast.orderBy) { push(`Sort  (key: ${ast.orderBy.col} ${ast.orderBy.dir})`); depth++; }
  if (ast.groupBy) { push(`HashAggregate  (group key: ${ast.groupBy})`); depth++; }
  if (ast.select.some((s) => s.kind === 'agg') && !ast.groupBy) { push('Aggregate'); depth++; }
  if (ast.where) { push(`Filter  (${describeCond(ast.where)})`); depth++; }
  push(`Seq Scan on ${ast.table}  (rows=${table.rows.length}, width=${table.columns.length})`);
  lines.push('');
  lines.push(`Planning time: 0.0${Math.floor(Math.random() * 9) + 1} ms`);
  lines.push('Note: this table fits in a browser tab. Every plan is a sequential scan and that is fine.');
  return lines.join('\n');
}

// ── public entry point ───────────────────────────────────────
function runQuery(input) {
  const started = performance.now();
  const sql = input.trim().replace(/;$/, '');
  if (!sql) return { type: 'text', text: 'Type a query, or pick one of the examples above.' };

  const upper = sql.toUpperCase();

  try {
    if (upper === 'HELP' || upper === '?' || upper === '\\?') {
      return { type: 'text', text: HELP_TEXT };
    }
    if (upper === 'SHOW TABLES' || upper === '\\DT') {
      return {
        type: 'table',
        columns: [{ name: 'table', type: 'text' }, { name: 'rows', type: 'int' }, { name: 'columns', type: 'int' }],
        rows: TABLE_NAMES.map((n) => ({ table: n, rows: DB[n].rows.length, columns: DB[n].columns.length })),
        ms: elapsed(started),
      };
    }
    const describeMatch = sql.match(/^(?:DESCRIBE|DESC|\\d)\s+([A-Za-z_]+)$/i);
    if (describeMatch) {
      const table = assertTable(describeMatch[1]);
      return {
        type: 'table',
        columns: [{ name: 'column', type: 'text' }, { name: 'type', type: 'text' }],
        rows: table.columns.map((c) => ({ column: c.name, type: c.type })),
        ms: elapsed(started),
      };
    }
    if (/^EXPLAIN\s+/i.test(sql)) {
      const ast = parse(tokenize(sql.replace(/^EXPLAIN\s+/i, '')));
      return { type: 'plan', text: buildPlan(ast), ms: elapsed(started) };
    }
    if (!/^SELECT\b/i.test(sql)) {
      return {
        type: 'error',
        text:
          'This console is read-only — it only runs SELECT. Try SHOW TABLES to see what is queryable, or HELP for the supported syntax.',
      };
    }

    const ast = parse(tokenize(sql));
    const result = execute(ast);
    return { type: 'table', ...result, ms: elapsed(started) };
  } catch (err) {
    return { type: 'error', text: capitalise(err.message) };
  }
}

const elapsed = (t0) => Math.max(0.01, Math.round((performance.now() - t0) * 100) / 100);
const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const HELP_TEXT = `Supported syntax
  SELECT <columns | * | COUNT/SUM/AVG/MIN/MAX(col)>
  FROM   <table>
  WHERE  col = 'x'  |  col > 3  |  col LIKE '%spark%'  |  col IN ('a','b')  |  AND / OR / ( )
  GROUP BY col      ORDER BY col ASC|DESC      LIMIT n

Meta commands
  SHOW TABLES        list every table
  DESCRIBE <table>   show its columns and types
  EXPLAIN <query>    show the query plan
  HELP               this message

Tables: ${TABLE_NAMES.join(', ')}
This is a read-only browser-side portfolio database. No production data is queried.`;

const EXAMPLE_QUERIES = [
  { label: 'career row', sql: 'SELECT * FROM experience' },
  { label: 'streaming stack', sql: "SELECT skill, context FROM skills WHERE category = 'Streaming & Processing'" },
  { label: 'AWS stack', sql: "SELECT skill, context FROM skills WHERE category = 'AWS'" },
  { label: 'selected projects', sql: 'SELECT name, type, stack FROM projects' },
  { label: 'certification count', sql: "SELECT issuer, COUNT(*) FROM certifications GROUP BY issuer ORDER BY issuer ASC" },
  { label: 'query plan', sql: "EXPLAIN SELECT skill FROM skills WHERE skill LIKE '%Spark%'" },
];
