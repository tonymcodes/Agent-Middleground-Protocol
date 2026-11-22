// THE MIDDLE GROUND. Two sides meet here in a room, under a public rule sheet.
// Each side brings its data. Inside the room each side's witness sees the other side's data, within the limits of the
// rule sheet. The middle ground then writes a signed confirmation token for each side, in fixed shapes (yes or no, a band,
// a count), and wipes the data. Everything is held in memory. Nothing is written to disk and no other server is called.
//
// What a visitor can do here (each is one address, /api/<name>, on the server):
//   join      a business or office joins once and gets a key; a business that issues certificate tokens names its stamp key
//   rules     the rule sheets this middle ground runs, each with its fingerprint
//   open      open a room with a rule sheet: a built-in one, or one the business brings (core/sheet.js)
//   rooms     the rooms waiting, with their public fields and the rule sheet each one runs
//   bring     come into a room with the data and certificate tokens; both tokens are written and the data is wiped
//   pickup    the side that opened the room collects its token
//   deliver   after a meeting, a business sends a certificate token to the person's agent (an offer letter)
//   mailbox   the person's agent collects what was delivered to it
//   check     check a token this middle ground made: stamp, time, and the showing of a carried token
// The same file runs on the server (Node) and in a web page, so anyone can read and try the exact logic.
(function (root) {
  const MG = root.MG || (root.MG = {});
  // References and keys come from the system's secure random source, so they cannot be guessed.
  const random = root.crypto && root.crypto.getRandomValues ? root.crypto : require('crypto').webcrypto;
  const label = (p, n) => p + '-' + [...random.getRandomValues(new Uint8Array(n || 8))].map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
  const text = (v, n) => String(v == null ? '' : v).slice(0, n || 80);
  const DAY = 86400000, PAIR_MINUTES = 30, POOL_HOURS = 24, SMALL_GROUP = 3, MAX_ROOMS = 500;

  MG.create = function (opts) {
    opts = opts || {};
    const host = () => MG.host || {};
    const myName = text(opts.name || host().name || 'A middle ground', 60);
    const myAddress = text(opts.address || '', 200);
    // A short list of what it did last, in plain words. No private detail is ever written here.
    const recent = [];
    const note = what => { recent.unshift({ at: new Date().toISOString(), what }); if (recent.length > 12) recent.pop(); };
    const counts = { roomsOpened: 0, notesWritten: 0, valuesDropped: 0, papersPassed: 0, tokensChecked: 0, refused: 0, approvedCode: 0, otherCode: 0 };
    const usage = {};       // agent provider -> requests from its people: a meter for a tiny fee, billed to the provider, never to a person
    const joined = {};      // business name -> { key, stampKey }

    // THIS MIDDLE GROUND'S OWN STAMP. The secret key lives in memory only. The open key is shown to everyone.
    // OLD KEYS: after a key change the host keeps the old open keys, so tokens stamped before still check. A leaked key is left off.
    let stampSecret = null, stampOpen = '', keyId = '';
    const oldKeys = {};
    const ready = (opts.key ? MG.stamp.load(opts.key) : MG.stamp.newKey()).then(async k => {
      stampSecret = k.secret; stampOpen = k.open; keyId = await MG.stamp.keyId(k.open);
      for (const o of opts.oldKeys || []) { const id = await MG.stamp.keyId(o); if (id !== keyId) oldKeys[id] = o; }
    });
    const keyFor = t => (t && t.keyId && oldKeys[t.keyId]) || stampOpen;
    // SEAL: the one place where a token is stamped. Every token names who made it, where (its https address), with which
    // key and which code, so anyone can check it with MG.verify.
    const seal = async t => {
      t.v = t.v || 1; t.id = t.id || label('TK'); t.madeBy = myName; t.made = t.made || new Date().toISOString();
      t.code = MG.codeMark || 'preview inside a page';
      if (myAddress) t.makerAt = myAddress;
      t.keyId = keyId; t.stamp = await MG.stamp.make(stampSecret, MG.wordsOf(t));
      return t;
    };
    const no = why => { counts.refused++; note('A visitor without authentication was refused.'); return { error: why }; };

    // ---------- Who may come in ----------
    // A BUSINESS OR OFFICE joins once, and sends its key with every request after that. A business that issues certificate
    // tokens names its open stamp key. A name on the known list (known.js) may join only with the key written there.
    function join(input) {
      const i = input || {}, name = text(i.name, 60);
      if (!name) return { error: 'Send a name.' };
      const listed = MG.known && MG.known[name];
      if (i.stampKey && listed && listed.key !== i.stampKey) return no('This name is on the known list with a different stamp key.');
      if (i.stampKey && !listed && host().openJoin === false) return no('This middle ground accepts stamps only from the issuers on its known list.');
      const had = joined[name];
      if (had && had.key !== i.key) return { error: 'This name is taken. Send the key you were given.' };
      joined[name] = { key: had ? had.key : label('KEY', 20), stampKey: text(i.stampKey, 200) };
      return { name, key: joined[name].key };
    }
    const isJoined = i => { const j = joined[text(i && i.from, 60)]; return !!(j && j.key === i.key); };

    // A PERSONAL AGENT shows a real person pass (a certificate token from its agent provider), stamps each request with
    // its own key, and, for anything that sends the person's data, carries the person's approval (core/swipe.js).
    // CERTIFICATE TOKENS count as proof when their issuer, or the registry that signed the issuer's key note, is on known.js.
    const trust = () => ({ registries: Object.fromEntries(Object.entries(MG.registries || {}).map(([n, x]) => [n, x.key])), known: Object.fromEntries(Object.entries(MG.known || {}).map(([n, x]) => [n, x.key])), open: host().openJoin !== false });
    const paperCheck = (f, holder) => MG.paper.check(f, holder, trust());
    const said = s => s && s.runs ? ' | runs ' + text(s.runs, 80) : '';
    // THE PERSON'S APPROVAL. A recent approval of this very request: a real fingerprint on the device the person pass
    // names, or, where this host allows it, the sample's ticked box. An important one (ownSwipe) needs a swipe of its own.
    // Each approval is used once. Gives { how, proof } or { why }.
    const usedSwipes = new Map();
    async function approvalOf(i, purpose, important) {
      const holder = text(i.holder, 200), sw = await MG.swipe.check(i.swipe, holder, purpose, Date.now());
      if (!sw.ok) return { why: 'The person’s approval did not pass: ' + sw.why + '.' };
      if (host().realFingerprintOnly && sw.how !== 'device') return { why: 'This middle ground accepts only a real fingerprint swipe, not the sample’s ticked box.' };
      if (sw.how === 'device' && !MG.swipe.bound(i.swipe, i.pass)) return { why: 'The person’s approval did not pass: the fingerprint came from a device whose passkey the person pass does not name.' };
      if (important && sw.items > 1) return { why: 'This use case needs a swipe of its own, not one swipe for a list of ' + sw.items + '.' };
      const now = Date.now(), used = await MG.stamp.mark('swipe|' + holder + '|' + text(i.swipe.at, 40) + '|' + text(i.swipe.salt, 60) + '|' + purpose);
      for (const [k, until] of usedSwipes) if (until < now) usedSwipes.delete(k);
      if (usedSwipes.has(used)) return { why: 'This approval was already used. Each one is used once.' };
      usedSwipes.set(used, now + 2 * MG.swipe.FRESH);
      return { how: sw.how, proof: sw.how === 'device' ? MG.swipe.proof(i.swipe, holder, purpose, i.pass) : null };
    }

    // ---------- Rule sheets ----------
    const sidesOf = sheet => sheet.sides || ['business', 'person'];
    const whoIs = (sheet, s) => (sheet.who && sheet.who[s]) || (s === 'business' ? 'business' : 'person');
    const otherSide = (sheet, s) => sidesOf(sheet).find(x => x !== s);
    const agentOf = s => s === 'business' ? 'business agent' : s + '’s agent';
    const allowsBrought = () => host().broughtSheets !== false;
    // THE SHEET FOR A NEW ROOM: a built-in one by its id (rules.js), or one the business brings as plain data (core/sheet.js).
    async function sheetFor(i) {
      if (i.sheet) {
        if (!allowsBrought()) return { error: 'This middle ground runs only its own rule sheets.' };
        const c = MG.sheet.check(i.sheet);
        if (!c.ok) return { error: 'The rule sheet does not pass the checks: ' + c.problems.slice(0, 4).join('; ') + '.' };
        const fingerprint = await MG.sheet.fingerprint(i.sheet);
        return { rule: 'brought', fingerprint, sheet: MG.sheet.compile(JSON.parse(JSON.stringify(i.sheet)), fingerprint) };
      }
      const sheet = (MG.rules || {})[i.rule];
      return sheet ? { rule: i.rule, sheet, fingerprint: await MG.ruleFingerprint(i.rule) } : { error: 'No such rule sheet here.' };
    }
    async function rules() {
      const out = [];
      for (const id in MG.rules || {}) {
        const r = MG.rules[id], sides = sidesOf(r);
        out.push({ id, title: r.title, field: r.field, kind: r.kind, sides, who: Object.fromEntries(sides.map(s => [s, whoIs(r, s)])), openedBy: r.openedBy || sides, ownSwipe: !!r.ownSwipe,
          fields: Object.fromEntries(sides.map(s => [s, r[s]])), fingerprint: await MG.ruleFingerprint(id) });
      }
      if (allowsBrought()) out.push({ id: 'brought', title: 'A rule sheet the business brings', field: 'Brought sheet', kind: 'pair', sides: ['business', 'person'], who: { business: 'business', person: 'person' },
        openedBy: ['business'], ownSwipe: false, fields: { business: 'set by the sheet', person: 'set by the sheet' }, fingerprint: '', brought: true, limits: MG.sheet.MAX });
      return { rules: out };
    }

    // ---------- Rooms ----------
    const rooms = {};       // room id -> the room, until both tokens are collected or its time runs out
    const looksBy = {};     // one-way mark of a pair and a rule sheet -> times they met today
    const poolMarks = new Set();   // one-way marks: one real person is counted once in each pool room
    const tidy = now => { for (const id in rooms) if (rooms[id].until < now) delete rooms[id]; for (const k in looksBy) if (looksBy[k].until < now) delete looksBy[k]; };
    // Who is this visitor, on which side? A business side: joined, with its key. A person side: a real person pass, the
    // agent's own stamp on this one purpose, and the person's approval.
    async function sideOf(i, purpose, sheet) {
      const side = String(i.side || '');
      if (!sidesOf(sheet).includes(side)) return null;
      if (whoIs(sheet, side) === 'business') return isJoined(i) ? { side, holder: text(i.from, 60), label: text(i.from, 60) + ' (joined here)' } : null;
      const pass = i.pass && i.pass.type === 'real person pass' ? await paperCheck(i.pass, i.holder) : null;
      if (!pass || !pass.good || !pass.confirmed || !await MG.stamp.check(text(i.holder, 200), purpose + said(i), text(i.holderStamp, 200))) return null;
      let approved = '', swipe = null;
      if (MG.swipe.needs(purpose)) {
        const a = await approvalOf(i, purpose, !!sheet.ownSwipe);
        if (a.why) return { refused: a.why };
        approved = '; ' + MG.swipe.words(a.how);
        swipe = a.proof;
      }
      usage[pass.by] = (usage[pass.by] || 0) + 1;
      return { side, holder: text(i.holder, 200), passStamp: text(i.pass.stamp, 200), swipe, label: (side === 'person' ? 'a verified person' : 'the ' + side + ', a verified person') + ' (real person pass from ' + pass.by + approved + ')' };
    }
    // One side's fields: each value as text, and whether a trusted certificate token backs that exact value.
    async function fieldsOf(defs, data, facts, holder) {
      const out = {}, shown = [];
      for (const d of defs) {
        const value = text(data && data[d.key], 2000);
        let stamped = false, by = '', why = '';
        for (const f of (Array.isArray(facts) ? facts : []).slice(0, 20)) {
          if (!f || !f.facts || f.facts.field !== d.key) continue;
          if (String(f.facts.value) !== value) { why = why || 'the value differs from the token ' + text(f.madeBy, 60) + ' signed'; continue; }
          const c = await paperCheck(f, holder);
          if (c.good && c.confirmed) { stamped = true; by = c.by + ' (' + c.how + ')'; break; }
          why = c.good ? c.how : c.why;
        }
        out[d.key] = { value, stamped, by };
        if (value) shown.push({ what: d.label, proof: stamped ? 'signed by ' + by : why ? 'not proven: ' + why : 'their own word, not verified' });
      }
      return { fields: out, shown };
    }
    const fieldsNow = room => Object.fromEntries(Object.entries(room.sides).map(([s, v]) => [s, v.fields]));
    function publicOf(sheet, S) {
      const pub = {};
      for (const s in S) for (const d of sheet[s] || []) if (d.public && S[s][d.key]) pub[d.key] = S[s][d.key].value;
      return pub;
    }
    // Every answer must fit its shape, or the room writes nothing. So no rule sheet can pass a raw value across.
    function notesFor(defs, answers, pub) {
      return (defs || []).map(n => {
        if (!(n.key in (answers || {}))) throw new Error('The rule sheet gave no answer for "' + n.key + '".');
        if (!MG.fitsShape(n.shape, answers[n.key])) throw new Error('An answer did not fit its shape, so the room wrote nothing.');
        return { says: text(n.says(pub), 160), answer: answers[n.key] };
      });
    }
    function writeNote(room, forSide, holder, sides, otherShowed, confirmed, outcome, extra) {
      const now = Date.now();
      counts.notesWritten++;
      return seal({ kind: 'confirmation token', says: 'Confirmation token for the ' + agentOf(forSide) + ': ' + room.title,
        room: room.id, rules: { sheet: room.rule, title: room.title, fingerprint: room.fingerprint }, for: forSide, sides,
        otherSideShowed: otherShowed, confirmed, ...(outcome ? { outcome: text(outcome, 200) } : {}), ...(extra || {}),
        heldBy: holder, made: new Date(now).toISOString(), goodUntil: new Date(now + 30 * DAY).toISOString(), uses: 'once' });
    }

    // OPEN A ROOM. accepts: the fingerprint of the rule sheet this side has read and accepts. The person's approval covers
    // it, so the person approved exactly this sheet.
    async function open(input) {
      await ready;
      const i = input || {}, now = Date.now();
      tidy(now);
      const s = await sheetFor(i);
      if (s.error) return { error: s.error };
      const sheet = s.sheet;
      if (!(sheet.openedBy || sidesOf(sheet)).includes(i.side)) return { error: 'This side cannot open a room for this rule sheet.' };
      if (i.accepts !== s.fingerprint) return { error: 'Name the fingerprint of the rule sheet you accept (accepts). This one is ' + s.fingerprint + '.' };
      const me = await sideOf(i, 'meet:open:' + s.fingerprint, sheet);
      if (!me) return no('Only a joined business, or a personal agent with a real person pass, can open a room.');
      if (me.refused) return { error: me.refused };
      if (Object.keys(rooms).length >= MAX_ROOMS) return { error: 'This middle ground is full. Try again later.' };
      const mine = await fieldsOf(sheet[me.side] || [], i.data, i.facts, me.holder);
      const room = { id: label('RM'), rule: s.rule, sheet, title: sheet.title, kind: sheet.kind, fingerprint: s.fingerprint, opened: now,
        until: now + (sheet.kind === 'pool' ? POOL_HOURS * 3600000 : PAIR_MINUTES * 60000), opener: me.side,
        sides: { [me.side]: { ...me, ...mine, shareKey: !!i.shareKey && whoIs(sheet, me.side) === 'person' } }, notes: {}, people: 0, tally: {}, kept: {} };
      room.public = publicOf(sheet, fieldsNow(room));
      rooms[room.id] = room;
      counts.roomsOpened++;
      note('A room was opened for "' + sheet.title + '" by the ' + me.side + '. Its data stays in the room.');
      return { room: room.id, fingerprint: s.fingerprint, waitingFor: sheet.kind === 'pool' ? 'people' : otherSide(sheet, me.side), until: new Date(room.until).toISOString() };
    }
    // THE ROOMS WAITING, newest first. Each shows its public fields, what it asks of the side it waits for, and its rule
    // sheet: the id of a built-in one, or the whole brought sheet, so an agent can read it before it decides.
    function roomList(input) {
      const i = input || {}, now = Date.now();
      tidy(now);
      return { rooms: Object.values(rooms).filter(r => (!i.rule || r.rule === i.rule) && (r.kind === 'pool' || !r.met)).sort((a, b) => b.opened - a.opened).map(r => {
        const missing = otherSide(r.sheet, r.opener), asks = r.sheet[missing] || [];
        return { room: r.id, rule: r.rule, title: r.title, kind: r.kind, fingerprint: r.fingerprint, openedBy: r.sides[r.opener].label, opener: r.opener,
          waitingFor: r.kind === 'pool' ? 'people' : missing, side: missing, public: r.public || {},
          asks: asks.map(d => ({ key: d.key, label: d.label, type: d.type, options: d.options, proof: d.proof, public: d.public })),
          ...(r.sheet.brought ? { sheet: r.sheet.brought } : {}),
          people: r.kind === 'pool' ? r.people : undefined, until: new Date(r.until).toISOString() };
      }) };
    }
    // COME INTO A ROOM. The rule sheet looks at both sides together, a token is written for each side, and the data is wiped.
    async function bring(input) {
      await ready;
      const i = input || {}, now = Date.now();
      tidy(now);
      const room = rooms[i.room];
      if (!room || room.met) return { error: 'This room is not open any more.' };
      const sheet = room.sheet, other = otherSide(sheet, room.opener);
      if (i.side !== other) return { error: 'This room is waiting for the ' + other + '.' };
      if (i.accepts !== room.fingerprint) return { error: 'This room runs rule sheet ' + room.fingerprint + ', not the one this side accepted. Nothing was sent.' };
      const me = await sideOf(i, 'meet:bring:' + room.id + ':' + room.fingerprint, sheet);
      if (!me) return no('Only a joined business, or a personal agent with a real person pass, can come in.');
      if (me.refused) return { error: me.refused };
      const them = room.sides[room.opener];
      if (them.holder === me.holder) return { error: 'An agent cannot meet itself.' };
      // THE LOOK LIMIT. One pair may meet over one rule sheet only a few times a day, so nobody can rebuild the other side's
      // data from many small looks.
      if (room.kind === 'pair') {
        const pairKey = await MG.stamp.mark([them.holder, me.holder].sort().join('|') + '|' + room.fingerprint), l = looksBy[pairKey] || (looksBy[pairKey] = { n: 0, until: now + DAY });
        if (l.n >= (host().looksPerPair || 3)) return { error: 'These two sides have met over this rule sheet ' + l.n + ' times today. That is the limit.' };
        l.n++;
      }
      const mine = await fieldsOf(sheet[me.side] || [], i.data, i.facts, me.holder);
      const S = { ...fieldsNow(room), [me.side]: mine.fields };
      let seen;
      try { seen = sheet.look(S, room.kept); } catch (e) { return { error: 'The rule sheet could not look: ' + text(e.message, 120) }; }
      const pub = publicOf(sheet, S), sides = { [room.opener]: them.label, [me.side]: me.label };
      counts.valuesDropped += Object.keys(mine.fields).length + (room.kind === 'pair' ? Object.keys(them.fields).length : 0);
      try {
        if (room.kind === 'pool') return await intoPool(room, sheet, me, mine, seen, them, sides, pub);
        room.sides[me.side] = { ...me, ...mine, shareKey: !!i.shareKey && whoIs(sheet, me.side) === 'person' };
        for (const s of sidesOf(sheet)) {
          const o = room.sides[otherSide(sheet, s)];
          // TOKENS BACK. If the other side is a person who agreed, this token names their agent's key, so this side can
          // send them a certificate token afterwards (an offer letter), and it carries their device-signed approval and
          // person pass, so the fingerprint can be checked again without the middle ground (core/swipe.js recheck).
          room.notes[s] = await writeNote(room, s, room.sides[s].holder, sides, o.shown, notesFor(sheet.notes[s], seen[s], pub), seen.outcome && seen.outcome[s], o.shareKey ? { replyTo: o.holder, ...(o.swipe ? { swipe: o.swipe } : {}) } : null);
        }
      } catch (e) { delete rooms[room.id]; return { error: text(e.message, 160) }; }
      // THE WIPE. Both sides' data leaves the room now. Only the opener's token waits, for the opener to collect.
      for (const s in room.sides) delete room.sides[s].fields;
      room.met = now;
      const mineNote = room.notes[me.side]; delete room.notes[me.side];
      note('Both sides met in "' + room.title + '". Two tokens were written and signed. The data in the room was wiped.');
      return { note: mineNote, steps: ['Both sides’ data looked at under rule sheet ' + room.fingerprint, 'Two tokens written, in fixed shapes, and signed', 'The data in the room was wiped'] };
    }
    // A POOL ROOM: one office, many people. Each person is counted once and gets a token; the office gets counts only.
    async function intoPool(room, sheet, me, mine, seen, them, sides, pub) {
      const mark = await MG.stamp.mark('pool|' + room.id + '|' + me.passStamp);
      if (poolMarks.has(mark)) return { error: 'This person was already counted in this room.' };
      const token = await writeNote(room, me.side, me.holder, sides, them.shown, notesFor(sheet.notes[me.side], seen[me.side], pub), seen.outcome && seen.outcome[me.side]);
      poolMarks.add(mark);
      if (seen.count) {
        room.people++;
        for (const g in sheet.groups) { const v = text(sheet.groups[g].of(mine.fields), 40), t = room.tally[g] || (room.tally[g] = {}); t[v] = (t[v] || 0) + 1; }
        if (seen.keep) { const g = text(seen.keep[0], 80), list = room.kept[g] || (room.kept[g] = []); if (list.length < 10000) list.push(Number(seen.keep[1]) || 0); }
      }
      note('A person came into the pool room "' + room.title + '". ' + (seen.count ? 'Counted; ' : 'Not counted; ') + 'their details were dropped.');
      return { note: token, steps: ['Looked at under rule sheet ' + room.fingerprint, seen.count ? 'Added to the counts. The details were dropped.' : 'Not counted.'] };
    }
    // THE OPENER COLLECTS its token. A pool room's office gets counts so far, with groups smaller than 3 hidden.
    async function pickup(input) {
      await ready;
      const i = input || {}, room = rooms[i.room];
      if (!room) return { error: 'This room is not open any more.' };
      const sheet = room.sheet, me = await sideOf(i, 'meet:pickup:' + room.id, sheet);
      if (!me || me.side !== room.opener || room.sides[room.opener].holder !== me.holder) return no('Only the side that opened this room can collect from it.');
      if (room.kind === 'pool') {
        const hide = t => Object.fromEntries(Object.entries(t || {}).map(([k, v]) => [k, v < SMALL_GROUP ? 'fewer than ' + SMALL_GROUP : v]));
        const counted = {}, pool = otherSide(sheet, room.opener);
        for (const g in sheet.groups) {
          const order = sheet.groups[g].order || ((sheet[pool] || []).find(d => d.key === g) || {}).options || [], at = k => order.includes(k) ? order.indexOf(k) : order.length;
          counted[sheet.groups[g].label] = hide(Object.fromEntries(Object.entries(room.tally[g] || {}).sort((x, y) => at(x[0]) - at(y[0]))));
        }
        return { note: await writeNote(room, room.opener, me.holder, { [pool]: 'verified people, each with a real person pass', [room.opener]: me.label }, [{ what: sheet.poolShows || 'Each person’s details', proof: sheet.poolProof || 'as each person brought them' }],
          notesFor(sheet.notes[room.opener], { people: room.people }, room.public), 'Counts so far. Groups smaller than ' + SMALL_GROUP + ' are not shown.', { counts: counted }), waitingFor: 'people', people: room.people };
      }
      if (!room.notes[room.opener]) return { waiting: true, waitingFor: otherSide(sheet, room.opener) };
      const mine = room.notes[room.opener]; delete rooms[room.id];
      note('The token for "' + room.title + '" was collected. The room is closed.');
      return { note: mine };
    }

    // ---------- Certificate tokens back, through the middle ground ----------
    // After a meeting a business can send a certificate token to the key a person's agent shared there (the token's replyTo).
    // The middle ground checks it like any certificate token, holds it in memory, and hands it over when that agent collects it.
    const mail = {};        // an agent's open key -> certificate tokens waiting for it
    async function deliver(input) {
      await ready;
      const i = input || {}, now = Date.now(), to = text(i.to, 200), paper = i.paper;
      if (!isJoined(i)) return no('Only a joined business can send certificate tokens through this middle ground.');
      if (!paper || paper.madeBy !== i.from) return { error: 'A business sends only certificate tokens it signed itself.' };
      const c = await paperCheck(paper, to);
      if (!c.good) return { error: 'This certificate token does not pass its own check: ' + c.why + '.' };
      const box = (mail[to] || []).filter(m => m.until > now);
      if (box.length >= 20) return { error: 'This agent has too many certificate tokens waiting.' };
      box.push({ paper, until: now + DAY }); mail[to] = box;
      counts.papersPassed++;
      note('A business sent a certificate token to an agent. It waits here, in memory, until that agent collects it.');
      return { delivered: true, check: c.confirmed ? c.how : 'signed, but ' + c.how };
    }
    // Only the agent itself can collect: it signs "mailbox" and the time with the key the tokens were sent to.
    async function mailbox(input) {
      const i = input || {}, now = Date.now(), at = new Date(i.at).getTime();
      if (!(Math.abs(now - at) < 2 * 60000) || !await MG.stamp.check(text(i.holder, 200), 'mailbox|' + i.at, text(i.stamp, 200))) return no('Only the agent the certificate tokens were sent to can collect them.');
      const papers = (mail[i.holder] || []).filter(m => m.until > now).map(m => m.paper);
      delete mail[i.holder];
      if (papers.length) note('An agent collected ' + papers.length + ' certificate token' + (papers.length === 1 ? '' : 's') + '. They have left the middle ground.');
      return { papers };
    }

    // ---------- Checking a token ----------
    // Anyone shown a token this middle ground made can ask here: the stamp, the time, and for a token a program carries
    // as one line (core/carry.js), that its holder showed it, to this receiver, just now, once. With use: true, a token
    // marked "once" is used up. (MG.verify checks the stamp alone from anywhere, with the key at /api/key.)
    const usedUp = new Map(), shows = new Map();
    async function check(input) {
      await ready;
      const i = input || {}, carried = i.carried ? MG.carry.open(i.carried) : null, t = carried ? carried.token : i.token, now = Date.now();
      counts.tokensChecked++;
      for (const m of [usedUp, shows]) for (const [k, until] of m) if (until < now) m.delete(k);
      if (!t || typeof t !== 'object' || !await MG.stamp.check(keyFor(t), MG.wordsOf(t), text(t.stamp, 200))) return { good: false, why: 'Not made by this middle ground, or changed after it was made.' };
      if (new Date(t.goodUntil).getTime() < now) return { good: false, why: 'Its time has run out.' };
      if (carried) {
        if (!await MG.carry.shownRight(t, carried.show, text(i.to, 80), now)) return { good: false, why: 'It was not shown by the program it was made for, or the showing is old or was meant for someone else.' };
        if (shows.has(carried.show.stamp)) return { good: false, why: 'This showing was already used. The program must show the token afresh.' };
        shows.set(carried.show.stamp, now + MG.carry.fresh);
      }
      if (i.use && t.uses === 'once') {
        if (usedUp.has(t.id)) return { good: false, why: 'It was already used once.' };
        usedUp.set(t.id, new Date(t.goodUntil).getTime());
      }
      return { good: true, says: t.says, for: t.for, confirmed: t.confirmed, goodUntil: t.goodUntil, uses: t.uses };
    }
    // The host's stamp on a plain statement, so a claim it makes in public stays on record under its name.
    async function state(words) { await ready; return seal({ ...words, at: new Date().toISOString() }); }

    // ---------- The code line ----------
    // A visitor may state which public starter code it runs (core/code.js). The host picks one rule in host.js:
    //   "note": serve every authenticated visitor and count who states approved code;  "only": refuse the rest.
    // The code line is the visitor's own statement. It adds a filter. It is not proof of what the visitor runs.
    const accepted = () => opts.approved || MG.approved || [];
    const codeRule = () => opts.starterCode || host().starterCode || 'note';
    const door = fn => function (i) {
      const good = !!(i && i.runs) && accepted().includes(i.runs);
      if (!good && codeRule() === 'only') { counts.refused++; note('A visitor that did not state an approved starter code was refused.'); return { error: 'This middle ground serves only visitors that state an approved starter code. The accepted list is on its page.' }; }
      counts[good ? 'approvedCode' : 'otherCode']++;
      return fn(i);
    };

    // WHAT ANYONE CAN SEE: counts, the keys, the lists it trusts, and the rooms (what is held, never a value).
    function stats() {
      return {
        name: myName, address: myAddress, stampKey: stampOpen, keyId,
        oldKeys: Object.keys(oldKeys).map(id => ({ keyId: id, key: oldKeys[id] })),
        counts, requestsByProvider: usage, host: MG.host || null,
        starterCode: { rule: codeRule(), accepted: accepted() },
        broughtSheets: allowsBrought(),
        known: Object.keys(MG.known || {}).map(n => ({ name: n, web: MG.known[n].web || '', key: MG.known[n].key })),
        registries: Object.keys(MG.registries || {}).map(n => ({ name: n, web: MG.registries[n].web || '', key: MG.registries[n].key, testOnly: !!MG.registries[n].testOnly })),
        openJoin: host().openJoin !== false,
        inMemoryNow: { rooms: Object.keys(rooms).length, papersWaiting: Object.values(mail).reduce((n, b) => n + b.length, 0), businesses: Object.keys(joined).length },
        meetings: Object.values(rooms).map(r => ({ room: r.id, title: r.title, rule: r.rule, kind: r.kind, fingerprint: r.fingerprint, opened: new Date(r.opened).toISOString(), until: new Date(r.until).toISOString(),
          state: r.kind === 'pool' ? r.people + (r.people === 1 ? ' person' : ' people') + ' counted' : r.met ? 'met; token waiting for the ' + r.opener : 'waiting for the ' + otherSide(r.sheet, r.opener),
          inside: r.kind === 'pool' ? ['the office’s public fields, and counts'] : r.met ? ['the opener’s signed token, nothing else'] : ['the ' + r.opener + '’s data, in memory until the ' + otherSide(r.sheet, r.opener) + ' comes'] })),
        recent,
      };
    }

    // Reading the two public lists is open to all; everything else passes the code-line door.
    const served = { join, open, bring, pickup, deliver, mailbox, check };
    for (const name in served) served[name] = door(served[name]);
    return { ...served, rules, rooms: roomList, state, stats, ready };
  };

  if (typeof module !== 'undefined') module.exports = MG;
})(typeof window !== 'undefined' ? window : globalThis);
