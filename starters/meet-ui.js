// SHARED PAGE CODE for the two meeting pages (personal agent and business agent): finding a middle ground, the data form,
// and showing a note from the middle ground the way the paper's token figure does. Pages only; no protocol logic here.
(function (root) {
  const MG = root.MG;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Kept in this browser only: keys, the middle ground subscribed to, a company's join key. Works without it too.
  const store = {
    get(k) { try { return localStorage.getItem('amp.' + k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem('amp.' + k, v); } catch {} },
  };
  const q = new URLSearchParams(location.search);
  // Inside the one-page view (try/index.html), the use case is picked once, in the bar above all four columns, so this
  // page hides its own use-case buttons. Opened alone, the page keeps them.
  try { if (root.parent !== root && /\/try\/(index\.html)?$/.test(root.parent.location.pathname)) document.documentElement.classList.add('in-try'); } catch {}
  const status = async addr => { try { const c = new AbortController(); setTimeout(() => c.abort(), 5000); const r = await fetch(addr.replace(/\/$/, '') + '/api/status', { signal: c.signal }); const s = await r.json(); return s && s.running ? s : null; } catch { return null; } };

  // FINDING THE MIDDLE GROUND. With the starter code, the two sides find the middle ground that is running, with nothing
  // to set up. In order:
  //   1. ?mg=<address> in this page's address (starters/serve.js adds it when it is given one),
  //   2. the one this agent or business chose before, kept in this browser, if it still answers,
  //   3. the server that served this page, if it is a middle ground (npm start serves every page),
  //   4. the sample middle ground on this computer, http://localhost:8787.
  // The card below also shows the ways an agent finds one in real use (see starters/README.md): the agent provider's
  // list of trusted middle grounds, the middle grounds a business names on its own website, and any address, checked first.
  const SAMPLE = 'http://localhost:8787', clean = a => String(a || '').trim().replace(/\/$/, '');
  async function findGround() {
    if (q.get('mg')) return clean(q.get('mg'));
    const saved = clean(store.get('mg'));
    if (saved && await status(saved)) return saved;
    if (/^https?:$/.test(location.protocol) && await status(location.origin)) return location.origin;
    return SAMPLE;
  }
  // 1. THE TRUSTED LIST that comes with the agent (starters/middlegrounds.json): a few hosts its provider chose.
  async function trustedList() {
    try { return (await (await fetch(new URL('../middlegrounds.json', document.baseURI))).json()).map(e => ({ ...e, address: clean(e.address), from: 'on this agent’s trusted list' })); } catch { return []; }
  }
  // 2. WHERE A BUSINESS MEETS. A business names its middle grounds on its own website, at /.well-known/amp.json:
  //    { "business": "...", "meetsAt": [{ "name": "...", "address": "https://..." }], "ruleSheets": ["credit-offer"] }
  //    The file sits on the business's own https address, so nobody else can change it.
  async function askBusiness(site) {
    try {
      const j = await (await fetch(clean(site) + '/.well-known/amp.json')).json();
      return (j.meetsAt || []).map(e => ({ name: e.name || 'A middle ground', address: clean(e.address), from: 'named by ' + (j.business || 'the business') + ' on its website' }));
    } catch { return null; }
  }
  // 3. ANY ADDRESS, checked first: MG.inspect reads every file it shows, works the fingerprints out again, and compares
  //    them with the public repo, its public deploy and its audit (core/link.js).
  async function inspectCard(box, addr) {
    box.innerHTML = '<p class="empty">Checking ' + esc(addr) + '…</p>';
    let seen; try { seen = await MG.inspect(addr); } catch (e) { box.innerHTML = '<p class="small">Could not check it: ' + esc(e.message) + '</p>'; return null; }
    box.innerHTML = `<div class="small"><b>${seen.good ? 'Every check passes.' : 'Not every check passes.'}</b> ${seen.good ? '' : 'A real agent uses such a middle ground only if it is on its trusted list, or the person’s own rules allow it. A copy running on this computer has no public repo, deploy or audit to show, so the last checks fail here.'}</div>`
      + '<ul class="small" style="margin:4px 0 0 18px;padding:0">' + seen.checks.map(c => `<li>${c.good ? '✓' : '✗'} ${esc(c.what)}</li>`).join('') + '</ul>';
    return seen;
  }
  // The card that shows the middle ground in use, and lets the person or business find another.
  async function groundCard(el, addr, onPick) {
    const s = await status(addr);
    el.innerHTML = `<h2>The middle ground this agent uses</h2>
      <div class="row"><span class="dot ${s ? 'on' : ''}"></span><b>${esc(s ? s.name : 'Not reachable')}</b></div>
      <div class="small muted mono">${esc(addr)}</div>
      ${s ? `<div class="small muted">code ${esc(s.running.codeFingerprint.slice(0, 16))}… · key id ${esc(s.keyId)} · keeps nothing</div>` : `<div class="small muted">Start it with <code>npm start</code> in the repo folder, or find another below.</div>`}
      <div class="row" style="margin-top:8px"><button class="plain" data-find>Find middle grounds</button><button class="plain" data-check ${s ? '' : 'disabled'}>Check this one</button></div>
      <div data-list hidden style="margin-top:10px"></div><div data-seen style="margin-top:8px"></div>`;
    el.querySelector('[data-check]').onclick = () => inspectCard(el.querySelector('[data-seen]'), addr);
    el.querySelector('[data-find]').onclick = async () => {
      const box = el.querySelector('[data-list]'); box.hidden = !box.hidden; if (box.hidden) return;
      box.innerHTML = `<div class="small muted" style="margin-bottom:6px">How an agent finds a middle ground: from its trusted list, from the business it wants to meet, or by any address it checks first.</div>
        <div data-rows><p class="empty">Asking each one…</p></div>
        <div class="row" style="margin-top:6px"><input type="text" placeholder="A business’s website, such as http://localhost:8789" data-biz style="flex:1"><button class="plain" data-ask>Where does it meet?</button></div>
        <div class="row"><input type="text" placeholder="Or any middle ground’s address: https://…" data-addr style="flex:1"><button class="plain" data-use>Check it</button></div><div data-seen2></div>`;
      const drawRows = async (list, said) => {
        const rows = await Promise.all(list.map(async e => ({ ...e, status: await status(e.address) })));
        box.querySelector('[data-rows]').innerHTML = (said ? `<p class="small">${esc(said)}</p>` : '') + rows.map((e, n) => `<div class="dir"><div class="row"><span class="dot ${e.status ? 'on' : ''}"></span><b>${esc(e.name)}</b></div>
          <div class="small muted mono">${esc(e.address)}</div><div class="small muted">${esc(e.from)} · ${e.status ? 'running · ' + esc(e.status.name) : esc(e.note || 'not reachable')}</div>
          ${e.address === addr ? '<span class="badge stamp">in use</span>' : `<button class="plain" data-pick="${n}" ${e.status ? '' : 'disabled'}>Use this one</button>`}</div>`).join('');
        box.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => onPick(rows[b.dataset.pick].address));
      };
      const listed = await trustedList(), here = /^https?:$/.test(location.protocol) && !listed.some(e => e.address === location.origin) && await status(location.origin)
        ? [{ name: 'The middle ground that served this page', address: location.origin, from: 'the server this page came from' }] : [];
      await drawRows([...here, ...listed]);
      box.querySelector('[data-ask]').onclick = async () => {
        const site = box.querySelector('[data-biz]').value.trim(); if (!site) return;
        const named = await askBusiness(site);
        await drawRows(named || [], named ? (named.length ? '' : 'That business names no middle ground.') : 'No /.well-known/amp.json answers at ' + site + '.');
      };
      box.querySelector('[data-use]').onclick = async () => {
        const v = clean(box.querySelector('[data-addr]').value); if (!v) return;
        const out = box.querySelector('[data-seen2]'); await inspectCard(out, v);
        if (await status(v)) { const b = document.createElement('button'); b.className = 'plain'; b.textContent = 'Use it'; b.onclick = () => onPick(v); out.append(b); }
      };
    };
    return s;
  }

  // WHAT THIS SIDE TRUSTS: the registries and directly listed issuers its middle ground shows on its status, so the papers
  // can be checked here exactly as the middle ground will check them.
  const trustFrom = s => ({ registries: Object.fromEntries(((s && s.registries) || []).map(r => [r.name, r.key])), known: Object.fromEntries(((s && s.known) || []).filter(k => k.key).map(k => [k.name, k.key])), open: !s || s.openJoin !== false });

  // THE DATA FORM. defs are a rule sheet's fields for this side. proof(key, value) gives the badge for one value:
  // which paper backs it, or why none does. The form is rebuilt only when its fields change, so typing is never lost.
  function form(el, defs, values, side, proof) {
    const badge = d => {
      const v = values[d.key] == null ? '' : values[d.key];
      return proof(d.key, v) + (side === 'business' ? (d.public ? ' <span class="badge own">public</span>' : ' <span class="badge private">private: seen in the room only</span>') : '');
    };
    const sig = JSON.stringify(defs.map(d => [d.key, d.type, d.options])) + JSON.stringify(values);
    if (el.dataset.sig !== sig || !el.querySelector('[data-k]')) {
      el.innerHTML = defs.map(d => {
        const v = values[d.key] == null ? '' : values[d.key];
        const input = d.type === 'choice' ? `<select data-k="${esc(d.key)}">${(d.options || []).map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
          : d.type === 'lines' ? `<textarea data-k="${esc(d.key)}">${esc(v)}</textarea>` : `<input type="text" data-k="${esc(d.key)}" value="${esc(v)}">`;
        return `<label class="f"><span>${esc(d.label)} <i data-b="${esc(d.key)}" style="font-style:normal"></i></span>${input}</label>`;
      }).join('') || '<p class="empty">Nothing to bring yet.</p>';
      el.querySelectorAll('[data-k]').forEach(i => i.oninput = i.onchange = () => { values[i.dataset.k] = i.value; el.dataset.sig = JSON.stringify(defs.map(d => [d.key, d.type, d.options])) + JSON.stringify(values); const d = defs.find(x => x.key === i.dataset.k); el.querySelector(`[data-b="${i.dataset.k}"]`).innerHTML = badge(d); });
      el.dataset.sig = sig;
    }
    for (const d of defs) { const b = el.querySelector(`[data-b="${d.key}"]`); if (b) b.innerHTML = badge(d); }
  }
  // The badge for one value, from the papers a side holds and their checks.
  function proofBadge(papers, checks, key, value) {
    const mine = papers.map((p, n) => ({ p, c: checks[n] })).filter(x => x.p && x.p.facts && x.p.facts.field === key);
    if (!mine.length) return '<span class="badge own">own word</span>';
    const same = mine.filter(x => String(x.p.facts.value) === String(value));
    const ok = same.find(x => x.c && x.c.good && x.c.confirmed);
    if (ok) return `<span class="badge stamp">signed by ${esc(ok.p.madeBy)}</span>`;
    if (same.length) { const c = same[0].c || {}; return `<span class="badge bad">token fails: ${esc(c.good ? c.how : c.why)}</span>`; }
    return '<span class="badge edited">edited: differs from its certificate token</span>';
  }

  // THE VAULT: the certificate tokens this side holds. Each one is checked here, the same way the middle ground checks it.
  // Papers can be pasted in (sent from an issuer, like an email), looked into, changed (which breaks the signature, as a
  // test), copied out, or removed. opts: { title, holder, papers, trust, onChange }.
  async function vault(el, opts) {
    const papers = opts.papers, checks = await Promise.all(papers.map(p => MG.paper.check(p, opts.holder, opts.trust)));
    // TO CHECK BY HAND: the issuer's key id and web address. The issuer publishes the same key id on its own https website,
    // so anyone can open the site and compare, the way a person can look at a website's certificate.
    const ids = await Promise.all(papers.map(async p => { const k = p.keyNote ? p.keyNote.key : p.issuerKey; return k ? MG.stamp.keyId(String(k)) : ''; }));
    const status = c => !c ? '' : c.good && c.confirmed ? `<span class="badge stamp">signature good · ${esc(c.how)}</span>` : c.good ? `<span class="badge edited">signed, but ${esc(c.how)}</span>` : `<span class="badge bad">fails: ${esc(c.why)}</span>`;
    const open = el.querySelector('details[data-paste]') && el.querySelector('details[data-paste]').open;
    el.innerHTML = `<h2>${esc(opts.title || 'Certificate tokens this agent holds')}</h2>
      <p class="small muted" style="margin:0 0 8px">Signed by whoever issued them, and checked here exactly as the middle ground will check them. To check an issuer by hand, compare its key id with the one it publishes on its own website.</p>
      ${papers.map((p, n) => `<div class="paper"><div class="row" style="justify-content:space-between"><b>${esc(p.type)}</b><span class="small muted">${esc(p.madeBy)}</span></div>
        <div class="small mono">${esc(p.facts && 'value' in p.facts ? p.facts.value : JSON.stringify(p.facts))}</div>
        <div>${status(checks[n])}</div>
        <div class="small muted">issuer key id <span class="mono">${esc(ids[n] || 'none')}</span>${p.keyNote && p.keyNote.web ? ' · ' + esc(p.keyNote.web) : ''}${p.keyNote ? ' · key note from ' + esc(p.keyNote.madeBy) : ' · no key note'}</div>
        <div class="row small"><button class="link" data-edit="${n}">Look inside</button><button class="link" data-copy="${n}">Copy</button><button class="link" data-del="${n}">Remove</button></div>
        <div data-box="${n}" hidden><textarea class="mono" data-json="${n}" style="min-height:180px">${esc(JSON.stringify(p, null, 2))}</textarea>
        <div class="row"><button class="plain" data-save="${n}">Save my change</button><span class="small muted">Changing any word breaks the issuer’s signature.</span></div></div></div>`).join('') || '<p class="empty">No certificate tokens yet.</p>'}
      <details data-paste ${open ? 'open' : ''}><summary class="small">Paste a certificate token an issuer sent</summary><textarea class="mono" data-in placeholder="Paste the token here"></textarea><div class="row"><button class="plain" data-add>Add to the vault</button><span class="small" data-msg></span></div></details>`;
    const set = list => { opts.onChange(list); };
    el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { const x = el.querySelector(`[data-box="${b.dataset.edit}"]`); x.hidden = !x.hidden; });
    el.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { try { navigator.clipboard.writeText(JSON.stringify(papers[b.dataset.copy])); b.textContent = 'Copied'; } catch { b.textContent = 'Copy failed'; } });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => set(papers.filter((_, n) => n !== Number(b.dataset.del))));
    el.querySelectorAll('[data-save]').forEach(b => b.onclick = () => { try { const p = JSON.parse(el.querySelector(`[data-json="${b.dataset.save}"]`).value); set(papers.map((x, n) => n === Number(b.dataset.save) ? p : x)); } catch { b.textContent = 'Not valid JSON'; } });
    el.querySelector('[data-add]').onclick = () => { try { const p = JSON.parse(el.querySelector('[data-in]').value); if (!p || !p.stamp) throw 0; set([...papers, p]); } catch { el.querySelector('[data-msg]').textContent = 'That is not a certificate token.'; } };
    return checks;
  }

  // A NOTE FROM THE MIDDLE GROUND, in the same parts as the paper's figure. Field names are shown small beside each part.
  // trust: the registries and issuers this page trusts (trustFrom), used to check the other person's fingerprint again.
  function note(t, trust) {
    const div = document.createElement('div');
    div.className = 'note' + (t.for === 'business' ? ' business' : '');
    const cls = a => a === 'yes' ? 'yes' : a === 'no' ? 'no' : a === 'not proven' ? 'np' : '';
    const other = Object.entries(t.sides || {}).filter(([s]) => s !== t.for).map(([, v]) => v).join(', ');
    const counts = t.counts ? Object.entries(t.counts).map(([g, rows]) => `<section><h3>${esc(g)} <code>counts</code></h3><ul>${Object.entries(rows).map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('') || '<li><span>none yet</span></li>'}</ul></section>`).join('') : '';
    div.innerHTML = `<header>Confirmation token for the ${t.for === 'business' ? 'business agent' : esc(t.for) + '’s agent'}<span>${esc(new Date(t.made).toLocaleTimeString())}</span></header>
      <section><h3>Room and rules <code>room · rules</code></h3><p>${esc(t.rules && t.rules.title)} · rule sheet ${esc(t.rules && t.rules.fingerprint)}<br>with ${esc(other)}</p></section>
      <section><h3>The other side showed <code>otherSideShowed</code></h3><ul>${(t.otherSideShowed || []).map(s => `<li><span>${esc(s.what)}</span><span class="muted">${esc(s.proof)}</span></li>`).join('')}</ul></section>
      <section><h3>Confirmed for you <code>confirmed</code></h3><ul>${(t.confirmed || []).map(c => `<li><span>${esc(c.says)}</span><b class="${cls(c.answer)}">${esc(c.answer)}</b></li>`).join('')}</ul></section>
      ${counts}
      ${t.outcome ? `<section><h3>Outcome <code>outcome</code></h3><p>${esc(t.outcome)}</p></section>` : ''}
      ${t.replyTo ? `<section><h3>Certificate tokens back <code>replyTo</code></h3><p>The other side’s agent agreed to receive certificate tokens from you, at key <span class="mono">${esc(t.replyTo.slice(0, 16))}…</span>, sent through the middle ground.</p></section>` : ''}
      ${t.swipe ? `<section><h3>Their fingerprint, to check again <code>swipe</code></h3><p>The other person’s device signed their approval of this very request after checking their fingerprint, face or PIN. Their person pass, from ${esc(t.swipe.pass && t.swipe.pass.madeBy)}, names that device. “Check the signature” checks this again on this computer, without asking the middle ground.</p></section>` : ''}
      <section><h3>Limits <code>heldBy · goodUntil · uses</code></h3><p>Held by ${t.for === 'business' ? esc(t.heldBy) + ' only' : 'this agent only'} · good until ${esc(new Date(t.goodUntil).toLocaleDateString())} · ${esc(t.uses === 'once' ? 'one use' : t.uses)}</p></section>
      <footer><b>Written and signed by the middle ground</b> <code class="small">madeBy · makerAt · code · keyId · stamp</code><br>
        <span class="muted">${esc(t.madeBy)} · ${esc(t.makerAt || '')} · ${esc(t.code)} · key id ${esc(t.keyId)}</span>
        <div class="row"><button class="plain" data-check>Check the signature</button><button class="plain" data-raw>Show the whole token</button><span data-out class="small"></span></div><pre hidden data-json></pre></footer>`;
    div.querySelector('[data-check]').onclick = async () => {
      const out = div.querySelector('[data-out]'); out.textContent = 'Checking…';
      const r = await MG.verify(t);
      const f = r.good && t.swipe && MG.swipe ? await MG.swipe.recheck(t.swipe, trust || trustFrom(null)) : null;
      out.innerHTML = (r.good ? `<span class="badge stamp">Good: signed by ${esc(r.maker)}, not changed</span>` : `<span class="badge edited">${esc(r.why)}</span>`)
        + (f ? ' ' + (f.ok ? `<span class="badge stamp">Fingerprint checked again here: good</span>` : `<span class="badge edited">Fingerprint: ${esc(f.why)}</span>`) : '');
    };
    div.querySelector('[data-raw]').onclick = () => { const p = div.querySelector('[data-json]'); p.hidden = !p.hidden; p.textContent = JSON.stringify(t, null, 2); };
    return div;
  }

  // The page that holds all three (try/index.html) keeps the use case in step on both sides.
  // It also passes papers from the issuer to an agent, and tells the issuer which agents are on the page.
  function linkUseCase(onRule) {
    root.addEventListener('message', e => { if (e.data && e.data.amp === 'rule') onRule(e.data.rule, true); });
    return rule => { if (root.parent !== root) root.parent.postMessage({ amp: 'rule', rule }, '*'); };
  }

  // HTTPS OR THIS COMPUTER ONLY. A browser lets a page make and check signatures only over https, or on localhost. A page
  // opened over plain http from another machine says so, and waits, instead of failing half-way.
  if (!(root.crypto && root.crypto.subtle)) {
    addEventListener('DOMContentLoaded', () => { document.querySelector('main').innerHTML = `<div class="card"><h2>Open this page over https</h2><p>This page was opened over plain http from another machine. A browser lets a page make and check signatures only over https, or on this same computer (localhost).</p><p class="small">Serve it with a certificate (TLS_CERT and TLS_KEY, see the README), or open it from the middle ground’s own https address: it serves every page of the repo.</p></div>`; });
    MG.ui = { esc, store, q, findGround: () => new Promise(() => {}) };
    return;
  }
  MG.ui = { esc, store, q, status, findGround, trustedList, askBusiness, inspectCard, groundCard, form, proofBadge, vault, trustFrom, note, linkUseCase };
})(typeof window !== 'undefined' ? window : globalThis);
