// CHECK FROM THE COMMAND LINE. For a person, or for any program that would rather run a command.
//   node core/check.js https://middleground.example     inspects a running middle ground against the public repo
//   node core/check.js token.json                        checks a token saved as a file
// Needs only Node 18 or newer.
const MG = require('./code.js');
require('./stamp.js');
require('./carry.js');
require('./link.js');
const what = process.argv[2] || '';
(async () => {
  if (/^https?:\/\//.test(what)) {
    const seen = await MG.inspect(what);
    console.log(seen.name + '  ' + seen.address);
    console.log('repo     ' + (seen.repo || 'not named') + (seen.version ? '  version ' + seen.version.slice(0, 12) : ''));
    console.log('repo     ' + seen.repoFingerprint + (seen.repoOnGitHub ? '   on GitHub: ' + seen.repoOnGitHub : ''));
    console.log('code     ' + seen.codeFingerprint);
    for (const c of seen.checks) console.log((c.good ? 'yes  ' : 'NO   ') + c.what);
    process.exit(seen.good ? 0 : 1);
  } else if (what) {
    const r = await MG.verify(JSON.parse(require('fs').readFileSync(what, 'utf8')));
    console.log(r.good ? 'good: made by ' + r.maker + ' at ' + r.makerAt + (r.code ? ', ' + r.code : '') + (r.oldKey ? ' (stamped with an older key it still stands by)' : '') : 'refused: ' + r.why);
    process.exit(r.good ? 0 : 1);
  } else { console.log('Give the https address of a middle ground, or a token saved as a file.'); process.exit(2); }
})().catch(e => { console.log('could not check: ' + e.message); process.exit(1); });
