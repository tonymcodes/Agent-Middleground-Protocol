// CARRYING A TOKEN. How a program (an agent or an API) carries proof that cannot be tampered with.
// A carried token is one line of text. Three things protect it:
//   1. The maker's stamp. Nobody can change a word of the token.
//   2. A named holder. The token names the program it was made for, by that program's open key.
//   3. A fresh showing. Each time the program shows the token, it stamps a short note:
//      which token, shown to whom, and when. A copy in another program's hands cannot make that note.
// The line looks like:   MG1.<the token>.<the showing>
// Whoever receives it can check it here, with only the maker's open key. No call to anyone is needed.
// (To count the uses of a token that works once or a set number of times, ask its maker at /api/check.)
// The same file runs on the server and in a web page.
(function (root) {
  const MG = root.MG;
  const FRESH = 2 * 60 * 1000;   // a showing is good for two minutes
  const pack = v => { let s = ''; for (const b of new TextEncoder().encode(JSON.stringify(v))) s += String.fromCharCode(b); return btoa(s); };
  const unpack = t => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(t), c => c.charCodeAt(0))));
  const words = s => 'show:' + s.token + '|' + s.to + '|' + s.at;

  MG.carry = {
    fresh: FRESH,
    // The holder's program makes the line. "to" is the name of whoever it is being shown to.
    async show(token, holderSecret, to, at) {
      const s = { token: token.id, to: String(to), at: at || new Date().toISOString() };
      s.stamp = await MG.stamp.make(holderSecret, words(s));
      return 'MG1.' + pack(token) + '.' + pack(s);
    },
    // A PERSONAL TOKEN: a person's own words, signed by their own agent. It proves who said it, not that it is true.
    // Whoever reads it is told so. agent is { secret, open }.
    async state(agent, says, days) {
      const now = Date.now(), t = { v: 1, kind: 'statement', says: String(says).slice(0, 300), heldBy: agent.open, made: new Date(now).toISOString(), goodUntil: new Date(now + (days || 30) * 86400000).toISOString() };
      t.stamp = await MG.stamp.make(agent.secret, MG.wordsOf(t));
      return t;
    },
    // Split the line back into the token and the showing. Gives null if it is not a carried token.
    open(line) {
      try {
        const p = String(line).split('.');
        return p.length === 3 && p[0] === 'MG1' ? { token: unpack(p[1]), show: unpack(p[2]) } : null;
      } catch { return null; }
    },
    // Was this token shown by the program it was made for, to me, just now?
    async shownRight(token, show, to, now) {
      return !!(show && show.token === token.id && show.to === String(to)
        && Math.abs((now || Date.now()) - new Date(show.at).getTime()) <= FRESH
        && await MG.stamp.check(token.heldBy, words(show), show.stamp));
    },
    // The whole check, for any API that receives a carried token.
    //   makerKey: the open stamp key of the middle ground that made it (shown on its public page)
    //   me:       the name this token should have been shown to
    async read(line, makerKey, me, now) {
      const c = MG.carry.open(line), t = c && c.token;
      if (!t || typeof t !== 'object') return { good: false, why: 'This is not a carried token.' };
      if (!await MG.stamp.check(makerKey, MG.wordsOf(t), String(t.stamp))) return { good: false, why: 'Not made by that middle ground, or changed after it was made.' };
      if (new Date(t.goodUntil).getTime() < (now || Date.now())) return { good: false, why: 'Its time has run out.' };
      if (!t.heldBy || !await MG.carry.shownRight(t, c.show, me, now)) return { good: false, why: 'It was not shown by the program it was made for, or the showing is old or was meant for someone else.' };
      return { good: true, says: t.says, answer: t.answer, goodUntil: t.goodUntil, uses: t.uses, token: t };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
