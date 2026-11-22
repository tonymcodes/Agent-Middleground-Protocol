// PERSONAL AGENT KIT. The smallest working personal agent: a vault, the person's approval, and meetings at a middle ground.
// It holds the person's certificate tokens (a real person pass, payslips, bills) and the confirmation tokens it gets back.
// ONE SWIPE, ONE SCREEN (core/swipe.js). Nothing that sends the person's data leaves without the person's approval, and the
// middle ground checks it. The person sees one important item, or a short list of small ones, and one swipe approves
// exactly that. Collecting a token runs on its own.
// THE RULE SHEET FIRST. Before it brings anything into a room, the agent reads the room's rule sheet. A rule sheet the
// business brought is checked here with the same checks the middle ground runs (core/sheet.js), shown to the person in
// plain words, and accepted by its fingerprint. The person's approval covers that fingerprint, so the person approves
// exactly that sheet, and the middle ground refuses the data if the room runs any other.
//
//   const me = MG.agent(await MG.stamp.newKey(), { runs: await MG.codeOf('personal agent', MG.read) });
//   me.keep(passFromMyProvider); me.keep(payslipFromMyEmployer);
//   me.approve((holder, list) => MG.swipe.device(passkey, holder, list));   // on a phone: the fingerprint reader
//   const { rooms } = await call('rooms', { rule: 'credit-offer' });
//   const { note } = await me.meetBring(call, rooms[0], { salary: '62000, 64000, 63500' }, me.find('salary'));
//
// The same file runs on a server and in a web page.
(function (root) {
  const MG = root.MG || (root.MG = {});
  MG.agent = function (key, options) {
    options = options || {};
    const vault = [];
    // The code line: which public starter code this agent runs (see code.js). It goes with every request, under the agent's stamp.
    const runs = options.runs || '';
    let approval = null;   // how the person approves: see approve() below
    const needsApproval = 'Nothing leaves without the person’s approval (a fingerprint swipe).';
    const agent = {
      open: key.open, vault, runs,
      // A certificate token or a confirmation token arrives and is kept.
      keep(t) { vault.push(t); return t; },
      // Find tokens by the field they back ("salary"), by their type ("real person pass"), or by any test.
      find(test) { return vault.filter(typeof test === 'function' ? test : t => (t.facts && t.facts.field === test) || t.type === test); },
      pass() { return vault.find(t => t.type === 'real person pass'); },

      // THE PERSON'S APPROVAL (core/swipe.js). The page sets how, once:
      //   approve((holder, list) => MG.swipe.device(passkey, holder, list))   a real fingerprint: the screen shows the list
      //   approve((holder, list) => MG.swipe.mimic(list.length))              starter code only: a ticked box stands in for it
      approve(how) { approval = how; return agent; },
      // One approval for the list of requests on the screen. Gives { swipes: { request: approval } } or { error }.
      async approveList(purposes) {
        if (!approval) return { error: needsApproval };
        let got;
        try { got = await approval(key.open, purposes); } catch (e) { return { error: 'The fingerprint swipe did not go through: ' + ((e && e.message) || e) }; }
        return { swipes: Object.fromEntries(purposes.map(p => [p, got && got.how ? got : got && got[p]]).filter(x => x[1])) };
      },
      // Sign a request for a middle ground: the person pass, the agent's stamp on the purpose, and the person's approval
      // when the purpose needs it (unless swipe is given: an approval already made for a list that holds this request).
      async request(purpose, data, swipe) {
        if (!agent.pass()) return { error: 'This agent has no real person pass yet.' };
        if (!swipe && MG.swipe.needs(purpose)) {
          const a = await agent.approveList([purpose]);
          if (a.error) return a;
          swipe = a.swipes[purpose];
        }
        return { ...(data || {}), pass: agent.pass(), holder: key.open, ...(runs ? { runs } : {}), ...(swipe ? { swipe } : {}), holderStamp: await MG.stamp.make(key.secret, purpose + (runs ? ' | runs ' + runs : '')) };
      },
      // Sign a request and send it over a link (link.js): a middle ground in the same page, or one on the internet.
      async send(call, name, purpose, data) {
        const r = await agent.request(purpose, data);
        return r.error ? r : call(name, r);
      },

      // READ A ROOM'S RULE SHEET before bringing anything. A built-in sheet is accepted by the fingerprint the middle
      // ground states for it. A brought sheet must pass the same checks here as in the middle ground, and its fingerprint
      // must be its own. options.accept(sheet) can add the person's own rules: return true, or a reason to say no.
      // Gives { ok, fingerprint, words } or { ok: false, why }.
      async review(room, side) {
        if (!room || !room.fingerprint) return { ok: false, why: 'the room does not name its rule sheet' };
        if (!room.sheet) return { ok: true, fingerprint: room.fingerprint };
        const c = MG.sheet.check(room.sheet);
        if (!c.ok) return { ok: false, why: 'the rule sheet does not pass the checks: ' + c.problems.join('; ') };
        if (await MG.sheet.fingerprint(room.sheet) !== room.fingerprint) return { ok: false, why: 'the rule sheet is not the one the room names' };
        const mine = options.accept ? options.accept(room.sheet) : true;
        if (mine !== true) return { ok: false, why: String(mine || 'this agent’s own rules say no') };
        return { ok: true, fingerprint: room.fingerprint, words: MG.sheet.words(room.sheet, side || 'person') };
      },

      // MEETINGS. The agent goes to a room as the person's witness, with the data the person chose and the certificate
      // tokens that back it, and comes back with a signed confirmation token. side: 'person' (the default), or for two
      // people meeting, 'seller' or 'buyer'. shareKey: true lets the other side send this agent a certificate token
      // afterwards, through the middle ground (an offer letter).
      //   rule: an entry from call('rules'), with its id and fingerprint.   room: an entry from call('rooms').
      meetOpen(call, rule, data, papers, side, shareKey) {
        return agent.send(call, 'open', 'meet:open:' + rule.fingerprint, { side: side || 'person', rule: rule.id, accepts: rule.fingerprint, data, facts: papers || [], shareKey: !!shareKey });
      },
      async meetBring(call, room, data, papers, side, shareKey) {
        const r = await agent.review(room, side);
        if (!r.ok) return { error: 'This agent did not send anything: ' + r.why + '.' };
        return agent.send(call, 'bring', 'meet:bring:' + room.room + ':' + r.fingerprint, { side: side || 'person', room: room.room, accepts: r.fingerprint, data, facts: papers || [], shareKey: !!shareKey });
      },
      // ONE SWIPE FOR A LIST. The person sees several small meetings together and approves them with one swipe.
      // items: [{ room, rule, data, papers, side, shareKey }]: with a room the agent goes into it; with a rule it opens one.
      // A rule sheet with ownSwipe (a loan, a sale) is refused in a list by the middle ground: it needs a swipe of its own.
      async meetList(call, items) {
        const asks = [];
        for (const it of items) {
          const d = { side: it.side || 'person', data: it.data, facts: it.papers || [], shareKey: !!it.shareKey };
          if (it.room) {
            const r = await agent.review(it.room, it.side);
            if (!r.ok) return items.map(() => ({ error: 'This agent did not send anything: ' + r.why + '.' }));
            asks.push({ name: 'bring', purpose: 'meet:bring:' + it.room.room + ':' + r.fingerprint, data: { ...d, room: it.room.room, accepts: r.fingerprint } });
          } else asks.push({ name: 'open', purpose: 'meet:open:' + it.rule.fingerprint, data: { ...d, rule: it.rule.id, accepts: it.rule.fingerprint } });
        }
        if (new Set(asks.map(a => a.purpose)).size !== asks.length) return items.map(() => ({ error: 'The same request is on the list twice.' }));
        const a = await agent.approveList(asks.map(x => x.purpose));
        if (a.error) return items.map(() => a);
        const out = [];
        for (const x of asks) { const r = await agent.request(x.purpose, x.data, a.swipes[x.purpose]); out.push(r.error ? r : await call(x.name, r)); }
        return out;
      },
      // Collect the token from a room this agent opened, once the other side has come.
      meetPickup(call, room, side) { return agent.send(call, 'pickup', 'meet:pickup:' + room, { side: side || 'person', room }); },
      // CERTIFICATE TOKENS SENT THROUGH THE MIDDLE GROUND: the agent signs "mailbox" and the time with its own key, and collects them.
      async collectPapers(call) { const at = new Date().toISOString(); return call('mailbox', { holder: key.open, at, stamp: await MG.stamp.make(key.secret, 'mailbox|' + at) }); },

      // CARRYING A TOKEN (core/carry.js): show a token this agent holds to one receiver, as one line of text.
      show(token, to) { return MG.carry.show(token, key.secret, to); },
      // A PERSONAL TOKEN: the person's own words, signed by their own agent. It proves who said it, not that it is true.
      say(words, days) { return MG.carry.state(key, words, days); },
    };
    return agent;
  };
  if (typeof module !== 'undefined') module.exports = MG;
})(typeof window !== 'undefined' ? window : globalThis);
