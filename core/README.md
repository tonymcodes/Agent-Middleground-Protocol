# Token core

The small files that every side shares (the middle ground, the personal agent and the business
agent), plus three command-line tools. The shared files must stay the same on every side; each
starter's code line covers them, so a copy that has drifted shows at once.

| File | What it is | Used by |
|---|---|---|
| `stamp.js` | Signatures: who made a token, and that nobody changed it. The same kind of signature an https certificate uses | Every side |
| `paper.js` | Certificate tokens: an issuer signs one, a registry vouches for the issuer's key, anyone checks it ([CERTIFICATE-TOKENS.md](CERTIFICATE-TOKENS.md)) | Every side |
| `swipe.js` | The person's approval: a real fingerprint through a passkey, or a ticked box for trying it | Every side |
| `sheet.js` | A rule sheet a business brings: the checks, the plain words, and how the middle ground runs it | Every side |
| `carry.js` | How a program carries a token as one line of text, and how a receiver checks it | Every side |
| `code.js` | The code line and the whole-repo fingerprint | Every side |
| `link.js` | How a side reaches a middle ground; `MG.inspect` to check a middle ground before using it, and `MG.verify` to check any token by itself | The two starters |
| `check.js` | The same two checks from the command line: `node core/check.js <address or token file>` | Anyone |
| `audit.js` | For an auditor: stamps a dated audit token for a middle ground it has checked | Auditors |
| `deploy-env.js` | Writes the deploy settings inside the public deploy workflow | The deploy workflow |

The token format is in [`TOKENS.md`](TOKENS.md). No packages, no build step. Each file runs in Node
and in a web page.
