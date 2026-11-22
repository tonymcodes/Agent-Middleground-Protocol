// COMPANY KIT. For a business agent: a company's, an office's or an institution's own system at a middle ground.
// It joins once and keeps its key. Then it opens rooms with a rule sheet (a built-in one, or one of its own), comes into
// rooms a person opened, collects its confirmation tokens, checks tokens it is shown, and, if it has a stamp key, issues
// certificate tokens to people's agents (an offer letter after a meeting).
//
//   const call = MG.link('https://middleground.example');
//   const bank = MG.company('Northbank', call, await MG.stamp.newKey(), await MG.codeOf('company', MG.read));
//   await bank.join();
//   const { rules } = await bank.meetRules();
//   const { room } = await bank.meetOpen(rules.find(r => r.id === 'credit-offer'), { minIncome: '50000', ... });
//   ...a person's agent comes into the room...
//   const { note } = await bank.meetPickup(room);
//
// A RULE SHEET OF ITS OWN. A business can bring a rule sheet as plain data (core/sheet.js) to any middle ground that
// accepts brought sheets, with no change to the middle ground:  bank.meetOpen({ sheet: mySheet }, data).
// The same file runs on a server and in a web page. The middle ground itself does not use it.
(function (root) {
  const MG = root.MG || (root.MG = {});
  // runs is the code line: which public starter code this system runs (see code.js). It goes with every request.
  MG.company = function (name, call0, stampKey, runs) {
    const call = (what, data, query) => call0(what, data && runs ? { ...data, runs } : data, query);
    let key;   // given by the middle ground on joining. It is this business's authentication there.
    // A business agent is also an issuer (core/paper.js). stampKey may carry its registry key note: { secret, open, keyNote }.
    const issuer = stampKey ? MG.issuer(name, stampKey, { keyNote: stampKey.keyNote }) : null;
    return {
      name, runs: runs || '', open: stampKey ? stampKey.open : undefined,
      // JOIN once. The key from an earlier join can be given back after a restart of the business's own page.
      async join() { const r = await call('join', { name, stampKey: stampKey && stampKey.open, key }); if (r.key) key = r.key; return r; },
      resume(k) { key = k; },
      key: () => key,
      // MEETINGS (middleground/rules.js and core/sheet.js).
      meetRules() { return call('rules', {}); },
      meetRooms(rule) { return call('rooms', { rule }); },
      // OPEN A ROOM. rule: an entry from meetRules() (its id and fingerprint), or { sheet } for a rule sheet of its own,
      // which is checked here first with the same checks the middle ground runs.
      async meetOpen(rule, data, papers) {
        if (rule && rule.sheet) {
          const c = MG.sheet.check(rule.sheet);
          if (!c.ok) return { error: 'The rule sheet does not pass the checks: ' + c.problems.join('; ') + '.' };
          return call('open', { side: 'business', from: name, key, sheet: rule.sheet, accepts: await MG.sheet.fingerprint(rule.sheet), data, facts: papers || [] });
        }
        return call('open', { side: 'business', from: name, key, rule: rule.id, accepts: rule.fingerprint, data, facts: papers || [] });
      },
      // COME INTO A ROOM a person opened (room: an entry from meetRooms()).
      meetBring(room, data, papers) { return call('bring', { side: 'business', from: name, key, room: room.room, accepts: room.fingerprint, data, facts: papers || [] }); },
      meetPickup(room) { return call('pickup', { side: 'business', from: name, key, room }); },
      // CHECK a token it is shown: the token itself, or the one line of text a program showed (core/carry.js).
      check(shown, use) { return call('check', typeof shown === 'string' ? { carried: shown, to: name, use } : { token: shown, use }); },
      // ISSUE a certificate token (core/paper.js), and SEND it to a person's agent through the middle ground, to the key
      // that agent shared in a meeting (the confirmation token's replyTo). The middle ground checks it and holds it
      // until the agent collects it.
      issuePaper(type, facts, heldBy, days) { return issuer ? issuer.paper(type, facts, heldBy, days) : Promise.resolve({ error: 'This business has no stamp key.' }); },
      sendPaper(paper, to) { return call('deliver', { from: name, key, to, paper }); },
    };
  };
  if (typeof module !== 'undefined') module.exports = MG;
})(typeof window !== 'undefined' ? window : globalThis);
