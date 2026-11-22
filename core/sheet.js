// A RULE SHEET BROUGHT BY THE OPENER. A business (or office) can bring a rule sheet of its own, as plain data, to any
// middle ground. The middle ground needs no change for a new use case: it checks the sheet against the limits below and
// runs it with a fixed set of checks. The person's agent runs the same checks before it sends anything, shows the person
// in plain words what each side will learn, and tells the middle ground which exact sheet it accepts (by its fingerprint).
//
// A brought sheet, in this version:
//   {
//     "title": "A gym membership offer",
//     "business": [ { "key": "minAge", "label": "Youngest member", "type": "number" } ],
//     "person":   [ { "key": "age", "label": "Age", "type": "number", "proof": "signed by an identity office" } ],
//     "answers": {
//       "business": [ { "says": "Old enough for membership", "test": ["person.age", "at least", "business.minAge"] } ],
//       "person":   [ { "says": "You qualify", "all": true } ]
//     },
//     "outcome": { "person": "Welcome. Show this token at the desk.", "business": "A new member who meets every check." }
//   }
//
// THE FUNCTIONS IN THIS VERSION (later versions may add more):
//   field types   number, numbers (a list), text, words (comma separated), date (YYYY-MM-DD), choice (with options)
//   a value       "side.key", or "average of side.key", "total of", "smallest of", "largest of", "count of",
//                 or a plain number, word or date written in the sheet
//   tests         at least, at most, more than, less than, equals, is one of [..], has all of, has any of
//   answers       a test (yes, no, or "not proven"), a band ("band": value, "edges": [..], "names": [..]),
//                 or "all": true (yes when every test in the sheet says yes)
//
// THE LIMITS, so a sheet cannot be used to pull a private value out of the other side:
//   - a pair room only: the business opens it, one person brings their side
//   - at most 8 fields for each side and 8 answers for each side, a sheet of at most 8 KB
//   - every answer is yes, no, "not proven" or one of the sheet's own band names: never a raw value
//   - a band has at most 5 names, and its edges rise by at least 10% each, so it cannot narrow a value down
//   - each field is tested at most twice in the answers the other side gets, so many small tests cannot rebuild it
//   - a test that sends the other side a yes or no about free text must check against at least 2 words, never one exact word
//   - a value backed by a certificate token (a field with "proof") gives "not proven" when no trusted token backs it
// The middle ground also limits how often the same two sides may meet in a day (host.js).
// The same file runs in the middle ground and in the personal agent.
(function (root) {
  const MG = root.MG || (root.MG = {});
  const SIDES = ['business', 'person'], TYPES = ['number', 'numbers', 'text', 'words', 'date', 'choice'];
  const OPS = ['at least', 'at most', 'more than', 'less than', 'equals', 'is one of', 'has all of', 'has any of'];
  const LISTS = ['average', 'total', 'smallest', 'largest', 'count'];
  const MAX = { fields: 8, answers: 8, bands: 5, size: 8192, testsPerField: 2 };
  const str = (v, n) => typeof v === 'string' && v.trim().length > 0 && v.length <= n;
  const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim());
  const num = v => Number(String(v == null ? '' : v).replace(/[₹,\s]/g, ''));
  const nums = v => String(v == null ? '' : v).split(/[;,\n]/).map(s => num(s)).filter(n => !isNaN(n) && String(n) !== '');
  const wordList = v => String(v == null ? '' : v).split(/[,;\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const hex = async t => {
    const subtle = (root.crypto && root.crypto.subtle) || (typeof window === 'undefined' ? require('crypto').webcrypto.subtle : undefined);   // a web page gets it only over https or on localhost
    return [...new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // "average of person.salary" -> { list: 'average', side: 'person', key: 'salary' }; a number or word -> { literal }
  function readValue(v) {
    if (typeof v === 'number') return { literal: v };
    if (Array.isArray(v)) return { literal: v };
    const s = String(v == null ? '' : v).trim(), m = s.match(/^(?:(average|total|smallest|largest|count) of )?(business|person)\.([a-zA-Z][a-zA-Z0-9]{0,23})$/);
    return m ? { list: m[1] || '', side: m[2], key: m[3] } : { literal: s };
  }
  const fieldOf = (sheet, r) => r.side && (sheet[r.side] || []).find(f => f.key === r.key);

  MG.sheet = {
    MAX, OPS, TYPES, LISTS,
    // ITS FINGERPRINT: the first 16 characters of the SHA-256 of its exact words. Every token names it.
    async fingerprint(sheet) { return (await hex(MG.wordsOf(sheet))).slice(0, 16); },

    // CHECK A BROUGHT SHEET against the limits. Gives { ok: true } or { ok: false, problems: [plain words] }.
    check(sheet) {
      const p = [], bad = w => p.push(w);
      let text = '';
      try { text = JSON.stringify(sheet); } catch { return { ok: false, problems: ['it is not plain data'] }; }
      if (!sheet || typeof sheet !== 'object' || Array.isArray(sheet)) return { ok: false, problems: ['it is not a rule sheet'] };
      if (text.length > MAX.size) bad('it is larger than ' + MAX.size / 1024 + ' KB');
      if (!str(sheet.title, 80)) bad('it needs a title of up to 80 characters');
      for (const k of Object.keys(sheet)) if (!['title', 'business', 'person', 'answers', 'outcome'].includes(k)) bad('it has a part this version does not know: "' + String(k).slice(0, 30) + '"');
      for (const side of SIDES) {
        const fs = sheet[side];
        if (!Array.isArray(fs) || !fs.length || fs.length > MAX.fields) { bad('the ' + side + ' needs 1 to ' + MAX.fields + ' fields'); continue; }
        const keys = new Set();
        for (const f of fs) {
          const name = f && f.key ? '"' + String(f.key).slice(0, 24) + '"' : 'a field';
          if (!f || !/^[a-zA-Z][a-zA-Z0-9]{0,23}$/.test(String(f.key))) { bad('a ' + side + ' field needs a short key of letters and digits'); continue; }
          if (keys.has(f.key)) bad('the ' + side + ' has two fields called ' + name);
          keys.add(f.key);
          if (!str(f.label, 60)) bad(name + ' needs a label of up to 60 characters');
          if (!TYPES.includes(f.type)) bad(name + ' has a type this version does not know (it knows ' + TYPES.join(', ') + ')');
          if (f.type === 'choice' && !(Array.isArray(f.options) && f.options.length >= 2 && f.options.length <= 8 && f.options.every(o => str(o, 40)))) bad(name + ' needs 2 to 8 options');
          if (f.proof !== undefined && !str(f.proof, 60)) bad(name + ': "proof" says who signs it, in up to 60 characters');
          if (f.public !== undefined && typeof f.public !== 'boolean') bad(name + ': "public" is true or false');
          for (const k of Object.keys(f)) if (!['key', 'label', 'type', 'options', 'proof', 'public'].includes(k)) bad(name + ' has a part this version does not know: "' + String(k).slice(0, 30) + '"');
        }
      }
      if (p.length) return { ok: false, problems: p };
      const A = sheet.answers || {}, uses = {};
      if (typeof A !== 'object' || !SIDES.some(s => Array.isArray(A[s]) && A[s].length)) bad('it needs at least one answer');
      for (const to of SIDES) {
        const list = A[to] === undefined ? [] : A[to];
        if (!Array.isArray(list) || list.length > MAX.answers) { bad('the ' + to + ' may get at most ' + MAX.answers + ' answers'); continue; }
        for (const a of list) {
          const what = a && str(a.says, 120) ? '“' + a.says + '”' : 'an answer';
          if (!a || !str(a.says, 120)) bad('every answer needs "says", in up to 120 characters');
          const kinds = ['test', 'band', 'all'].filter(k => a && a[k] !== undefined);
          if (kinds.length !== 1) { bad(what + ' needs exactly one of "test", "band" or "all"'); continue; }
          const refs = [];
          const value = (v, needNumber) => {
            const r = readValue(v);
            if ('literal' in r) { if (needNumber && isNaN(num(r.literal))) bad(what + ': "' + String(v).slice(0, 30) + '" is not a number'); return r; }
            const f = fieldOf(sheet, r);
            if (!f) { bad(what + ' uses "' + String(v).slice(0, 40) + '", which is not a field of the sheet'); return r; }
            if (r.list && f.type !== 'numbers' && !(r.list === 'count' && f.type === 'words')) bad(what + ': "' + r.list + ' of" works on a list of numbers' + (r.list === 'count' ? ' or words' : ''));
            if (needNumber && !r.list && !['number', 'date'].includes(f.type)) bad(what + ': ' + f.key + ' is not a number');
            refs.push({ r, f });
            return r;
          };
          if (a.test !== undefined) {
            if (!Array.isArray(a.test) || a.test.length !== 3 || !OPS.includes(a.test[1])) { bad(what + ': a test is [value, one of: ' + OPS.join(', ') + ', value]'); continue; }
            const [l, op, rv] = a.test, compare = ['at least', 'at most', 'more than', 'less than'].includes(op);
            const left = value(l, compare);
            if (op === 'is one of') { if (!Array.isArray(rv) || rv.length < 2 || rv.length > 8) bad(what + ': "is one of" needs a list of 2 to 8 values'); }
            else if (op === 'has all of' || op === 'has any of') { const right = Array.isArray(rv) ? { literal: rv } : value(rv); if ('literal' in right && wordList([].concat(right.literal).join(',')).length < 2) bad(what + ': "' + op + '" needs at least 2 words'); }
            else value(rv, compare);
            // A yes or no about the other side's free text must not test one exact word (it would confirm a guess).
            const lf = fieldOf(sheet, left);
            if (lf && left.side !== to && ['text', 'words'].includes(lf.type) && op === 'equals') bad(what + ': a yes or no about the ' + left.side + '’s free text cannot test one exact word; use "is one of" or "has all of"');
          } else if (a.band !== undefined) {
            value(a.band, true);
            const e = a.edges, n = a.names;
            if (!Array.isArray(e) || !e.length || e.length > MAX.bands - 1 || !e.every(x => typeof x === 'number' && isFinite(x))) bad(what + ': a band needs 1 to ' + (MAX.bands - 1) + ' edges, as numbers');
            else {
              for (let i = 1; i < e.length; i++) if (!(e[i] > e[i - 1] && e[i] - e[i - 1] >= Math.abs(e[i]) * 0.1)) bad(what + ': each band edge must rise by at least 10% over the one before');
              if (!Array.isArray(n) || n.length !== e.length + 1 || !n.every(x => str(x, 40))) bad(what + ': a band with ' + e.length + ' edges needs ' + (e.length + 1) + ' names');
            }
          } else if (a.all !== true) bad(what + ': "all" is true');
          for (const { r } of refs) if (r.side !== to) { const k = r.side + '.' + r.key; uses[k] = (uses[k] || 0) + 1; }
        }
      }
      for (const [k, n] of Object.entries(uses)) if (n > MAX.testsPerField) bad(k + ' is used in ' + n + ' answers for the other side; the most is ' + MAX.testsPerField);
      if (sheet.outcome !== undefined && !(typeof sheet.outcome === 'object' && Object.keys(sheet.outcome).every(s => SIDES.includes(s) && str(sheet.outcome[s], 200)))) bad('"outcome" gives each side a line of up to 200 characters');
      return p.length ? { ok: false, problems: p } : { ok: true };
    },

    // IN PLAIN WORDS, for the person before they approve: what they bring, and what each side learns.
    words(sheet, side) {
      const other = side === 'person' ? 'business' : 'person', who = s => s === 'person' ? 'You' : 'The business';
      const shape = a => a.band !== undefined ? 'one of: ' + a.names.join(', ') : 'yes, no or “not proven”';
      return {
        title: sheet.title,
        bring: (sheet[side] || []).map(f => f.label + (f.proof ? ' (backed by a certificate token ' + f.proof + ')' : '') + (f.public ? ' (shown to the other side)' : '')),
        otherBrings: (sheet[other] || []).map(f => f.label + (f.public ? ': shown' : ': private, seen only inside the room')),
        learn: SIDES.map(s => ({ who: who(s), answers: ((sheet.answers || {})[s] || []).map(a => a.says + ' (' + shape(a) + ')') })),
      };
    },

    // RUN IT inside the middle ground, as a rule sheet like the built-in ones. The middle ground calls this only for a
    // sheet that passed check(). fingerprint names it in every token.
    compile(sheet, fingerprint) {
      const A = sheet.answers || {}, tests = [];
      SIDES.forEach(s => (A[s] || []).forEach(a => { if (a.test) tests.push(a); }));
      const valueOf = (S, v) => {
        const r = readValue(v);
        if ('literal' in r) return { v: r.literal, proven: true };
        const f = fieldOf(sheet, r), got = S[r.side] && S[r.side][r.key], raw = got ? got.value : '', proven = !f.proof || !!(got && got.stamped);
        if (r.list === 'count') return { v: f.type === 'words' ? wordList(raw).length : nums(raw).length, proven };
        if (r.list) { const xs = nums(raw); const v2 = !xs.length ? NaN : r.list === 'average' ? xs.reduce((a, b) => a + b, 0) / xs.length : r.list === 'total' ? xs.reduce((a, b) => a + b, 0) : r.list === 'smallest' ? Math.min(...xs) : Math.max(...xs); return { v: v2, proven }; }
        if (f.type === 'number') return { v: num(raw), proven };
        if (f.type === 'date') return { v: Date.parse(raw), proven };
        return { v: raw, proven };
      };
      const asNumber = x => typeof x === 'number' ? x : isDate(x) ? Date.parse(x) : num(x);
      const test = (S, a) => {
        const [l, op, rv] = a.test, L = valueOf(S, l);
        let ok;
        if (op === 'is one of') ok = rv.map(x => String(x).trim().toLowerCase()).includes(String(L.v).trim().toLowerCase());
        else if (op === 'has all of' || op === 'has any of') {
          const R = Array.isArray(rv) ? { v: rv.join(','), proven: true } : valueOf(S, rv), have = wordList(L.v), need = wordList(R.v);
          ok = need.length > 0 && (op === 'has all of' ? need.every(w => have.includes(w)) : need.some(w => have.includes(w)));
          if (!R.proven) return 'not proven';
        } else {
          const R = valueOf(S, rv);
          if (!R.proven) return 'not proven';
          if (op === 'equals') ok = typeof L.v === 'number' || typeof R.v === 'number' ? asNumber(L.v) === asNumber(R.v) : String(L.v).trim().toLowerCase() === String(R.v).trim().toLowerCase();
          else { const x = asNumber(L.v), y = asNumber(R.v); ok = !isNaN(x) && !isNaN(y) && (op === 'at least' ? x >= y : op === 'at most' ? x <= y : op === 'more than' ? x > y : x < y); }
        }
        return !L.proven ? 'not proven' : ok ? 'yes' : 'no';
      };
      const answer = (S, a) => {
        if (a.test) return test(S, a);
        if (a.all) return tests.every(t => test(S, t) === 'yes') ? 'yes' : 'no';
        const B = valueOf(S, a.band);
        if (!B.proven) return 'not proven';
        let i = 0; while (i < a.edges.length && !(B.v < a.edges[i])) i++;
        return isNaN(B.v) ? 'not proven' : a.names[i];
      };
      const notes = {}, keys = {};
      SIDES.forEach(s => { notes[s] = (A[s] || []).map((a, n) => ({ key: 'a' + n, says: () => a.says, shape: a.band ? { band: a.names } : 'yes-no' })); keys[s] = A[s] || []; });
      return {
        title: sheet.title, field: 'Brought by the business', kind: 'pair', openedBy: ['business'], brought: sheet, fingerprint,
        business: sheet.business, person: sheet.person, notes,
        look(S) {
          const out = { outcome: {} }, met = tests.every(t => test(S, t) === 'yes');
          SIDES.forEach(s => { out[s] = Object.fromEntries(keys[s].map((a, n) => ['a' + n, answer(S, a)])); });
          SIDES.forEach(s => { out.outcome[s] = met ? (sheet.outcome && sheet.outcome[s]) || 'Every check is met.' : 'Not every check is met. Nothing about the other side was kept.'; });
          return out;
        },
      };
    },
  };
  if (typeof module !== 'undefined') module.exports = MG;
})(typeof window !== 'undefined' ? window : globalThis);
