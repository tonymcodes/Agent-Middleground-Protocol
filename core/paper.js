// CERTIFICATE TOKENS. The proof a person brings with them: a salary credit, a bill, a warranty, a bank balance, a ticket.
// An ISSUER (an employer, a shop, a maker, a bank, a ticket office: anyone) makes the paper and signs it with its own key,
// at the moment it makes it, the way a website's server signs with its https certificate key.
//
// How anyone knows the issuer's key is really that issuer's, without calling anyone (it works like https):
//   1. A REGISTRY (a business registry, a banking regulator, a university body) checks the issuer once and signs a
//      KEY NOTE: "this issuer, at this web address, has this key, until this date". Like a certificate company signing
//      a website's certificate.
//   2. The issuer puts its key note inside every paper it signs.
//   3. A middle ground keeps a short public list of the registries it trusts (known.js), the way a browser keeps its
//      list of certificate companies. It checks: the registry signed the key note, the key note names this issuer,
//      and the issuer's key signed the paper. A big issuer can also be listed directly.
// The paper is issued to one agent, by that agent's open key, so a copy in anyone else's hands is useless.
//
//   paper:    { kind: 'paper', type, madeBy, keyNote, heldBy, facts, issued, goodUntil, stamp }
//   key note: { kind: 'key note', madeBy (the registry), name (the issuer), is, web, key, made, goodUntil, stamp }
//
// The same file runs in every part: the issuer signs with it, the person's agent checks its papers with it, and the
// middle ground checks the papers it is shown with it.
(function (root) {
  const MG = root.MG || (root.MG = {});
  const DAY = 86400000, text = (v, n) => String(v == null ? '' : v).slice(0, n || 200);
  MG.paper = {
    // A REGISTRY signs a key note for one issuer. registry is { name, secret }.
    async keyNote(registry, issuer, days) {
      const now = Date.now(), n = { kind: 'key note', madeBy: registry.name, name: issuer.name, is: issuer.is || 'issuer', web: issuer.web || '', key: issuer.open, made: new Date(now).toISOString(), goodUntil: new Date(now + (days || 365) * DAY).toISOString() };
      n.stamp = await MG.stamp.make(registry.secret, MG.wordsOf(n));
      return n;
    },
    // AN ISSUER signs a paper for one agent. issuer is { name, secret, open, keyNote }. facts is what the paper says.
    // In the meeting samples one paper backs one value: facts = { field, value }. A real payslip carries many values.
    async issue(issuer, type, facts, heldBy, days) {
      const now = Date.now(), p = { kind: 'paper', type: text(type, 60), madeBy: issuer.name, ...(issuer.keyNote ? { keyNote: issuer.keyNote } : { issuerKey: issuer.open }), heldBy, facts: { ...facts }, issued: new Date(now).toISOString(), goodUntil: new Date(now + (days == null ? 365 : days) * DAY).toISOString() };
      p.stamp = await MG.stamp.make(issuer.secret, MG.wordsOf(p));
      return p;
    },
    // CHECK A PAPER. trust = { registries: { name: openKey }, known: { name: openKey }, open: true|false }
    //   registries  the registries this checker trusts (known.js)
    //   known       issuers listed directly, or joined at this middle ground
    //   open        whether a paper that carries only its own key is accepted, as "not confirmed here"
    // Gives { good, confirmed, by, how } or { good: false, why } in plain words.
    async check(p, holder, trust, now) {
      now = now || Date.now(); trust = trust || {};
      const no = why => ({ good: false, confirmed: false, by: p && text(p.madeBy, 60), why });
      if (!p || typeof p !== 'object' || !p.stamp) return no('it is not a certificate token');
      let key = '', how = '';
      const listed = trust.known && trust.known[p.madeBy], n = p.keyNote;
      if (listed) { key = listed; how = 'listed here'; }
      else if (n) {
        const reg = trust.registries && trust.registries[n.madeBy];
        if (!reg) return no('its key was confirmed by "' + text(n.madeBy, 60) + '", a registry this checker does not trust');
        if (!await MG.stamp.check(reg, MG.wordsOf(n), text(n.stamp, 200))) return no('its key note was not signed by the registry it names');
        if (n.name !== p.madeBy) return no('its key note is for a different issuer');
        if (new Date(n.goodUntil).getTime() < now) return no('the issuer’s key note has run out');
        key = n.key; how = 'key confirmed by ' + text(n.madeBy, 60);
      } else if (p.issuerKey && trust.open) { key = p.issuerKey; how = 'its key is not confirmed by any registry trusted here'; }
      else return no('there is no way to confirm the issuer’s key');
      if (!await MG.stamp.check(text(key, 200), MG.wordsOf(p), text(p.stamp, 200))) return no('the signature does not match: it was changed after signing, or signed with another key');
      if (holder && p.heldBy !== holder) return no('it was issued to a different agent');
      if (p.goodUntil && new Date(p.goodUntil).getTime() < now) return no('it has run out');
      return { good: true, confirmed: !!(listed || n), by: text(p.madeBy, 60), how };
    },
  };
  // AN ISSUER: anyone who gives an agent a certificate token. A shop, an employer, a bank, a maker, an office, and any
  // business agent (the company starter uses this). It keeps its secret key; its key note from a registry goes inside
  // every paper it signs.
  //   const shop = MG.issuer('Pedal Point', myKey, { keyNote });
  //   const bill = await shop.paper('bill', { field: 'bill', value: 'Velora R2 road bike; 2025-03-10; ₹48000' }, agentOpenKey);
  MG.issuer = function (name, key, options) {
    const keyNote = options && options.keyNote;
    return {
      name, open: key.open, keyNote,
      // A SIGNED PAPER (core/paper.js): type, what it says, the open key of the agent it is issued to, and days it stays good.
      paper(type, facts, heldBy, days) { return MG.paper.issue({ name, secret: key.secret, open: key.open, keyNote }, type, facts, heldBy, days); },
    };
  };
  if (typeof module !== 'undefined') module.exports = MG;
})(typeof window !== 'undefined' ? window : globalThis);
