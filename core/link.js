// LINK. How an agent or a company's system reaches a middle ground.
// The two kits never care where the middle ground is. They are given a link, and the link is one of two things:
//   - a middle ground running in the same page or program (for trying everything on one screen), or
//   - the https address of a middle ground on the internet (for real use, each side on its own machine).
// The same agent and company code runs unchanged over either.
//
//   const call = MG.link(MG.create());                     // same page
//   const call = MG.link('https://middleground.example');  // over the internet
(function (root) {
  const MG = root.MG || (root.MG = {});
  MG.link = function (target) {
    if (typeof target !== 'string') return async (name, data, query) => {
      await target.ready;
      return name === 'status' ? target.stats() : target[name](data || query);
    };
    const base = target.replace(/\/$/, '');
    return async (name, data, query) => {
      const q = new URLSearchParams(query || {}).toString();
      const r = await fetch(base + '/api/' + name + (q ? '?' + q : ''), data === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      return r.json();
    };
  };
  // INSPECT A MIDDLE GROUND BEFORE USING IT. A person can open its page and look: the repo, the files, what is running.
  // An agent or a company's system does the same by program, with this one call. It reads every file the middle ground shows,
  // works the fingerprints out again for itself, checks the host's stamped statement, and compares with the public repo.
  //
  //   const seen = await MG.inspect('https://middleground.example');
  //   if (!seen.good) ...do not send anything there.
  //   MG.inspect(address, { auditors: ['https://audit.example'] })   accepts audit tokens only from the auditors named
  MG.inspect = async function (address, opts) {
    opts = opts || {};
    const base = address.replace(/\/$/, ''), get = async p => fetch(base + p), text = async u => { try { const r = await fetch(u); return r.ok ? await r.text() : null; } catch { return null; } };
    const s = await (await get('/api/status')).json(), run = s.running, checks = [], add = (what, good) => checks.push({ what, good: !!good });
    const mine = {};
    for (const f of run.files) { const r = await get('/source/' + f.file); mine[f.file] = await MG.fingerprint(f.binary ? new Uint8Array(await r.arrayBuffer()) : await r.text()); }
    add('Every file it shows has the fingerprint it states', run.files.every(f => mine[f.file] === f.fingerprint));
    add('The code fingerprint, worked out again from those files, is the one it states', await MG.fingerprint(run.logic.map(f => f + ':' + mine[f]).join('\n')) === run.codeFingerprint);
    const repoHere = await MG.fingerprint([...run.files.map(f => f.file)].sort().map(f => f + ':' + mine[f]).join('\n'));
    add('The whole-repo fingerprint, worked out again from every file it shows, is the one it states', repoHere === run.repoFingerprint);
    const said = await (await get('/api/statement')).json();
    add('Its stamped statement names the same code and carries its stamp', said.codeFingerprint === run.codeFingerprint && await MG.stamp.check(s.stampKey, MG.wordsOf(said), said.stamp));
    add('Its folder now is the same as what it loaded at start', s.folderNow.files.every(f => f.state === 'same as loaded'));
    add('No place in the running code writes a file or calls another server', run.placesThatWriteAFile === 0 && run.placesThatCallAnotherServer === 0);
    const o = run.origin, at = o.repo && o.version ? (opts.raw ? opts.raw + '/' : o.repo.replace('https://github.com/', 'https://raw.githubusercontent.com/') + '/' + o.version + '/') : '';
    // THE WHOLE REPO ON GITHUB: the list of every file at that version, each file fetched, and one fingerprint by the same rules.
    // Equal fingerprints mean the same files, with none added and none missing.
    let repoThere = '';
    if (at) try {
      const gh = opts.github || 'https://api.github.com', name = o.repo.replace('https://github.com/', '');
      const tree = await (await fetch(gh + '/repos/' + name + '/git/trees/' + o.version + '?recursive=1')).json();
      const paths = (tree.tree || []).filter(e => e.type === 'blob').map(e => e.path);
      if (paths.length && !tree.truncated) repoThere = await MG.repoFingerprint(paths, async p => { const r = await fetch(at + p); if (!r.ok) throw new Error(p); return MG.binaryFiles.test(p) ? new Uint8Array(await r.arrayBuffer()) : r.text(); });
    } catch { repoThere = ''; }
    add(at ? 'The whole-repo fingerprint on GitHub, at the version it names, is the same as here' : 'It names a public repo and version to compare with', repoThere && repoThere === run.repoFingerprint);
    // DEPLOYED IN PUBLIC. The middle ground names the public workflow run that put it online. GitHub's own record of that run
    // must show: the same repo, this exact version, the repo's deploy workflow, finished well, aimed at this address, and no later deploy.
    const gh = opts.github || 'https://api.github.com', m = String(o.deployRun || '').match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/actions\/runs\/(\d+)$/);
    let deploy = null;
    if (m && o.repo === 'https://github.com/' + m[1]) try {
      const r = await (await fetch(gh + '/repos/' + m[1] + '/actions/runs/' + m[2])).json();
      const last = ((await (await fetch(gh + '/repos/' + m[1] + '/actions/workflows/deploy.yml/runs?status=success&per_page=1')).json()).workflow_runs || [])[0];
      if (r.head_sha === o.version && String(r.path || '').startsWith('.github/workflows/deploy.yml') && r.conclusion === 'success' && String(r.display_title || '').endsWith(' to ' + base) && last && last.id === r.id) deploy = { run: o.deployRun, at: r.updated_at };
    } catch {}
    add('A public deploy run on GitHub put this exact version at this address, and no later deploy followed', deploy);
    // AUDITED. An auditor looked inside the host's cloud account and stamped a dated audit token for this address.
    let audit = null;
    try {
      const a = await (await get('/api/audit')).json(), v = a && a.kind === 'audit' && a.about === base ? await MG.verify(a) : null;
      if (v && v.good && (!opts.auditors || opts.auditors.includes(v.makerAt))) audit = { by: v.maker, at: v.makerAt, made: a.made, goodUntil: a.goodUntil, checked: a.checked };
    } catch {}
    add('An auditor' + (opts.auditors ? ' on the given list' : '') + ' stamped a dated audit of how it is run, still in date', audit);
    return { address: base, name: s.name, repo: o.repo, version: o.version, codeFingerprint: run.codeFingerprint, repoFingerprint: run.repoFingerprint, repoOnGitHub: repoThere, deploy, audit, good: checks.every(c => c.good), checks };
  };
  // CHECK A TOKEN BY ITSELF. A token names its maker's address and key id. This asks that address for the key,
  // checks the key matches the id, checks the stamp, and checks the token is still in date. Nothing else is needed.
  // The address must be https (or this same computer, for testing), so the key is tied to the address.
  // A token that works once, or that may have been cancelled, is still checked with its maker at /api/check.
  //
  //   const r = await MG.verify(token);   // { good, why, maker, makerAt, code, oldKey }
  // oldKey is true when the maker has changed its key since, and still stands by this one.
  MG.verify = async function (t) {
    const no = why => ({ good: false, why });
    if (!t || typeof t !== 'object' || !t.stamp || !t.keyId) return no('This is not a token from a middle ground.');
    const at = String(t.makerAt || '');
    if (!/^https:\/\/[^/]+/.test(at) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(at)) return no('The token does not name an https address for its maker.');
    let k;
    try { k = await (await fetch(at + '/api/key?id=' + encodeURIComponent(t.keyId))).json(); } catch { return no('Its maker could not be reached.'); }
    if (!k || !k.key || await MG.stamp.keyId(k.key) !== t.keyId) return no('Its maker does not have this key.');
    if (!await MG.stamp.check(k.key, MG.wordsOf(t), String(t.stamp))) return no('It was changed after it was stamped.');
    if (t.goodUntil && new Date(t.goodUntil).getTime() < Date.now()) return no('Its time has run out.');
    const r = { good: true, maker: k.name, makerAt: at, code: t.code || '' };
    if (k.old) r.oldKey = true;
    return r;
  };
  // READ ONE OF THIS STARTER'S OWN FILES, to work out its code line (see code.js).
  // In a program the file is read from the repo folder. In a web page it is fetched from the server the page came from.
  MG.read = typeof window === 'undefined'
    ? f => require('fs').readFileSync(require('path').join(__dirname, '..', f), 'utf8')
    : f => fetch(new URL('/' + f, location.href)).then(r => r.text());
  if (typeof module !== 'undefined') module.exports = MG;
})(typeof window !== 'undefined' ? window : globalThis);
