// AUDIT TOKEN. For an auditor, the way payment gateways are audited today.
// An auditor looks inside a host's cloud account and checks how its middle ground is run. Then it stamps a dated audit token.
// The host shows the token at /api/audit, and MG.inspect checks it. An agent can ask for "audited within 90 days",
// and can name the auditors it trusts. Who counts as a good auditor is for each agent's own rules.
//
//   node core/audit.js new-key
//       prints a lasting key for the auditor, and its open key
//   AUDIT_KEY=... node core/audit.js stamp https://audit.example "Audit name" https://middleground.example 90
//       prints an audit token, good for 90 days. The host sets it as AUDIT_TOKEN.
//
// The auditor answers at https://audit.example/api/key?id=<key id> with { "key": "<open key>", "name": "<audit name>" },
// so anyone can check its stamp, the same way as a token from a middle ground.
const MG = require('./code.js');
require('./stamp.js');
// What the auditor checked. These are the host rules that close the gap between "the code it shows" and "the code it runs".
MG.auditRules = [
  'It is deployed only through the public deploy workflow in its repo',
  'Nobody can open a shell on the running machine or change its files',
  'Its files are read-only and nothing is stored',
  'It cannot call out to other servers',
  'The cloud\'s own logs of deploys and access were read for the whole period',
];
MG.audit = async ({ key, by, at, about, days, checked }) => {
  const k = await MG.stamp.load(key), now = Date.now();
  const t = { v: 1, id: 'AU-' + now.toString(36).toUpperCase(), kind: 'audit', says: 'This middle ground is run the way listed in checked', about: String(about).replace(/\/$/, ''),
    checked: checked || MG.auditRules, madeBy: by, makerAt: String(at).replace(/\/$/, ''), made: new Date(now).toISOString(), goodUntil: new Date(now + (days || 90) * 86400000).toISOString(),
    keyId: await MG.stamp.keyId(k.open) };
  t.stamp = await MG.stamp.make(k.secret, MG.wordsOf(t));
  return t;
};
if (require.main === module) (async () => {
  const [cmd, at, by, about, days] = process.argv.slice(2);
  if (cmd === 'new-key') { const t = await MG.stamp.newText(); console.log('AUDIT_KEY=' + t); console.log('# its open key, to answer at /api/key: ' + (await MG.stamp.load(t)).open); }
  else if (cmd === 'stamp' && process.env.AUDIT_KEY && at && by && about) console.log(JSON.stringify(await MG.audit({ key: process.env.AUDIT_KEY, by, at, about, days: Number(days) || 90 })));
  else { console.log('node core/audit.js new-key   |   AUDIT_KEY=... node core/audit.js stamp <auditor https address> <auditor name> <middle ground address> [days]'); process.exit(2); }
})();
module.exports = MG;
