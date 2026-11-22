// THE CODE LINE. How a personal agent or a company's system says which public starter code it runs.
// There are two starters, one for each side, and a small token core that every side shares:
//   - personal agent starter:  the token core + agent.js
//   - company starter:         the token core + company.js
//   - token core (the same files everywhere): stamp.js, carry.js, code.js, link.js, paper.js (certificate tokens),
//     swipe.js (the person's approval) and sheet.js (rule sheets a business brings)
// A starter's code line is its name and one fingerprint of its files, such as "personal agent 3f9a…".
// The fingerprint is worked out from the files themselves, so it changes if any file changes.
// A side sends its code line with every request. A middle ground holds the list of code lines it accepts.
//
//   const runs = await MG.codeOf('personal agent', MG.read);      // MG.read is in link.js
//   const me = MG.agent(key, { runs });
//
// What this is, and is not: the code line is that side's own statement. It is not proof.
// A changed program could send the same line. Proof needs the device or the cloud to vouch for the program,
// and that is a later layer (see the README).
(function (root) {
  const MG = root.MG || (root.MG = {});
  const subtle = (root.crypto && root.crypto.subtle) || (typeof window === 'undefined' ? require('crypto').webcrypto.subtle : undefined);   // a web page gets it only over https or on localhost
  // A fingerprint is the same on every computer: line endings are made alike first.
  // Bytes (a picture, a PDF) are fingerprinted exactly as they are.
  const fingerprint = async t => [...new Uint8Array(await subtle.digest('SHA-256', t instanceof Uint8Array ? t : new TextEncoder().encode(String(t).replace(/\r\n/g, '\n'))))].map(b => b.toString(16).padStart(2, '0')).join('');
  MG.fingerprint = fingerprint;
  // THE WHOLE-REPO FINGERPRINT. One value for every file in the repo, worked out by fixed rules, so anyone can work it out
  // again: from GitHub, from their own copy, or from the files a middle ground shows. If any file is changed, added or
  // removed, the value changes.
  //   1. Take every file in the repo (not git's own records).
  //   2. Fingerprint each file with SHA-256: text with its line endings made alike; pictures, PDFs and fonts as bytes.
  //   3. Write one line per file, "path:fingerprint", with / between folders, sorted by path.
  //   4. Join the lines with a newline (none at the end), and fingerprint that text with SHA-256.
  // read(path) gives the file: text, or the bytes (a Uint8Array) for a file that MG.binaryFiles names.
  MG.binaryFiles = /\.(png|jpe?g|gif|ico|pdf|woff2?)$/i;
  MG.repoFingerprint = async function (paths, read) {
    const lines = [];
    for (const p of [...paths].sort()) lines.push(p + ':' + await fingerprint(await read(p)));
    return fingerprint(lines.join('\n'));
  };
  MG.core = ['core/stamp.js', 'core/carry.js', 'core/code.js', 'core/link.js', 'core/paper.js', 'core/swipe.js', 'core/sheet.js'];
  MG.starters = {
    'personal agent': [...MG.core, 'starters/personal-agent/agent.js'],
    'company': [...MG.core, 'starters/company/company.js'],
  };
  // read(file) gives the text of one file. Only the file's own name goes into the fingerprint, not its folder,
  // so a starter gives the same code line wherever its files are kept.
  MG.codeOf = async function (starter, read) {
    const files = starter === 'token core' ? MG.core : MG.starters[starter];
    if (!files) return '';
    const lines = [];
    for (const f of files) lines.push(f.split('/').pop() + ':' + await fingerprint(await read(f)));
    return starter + ' ' + (await fingerprint(lines.join('\n'))).slice(0, 16);
  };
  if (typeof module !== 'undefined') module.exports = MG;
})(typeof window !== 'undefined' ? window : globalThis);
