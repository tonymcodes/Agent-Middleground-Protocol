// THE SERVER. It does three things and nothing else:
//   1. shows everyone the exact code it is running (the outside display),
//   2. lets agents and companies use the middle ground (ground.js),
//   3. answers. It never writes a file and never calls another server.
// It talks only over an encrypted connection, like any https website (see ENCRYPTION below).
// Run it from the repo folder with:  node middleground/server.js      Needs only Node. No packages to install.
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), crypto = require('crypto');
// HERE is this folder. ROOT is the whole repo it belongs to: everything shown, served and compared with GitHub is in ROOT.
const HERE = __dirname, ROOT = path.join(__dirname, '..');
const MG = require('./ground.js');
require('../core/stamp.js');
require('../core/carry.js');
require('../core/code.js');
require('../core/paper.js');
require('../core/swipe.js');
require('../core/sheet.js');
require('./known.js');
require('./rules.js');
require('./host.js');
// STAMP_KEY: the host's lasting stamp key, kept outside the code. Without it a new key is made at each start.
// OLD_KEYS: after a key change, the old open keys (not secret), separated by commas, so older tokens still check.
// PUBLIC_URL: the https address people and agents use for this middle ground. Every token names it.
const ADDRESS = (process.env.PUBLIC_URL || 'http://localhost:' + (process.env.PORT || 8787)).replace(/\/$/, '');
// AUDIT_TOKEN: the latest audit token an auditor stamped for this middle ground (see core/audit.js). It is public.
const AUDIT = (() => { try { return process.env.AUDIT_TOKEN ? JSON.parse(process.env.AUDIT_TOKEN) : null; } catch { return null; } })();
const OLD_KEYS = (process.env.OLD_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
const ground = MG.create({ key: process.env.STAMP_KEY, oldKeys: OLD_KEYS, address: ADDRESS });
const started = new Date();

// The code is read once, at start. What is shown is the copy that was loaded.
const LOGIC = ['middleground/server.js', 'middleground/ground.js', 'core/stamp.js', 'core/carry.js', 'core/paper.js', 'core/swipe.js', 'core/sheet.js', 'middleground/known.js', 'middleground/rules.js', 'middleground/host.js', 'core/code.js'];
// THE WHOLE REPO IS SHOWN, not a chosen list: the paper, the starters and the middle ground. Three things are not opened:
// git's own records, installed packages, and the certificate folder (it holds a private key).
const CLOSED = ['.git', 'node_modules', 'middleground/local-cert', 'deploy-env.yaml'];
const folder = dir => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e => {
  const p = dir ? dir + '/' + e.name : e.name;
  return CLOSED.includes(p) ? [] : e.isDirectory() ? folder(p) : [p];
}).sort();
const FILES = folder('');
const code = Object.fromEntries(FILES.map(f => [f, fs.readFileSync(path.join(ROOT, f))]));
// A fingerprint is the same on every computer: line endings are made alike first.
// Pictures, the paper's PDF and fonts are fingerprinted exactly as they are.
const BIN = MG.binaryFiles;
const fingerprint = (buf, file) => crypto.createHash('sha256').update(file && BIN.test(file) ? buf : buf.toString().replace(/\r\n/g, '\n')).digest('hex');

// Where this copy came from: the GitHub address and the exact version, read from the folder git made.
function origin() {
  // DEPLOY_RUN: the public GitHub workflow run that put this version online (set by .github/workflows/deploy.yml).
  const out = { repo: process.env.SOURCE_REPO || '', version: process.env.SOURCE_VERSION || '', deployRun: process.env.DEPLOY_RUN || '' };
  try {
    const git = f => fs.readFileSync(path.join(ROOT, '.git', f), 'utf8');
    const head = git('HEAD').trim();
    if (head.startsWith('ref: ')) {
      const ref = head.slice(5);
      try { out.version = git(ref).trim(); } catch { out.version = (git('packed-refs').split('\n').find(l => l.endsWith(' ' + ref)) || '').split(' ')[0]; }
    } else out.version = head;
    const url = (git('config').match(/url = (.+)/) || [])[1] || '';
    out.repo = url.trim().replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '') || out.repo;
  } catch {}
  return out;
}

// Count the places in the running code that could write a file or call another server.
// The words are joined here so that this list does not count itself.
const WRITES = ['write' + 'File', 'append' + 'File', 'createWrite' + 'Stream', 'fs.' + 'write', 'fs.' + 'rename', 'fs.' + 'mkdir', 'fs.' + 'cp'];
const CALLS_OUT = ['fet' + 'ch(', '.requ' + 'est(', 'http.' + 'get(', 'https.' + 'get(',"('n" + "et')", "('t" + "ls')", "('dgr" + "am')", 'child_' + 'process', 'Web' + 'Socket'];
const places = words => LOGIC.reduce((n, f) => n + words.reduce((m, w) => m + (code[f].toString().split(w).length - 1), 0), 0);

