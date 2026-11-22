# The Agent Middleground server

The main part of the [Agent Middleground Protocol (AMP)](../README.md) repo: a neutral room for
agents, run by open code.

- Two sides bring their data to a **room**, under a public **rule sheet**.
- Inside the room, each side's witness sees the other side's data, within the limits of the sheet.
- The middle ground writes a signed **confirmation token** for each side, in fixed shapes only
  (yes or no, a band, a count), and **wipes the data**. Nothing is stored.
- It serves only authenticated visitors, talks only over https, and shows everyone the exact code
  it is running.

It needs only Node 18 or newer, with no packages. From the repo folder: `npm start`, then open
http://localhost:8787 (its own page) or http://localhost:8787/try/ (every side on one page).

## Rooms and rule sheets

Each kind of meeting has one public rule sheet. It says what each side brings, which values are
public and which stay private, and what each side may learn, each answer in a fixed shape. Every
confirmation token names the fingerprint of the sheet that wrote it, so a changed sheet shows.

**Two kinds of room.** A **pair** room: one business and one person, or two people (a seller and a
buyer); each gets a token about what its witness saw of the other side. A **pool** room: one office
and many people; each person gets a token, the office gets counts only, with groups smaller than
3 hidden.

**Built-in sheets** are in [`rules.js`](rules.js), one for each example in the paper: finance,
loyalty discounts, a shop's offer, recruitment, city travel counts, used goods between two people,
and pay talks. The root [README](../README.md#what-this-version-can-do) lists what each side learns.

**A sheet the business brings.** A business can open a room with a rule sheet of its own, as plain
data, with no change here ([`../core/sheet.js`](../core/sheet.js)). The middle ground checks it
against fixed limits before it opens the room, and runs it with a fixed set of checks. The person's
agent runs the same checks, shows the person in plain words what each side will learn, and accepts
the sheet by its fingerprint. A host can turn this off (`broughtSheets: false` in `host.js`).

**Why no raw value can cross.** Every answer must fit its shape (yes, no, "not proven", one of the
sheet's own bands or choices, a count); one that does not stops the room and nothing is written.
One pair may meet over one sheet only a few times a day (`looksPerPair`), so nobody can rebuild the
other side's data from many small looks.

## Who may come in

- **A business or office that has joined.** It joins once, gets a key, and sends it with every
  request. A business that issues certificate tokens names its open stamp key.
- **A personal agent with a real person pass.** The pass is a certificate token from the person's
  agent provider, checked like any other. The agent stamps each request with its own key, so a pass
  cannot be borrowed, and anything that sends the person's data carries the person's approval: a
  fingerprint on the device the pass names (a passkey), or, where the host allows it, the sample's
  ticked box. A host can accept only real fingerprints (`realFingerprintOnly` in `host.js`).

**Proof.** A value counts as proof when a certificate token backs it exactly, signed by an issuer
whose key a registry on [`known.js`](known.js) confirmed (see
[`../core/CERTIFICATE-TOKENS.md`](../core/CERTIFICATE-TOKENS.md)). Anything else is the side's own
word, and an answer that depends on it says "not proven".

**The code line.** A visitor may state which public starter code it runs. A host can serve every
authenticated visitor and count who states approved code (`starterCode: 'note'`, the sample's
setting), or refuse the rest (`'only'`). It is the visitor's own statement, not proof.

## Addresses

Every address takes and gives JSON. The starter code makes each one a single call.

| Address | Who uses it | What it does |
|---|---|---|
| `POST /api/join` | A business or office | Joins once and gets a key |
| `GET /api/rules` | Anyone | The rule sheets this middle ground runs, each with its fingerprint |
| `POST /api/open` | Either side | Opens a room with a built-in sheet (`rule`) or a brought one (`sheet`), and the data for its side. `accepts` names the sheet's fingerprint |
| `GET /api/rooms` | Anyone | The rooms waiting: public fields, what each asks for, and its rule sheet |
| `POST /api/bring` | The other side | Comes into a room with its data and certificate tokens, naming the sheet it accepts. Gets its token; the data is wiped |
| `POST /api/pickup` | The side that opened the room | Collects its token. A pool room's office gets counts so far |
| `POST /api/deliver` | A business, after a meeting | Sends a certificate token it signed to the key the person shared (`replyTo`) |
| `POST /api/mailbox` | A person's agent | Collects the certificate tokens sent to it |
| `POST /api/check` | Anyone shown a token | Checks a token made here: stamp, time, a single use, a carried token's showing |
| `GET /api/key?id=` | Anyone | The open key for a key id named in a token |
| `GET /api/status` | Anyone | The code that is running, the counts, and the rooms (what is held, never a value) |
| `GET /api/statement` | Anyone | The host's stamped statement of the code it runs |
| `GET /api/audit` | Anyone | The latest audit token an auditor stamped for this middle ground |

Tokens and how to check them: [`../core/TOKENS.md`](../core/TOKENS.md).

## How the connection is kept safe

An agent talks to the middle ground the way a browser talks to any https website: the
certificate proves the address, and everything is encrypted in both directions. Anything that
arrives without encryption is refused. The only exception is a test on the same computer
(`http://localhost`).

- **On a cloud platform that adds https itself** (Google App Engine and most others): nothing to do.
- **On a plain server:** get a certificate for your address (for example free from Let's Encrypt):
  `TLS_CERT=/path/fullchain.pem TLS_KEY=/path/privkey.pem PORT=443 npm start`.

To try https on your own computer, make a test certificate; `npm test` then also checks the https path:

```
mkdir middleground/local-cert
openssl req -x509 -newkey rsa:2048 -nodes -keyout middleground/local-cert/key.pem -out middleground/local-cert/cert.pem -days 365 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost"
```

## How anyone can see what is running

A person can look on the middle ground's page: who hosts it, which repo and version it came from,
every file in its folder with its fingerprint, and a button that compares every file with GitHub. An
agent or a business's system makes the same checks by program before it sends anything:

```
const seen = await MG.inspect('https://middleground.example');   // core/link.js
if (!seen.good) ...send nothing there
```

From the command line:

```
node core/check.js https://middleground.example    # inspects a running middle ground against the public repo
node middleground/server.js fingerprint            # in a fresh clone: the fingerprints of the public code
node core/check.js token.json                      # checks one token, with nothing but the token
```

- **One fingerprint for the whole repo.** Every file counts, so a file added, changed or missing
  anywhere changes it. The rules are in [`../core/code.js`](../core/code.js), and anyone can follow
  them with any SHA-256 tool.
- **One code fingerprint** covers the files that run. It is on the page and in every token.
- **A stamped statement** (`GET /api/statement`): the host's own signed word on the repo, version
  and fingerprints it runs.
- **The folder now.** The page reads the folder again each time and marks any file changed, added
  or removed since start. It also counts the places in the running code that write a file or call
  another server; both are 0, and `npm test` checks they stay 0.

**What this proves, and what it does not.** These checks prove that the files a middle ground shows
are the public code, and that its tokens name that code. On their own they do not prove that the
files it shows are the files it runs. That proof comes from outside the host, and the inspection
checks both steps:

| Step | What it shows | Where |
|---|---|---|
| Deployed in public | GitHub's own record of the run that put this exact version at this address, with no later deploy | [`../.github/workflows/deploy.yml`](../.github/workflows/deploy.yml); the middle ground names the run |
| Audited | An auditor looked inside the host's cloud account and stamped a dated audit token | [`../core/audit.js`](../core/audit.js); shown at `GET /api/audit` |

## Host your own

Fork the repo, say who you are in [`host.js`](host.js), and start it on any server with Node.

**Its address.** Set `PUBLIC_URL` to the https address people and agents use. Every token names it,
so anyone holding a token can fetch the key from there and check it.

**A lasting stamp key.** Without one, a new key is made at each start and older tokens can no
longer be checked. Make one once and keep it in the host's secret store:

```
node middleground/server.js new-key        # prints STAMP_KEY=... and its open key
STAMP_KEY=... npm start
```

**Changing the key.** Put the new key in `STAMP_KEY` and the old *open* key in `OLD_KEYS` (comma
separated). Older tokens still check, and `MG.verify` says they used an older key. If a key leaked,
leave it off `OLD_KEYS`, and every token it signed is refused.

**Deploy in public.** [`../.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) deploys to
Google App Engine from GitHub, in public, so anyone can see which version went to which address.
It needs, in the repo settings, the variables `PUBLIC_URL` and `GCP_PROJECT` (and `AUDIT_TOKEN` and
`OLD_KEYS` when there are any) and the secrets `GCP_KEY` (a key that can only deploy) and
`STAMP_KEY`. For another cloud, change its last three steps.

**How a host earns.** None of these needs a profile of anyone: a tiny fee for each request, billed
to the person's agent provider from the counts on the page; a small share when a deal made there
succeeds, as a payment gateway takes; or nothing, to show the host's own cloud. A host may show one
short message, written in `host.js`, in the public code.

## Files

| File | What it is |
|---|---|
| `server.js` | The web server: https, the addresses, and the display of the code it runs |
| `ground.js` | The middle ground: who may come in, rooms, tokens |
| `rules.js` | The built-in rule sheets |
| `known.js` | The registries and issuers this middle ground trusts |
| `host.js` | Who hosts this copy, and its settings |
| `index.html` | The middle ground's own page |
| `meetings.html` | The rooms right now, for the one-page view |
| `test.js` | The checks (`npm test`) |