// ONE CODE FINGERPRINT for everything that runs: the fingerprints of all running files, in order, fingerprinted once more.
// It is shown on the page, stamped into every token, and anyone can work it out again from the public repo.
const codeFingerprint = fingerprint(Buffer.from(LOGIC.map(f => f + ':' + fingerprint(code[f])).join('\n')));
// ONE FINGERPRINT FOR THE WHOLE REPO: every file shown, by the rules in core/code.js. Anyone can work it out from GitHub.
const repoFingerprint = fingerprint(Buffer.from([...FILES].sort().map(f => f + ':' + fingerprint(code[f], f)).join('\n')));

const running = {
  origin: origin(),
  startedAt: started.toISOString(),
  node: process.version,
  files: FILES.map(f => ({ file: f, lines: BIN.test(f) ? '' : code[f].toString().split('\n').length, fingerprint: fingerprint(code[f], f), runs: LOGIC.includes(f), ...(BIN.test(f) ? { binary: true } : {}) })),
  codeFingerprint, repoFingerprint, logic: LOGIC,
  placesThatWriteAFile: places(WRITES),
  placesThatCallAnotherServer: places(CALLS_OUT),
};

// Every token names the code that worked it out: the code fingerprint, and the version from GitHub.
MG.codeMark = 'code ' + codeFingerprint.slice(0, 16) + (running.origin.version ? ', version ' + running.origin.version.slice(0, 7) : '');

// THE STARTER CODE THIS MIDDLE GROUND ACCEPTS. The code lines of the two starters are worked out from the copies in this folder,
// which anyone can compare with GitHub like every other file. The host may add more in host.js.
MG.approved = [...((MG.host && MG.host.alsoAccepted) || [])];
Promise.all(Object.keys(MG.starters).map(s => MG.codeOf(s, f => code[f].toString()))).then(lines => MG.approved.push(...lines));

// A live look at the folder, made again on every status request: what is on the disk now, beside what was loaded at start.
function folderNow() {
  const now = folder('');
  return {
    closed: CLOSED.filter(c => fs.existsSync(path.join(ROOT, c))),
    files: [...new Set([...FILES, ...now])].sort().map(f => ({ file: f, state: !now.includes(f) ? 'removed since start' : !code[f] ? 'added since start' : fs.readFileSync(path.join(ROOT, f)).equals(code[f]) ? 'same as loaded' : 'changed since start' })),
  };
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/plain', '.yaml': 'text/plain', '.txt': 'text/plain', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.woff2': 'font/woff2' };
function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type + (/^(text\/|application\/json)/.test(type) ? '; charset=utf-8' : ''), 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' });
  res.end(body);
}
const json = (res, data, status) => send(res, status || (data && data.error ? 400 : 200), 'application/json', JSON.stringify(data));

function body(req) {
  return new Promise(done => {
    let size = 0; const parts = [];
    req.on('data', d => { size += d.length; if (size <= 1e6) parts.push(d); });
    req.on('end', () => { try { done(size > 1e6 ? null : JSON.parse(Buffer.concat(parts).toString() || '{}')); } catch { done(null); } });
  });
}

// The addresses agents and businesses use (see ground.js). Each takes JSON and answers with JSON.
const POSTS = ['join', 'rules', 'open', 'rooms', 'bring', 'pickup', 'deliver', 'mailbox', 'check'];

// ENCRYPTION. The middle ground talks the way every "https" website does (TLS).
// Its certificate proves its web address, and everything sent in either direction is encrypted.
// Two ways to switch it on:
//   - on a cloud platform that adds https itself (App Engine and most others): nothing to do,
//   - on a plain server: set TLS_CERT and TLS_KEY to the certificate files, and this server speaks https itself.
// Anything that arrives without encryption is refused. The only exception is this same computer, for testing.
const TLS = process.env.TLS_CERT && process.env.TLS_KEY ? { cert: fs.readFileSync(process.env.TLS_CERT), key: fs.readFileSync(process.env.TLS_KEY) } : null;
const encrypted = req => !!req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
const sameComputer = req => !req.headers['x-forwarded-proto'] && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

async function answer(req, res) {
  let url = decodeURIComponent(req.url.split('?')[0]); const query = req.url.split('?')[1];
  // The middle ground's page sits in middleground/, so the addresses it asks for may start with that folder.
  if (/^\/middleground\/(api|source)\//.test(url)) url = url.slice('/middleground'.length);
  if (req.method === 'OPTIONS') return send(res, 204, 'text/plain', '');
  const safe = encrypted(req);
  if (!safe && !sameComputer(req)) {
    if (url.startsWith('/api/')) return json(res, { error: 'Not encrypted. Use the https address of this middle ground.' }, 400);
    res.writeHead(301, { Location: 'https://' + (req.headers.host || '') + req.url });
    return res.end();
  }
  if (url.startsWith('/api/')) {
    const name = url.slice(5), q = new URLSearchParams(query || '');
    await ground.ready;
    if (req.method === 'GET' && name === 'status') return json(res, { running, connection: safe ? 'encrypted' : 'test on the same computer', uptimeSeconds: Math.round((Date.now() - started) / 1000), lastingKey: !!process.env.STAMP_KEY, folderNow: folderNow(), ...ground.stats() });
    // The host's stamped statement of what it is running. Anyone can save it. The stamp makes it the host's own word, on record.
    if (req.method === 'GET' && name === 'statement') return json(res, await ground.state({ kind: 'statement', says: 'This middle ground is running exactly this code', repo: running.origin.repo, version: running.origin.version, codeFingerprint, repoFingerprint, runningSince: running.startedAt }));
    // THE KEY FOR A KEY ID. A token names its maker's address and key id. Anyone can ask here for that key, and check the stamp.
    // It answers for the key now, and for old keys kept after a key change.
    if (req.method === 'GET' && name === 'key') {
      const st = ground.stats(), want = q.get('id'), old = st.oldKeys.find(o => o.keyId === want);
      if (st.keyId === want) return json(res, { keyId: st.keyId, key: st.stampKey, name: st.name, address: ADDRESS });
      if (old) return json(res, { keyId: old.keyId, key: old.key, name: st.name, address: ADDRESS, old: true });
      return json(res, { error: 'No key with this id here.' }, 404);
    }
    // THE AUDIT. An auditor looked inside the host's cloud account and stamped what it found, with a date. Anyone can check the stamp.
    if (req.method === 'GET' && name === 'audit') return AUDIT ? json(res, AUDIT) : json(res, { error: 'No audit token yet.' }, 404);
    // The two lists can also be read with a plain GET, such as /api/rooms?rule=credit-offer.
    if (req.method === 'GET' && (name === 'rules' || name === 'rooms')) return json(res, await ground[name](Object.fromEntries(q)));
    if (req.method === 'POST' && POSTS.includes(name)) {
      const data = await body(req);
      return json(res, data === null ? { error: 'Send JSON, up to 1 MB.' } : await ground[name](data));
    }
    return json(res, { error: 'No such address.' }, 404);
  }
  if (req.method !== 'GET') return send(res, 405, 'text/plain', 'Not allowed');
  if (url === '/favicon.ico') return send(res, 204, 'image/x-icon', '');
  // The front door leads to the middle ground's own page.
  if (url === '/' || url === '/middleground') { res.writeHead(302, { Location: '/middleground/' }); return res.end(); }
  if (url.startsWith('/source/') && code[url.slice(8)]) return send(res, 200, 'text/plain', code[url.slice(8)]);
  // Every file in the repo is public, so every file shown is also served as it was loaded: the pages, the code they load, the paper.
  const file = url.slice(1) + (url.endsWith('/') ? 'index.html' : '');
  if (code[file]) return send(res, 200, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', code[file]);
  send(res, 404, 'text/plain', 'Not found');
}

const PORT = process.env.PORT || 8787;
// "node server.js new-key" prints a new lasting stamp key and its open key, and stops. Keep the key in the host's secret store as STAMP_KEY.
// To change keys: make a new one, put it in STAMP_KEY, and add the old open key to OLD_KEYS.
// "node middleground/server.js fingerprint" prints the code fingerprint of the files in this folder, and stops.
// Run it in a fresh clone of the public repo, and compare with what a running middle ground shows and stamps into its tokens.
if (process.argv[2] === 'fingerprint') Promise.all(Object.keys(MG.starters).map(s => MG.codeOf(s, f => code[f].toString()))).then(lines => { console.log('repo fingerprint  ' + repoFingerprint + '   (every file in the repo)'); console.log('code fingerprint  ' + codeFingerprint + '   (the files that run)'); console.log('version           ' + (running.origin.version || 'not a git copy')); for (const l of lines) console.log('starter           ' + l); process.exit(0); });
else if (process.argv[2] === 'new-key') MG.stamp.newText().then(async t => { console.log('STAMP_KEY=' + t); console.log('# its open key, for OLD_KEYS after a later change: ' + (await MG.stamp.load(t)).open); process.exit(0); });
else (TLS ? https.createServer(TLS, answer) : http.createServer(answer)).listen(PORT, () => console.log('Middle ground running. Open ' + (TLS ? 'https' : 'http') + '://localhost:' + PORT));
