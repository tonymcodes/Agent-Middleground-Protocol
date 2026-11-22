# Agent Middleground Protocol (AMP)

Most of the internet was built for people at a screen. In the coming years, most interactions
will be between AI agents and programs. This repo proposes a new kind of place on the internet
for them: an **Agent Middleground**, or a middle ground for short.

Think of two sides each sending a witness to a neutral room. Inside the room, the witnesses see
each other's data, within the limits of a public rule sheet. The middle ground then writes a note
for each side, saying what its witness saw and confirmed (yes or no, a band, a count), and signs
it. The data is wiped; only the two notes leave. Anyone can host a middle ground, and it shows
exactly which public code it is running.

The three building blocks, each with code here: a **personal agent** (the person's side), a
**business agent** (a company's, an office's or an institution's side), and the **Agent
Middleground** between them. Two personal agents can meet the same way, such as a seller and a
buyer. What the agents bring is made into proof by **certificate tokens**, signed by whoever
issued them (an employer's salary credit, a shop's bill, a maker's warranty) and checked the way
https certificates are.

- **Read the paper,** *Agent Middleground Protocol (AMP)*: [paper/paper.pdf](paper/paper.pdf), or the
  [web version](https://tonymcodes.github.io/Agent-Middleground-Protocol/paper/).
- **Run it:** it needs only [Node](https://nodejs.org) 18 or newer. Nothing to install, no build step.

## Try it in five minutes

```
git clone https://github.com/tonymcodes/Agent-Middleground-Protocol
cd Agent-Middleground-Protocol
npm start
```

Open **http://localhost:8787/try/**. Four columns, each its own page talking over the network:
the mock issuers, a personal agent, the middle ground, and a business agent. Every column finds
the middle ground on your computer by itself.

1. Pick a use case in the bar above the columns. All four columns follow.
2. On the business side, press **Open a room with this data**.
3. On the person's side, tick **I approve sending this** (it stands in for a fingerprint) and press
   **Send with my approval**. Either side may go first: the first waits in the middle ground.
4. Read the confirmation token each side gets back. Press **Check the signature** on either one.

Then try: a fake token from the mock issuers (six kinds, each caught with its reason); the real
fingerprint of your laptop or phone (choose it on the person's side: a passkey); a pool room with
**Add 30 sample people**; and **Brought sheet**, where the business brings a rule sheet of its own.

`npm test` runs the checks: every use case, every kind of fake, every limit, and the server itself.

## Three ways to run it

| | Where each part runs | Use it to |
|---|---|---|
| **1. One page** | Everything on one computer, on one page | See the whole idea at once |
| **2. Separate ports** | Each part its own server on one computer | See each side on its own, exactly as on separate machines |
| **3. Separate machines** | The middle ground on a server with https; the business page and the personal agent (on a phone) anywhere else | Run it for real, over the internet |

**1. One page.** `npm start`, then http://localhost:8787/try/ (above).

**2. Separate ports.** Keep `npm start` running, and in three more terminals:

```
node starters/serve.js 8788 personal-agent     # then open http://localhost:8788
node starters/serve.js 8789 company            # then open http://localhost:8789
node starters/serve.js 8790 issuers            # then open http://localhost:8790
```

Each page finds the middle ground on port 8787 by itself. Run a meeting between the two pages as
on the one-page view. On its own, the mock issuers page hands out each token to copy: paste it into
the agent's vault under **Paste a certificate token an issuer sent**, the way a receipt arrives by
email. The middle ground's own page, with the code it runs, is at http://localhost:8787.

**3. Separate machines.** A browser lets a page make and check signatures only over **https**, or
on the same computer (localhost). So on separate machines, everything is served over https.

1. **The middle ground**, on any server with Node and a web address:
   ```
   PUBLIC_URL=https://mg.example.com PORT=443 TLS_CERT=/path/fullchain.pem TLS_KEY=/path/privkey.pem npm start
   ```
   A free certificate comes from Let's Encrypt. On a cloud platform that adds https itself (Google
   App Engine and most others), leave out `TLS_CERT` and `TLS_KEY`; the repo includes `app.yaml` and
   a public deploy workflow ([`middleground/README.md`](middleground/README.md#host-your-own)).
   From anywhere, `node core/check.js https://mg.example.com` checks it against this repo.
2. **The business agent**, on another server, pointed at the middle ground:
   ```
   TLS_CERT=... TLS_KEY=... node starters/serve.js 443 company https://mg.example.com
   ```
3. **The personal agent**, on a third server the same way (`personal-agent` instead of `company`),
   and opened on a phone. Each page also says which middle ground it uses, and can find another.

The quickest way to try it without three servers: the middle ground serves every page of the repo,
so `https://mg.example.com/starters/company/meet.html` and
`https://mg.example.com/starters/personal-agent/meet.html` (on a phone) work at once.

On a home network without a web address, make a test certificate for the computer's network
address and accept the browser's warning on each device:

```
openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 30 -subj "/CN=192.168.1.20" -addext "subjectAltName=IP:192.168.1.20"
```

With a test certificate the ticked box stands in for the fingerprint; a phone's real fingerprint
(a passkey) needs a certificate the phone trusts, such as one from Let's Encrypt.

On Windows PowerShell, set each setting first, such as `$env:PUBLIC_URL = "https://mg.example.com"`,
then run the command without them.

## How the two sides find a middle ground

**In the starter code, by themselves.** A page uses, in order: the address given as `?mg=` in its
own address (`serve.js` adds it when given one), the middle ground the agent chose before, the
server that served the page if it is a middle ground, and last the sample on this computer,
http://localhost:8787. So the parts you start find each other with nothing to set up.

**In real use**, an agent finds one in one of these ways. Each page's **Find middle grounds** card
shows the first three working:

1. **A trusted list that comes with the agent.** The agent's provider picks a few hosts, the way a
   browser comes with a list of certificate companies. The sample list is
   [`starters/middlegrounds.json`](starters/middlegrounds.json).
2. **The business says where it meets.** A business names its middle grounds on its own website,
   at `/.well-known/amp.json`. The file sits on the business's own https address, so nobody else can
   change it. The business page's server in this repo answers it.
3. **Any address, checked first.** `MG.inspect(address)` reads every file the middle ground shows,
   works out the fingerprints again, and compares them with the public repo, the public run that
   deployed it, and its audit. The person's own rules decide how strict to be: only listed ones for
   anything with money, say, and any that passes the checks for small things.
4. **Later, public directories** that list middle grounds passing the checks, like an app store.

## What this version can do

**Use cases, as built-in rule sheets** ([`middleground/rules.js`](middleground/rules.js)):

| Use case | Room | Who meets | What each side learns |
|---|---|---|---|
| Finance (`credit-offer`) | pair | a bank and a person | the bank: income above its minimum, an income band, no missed payments; the person: they qualify, the lender is licensed |
| Shopping (`loyalty-discount`) | pair | a maker and a person | the maker: how often its brand was bought, from signed bills; the person: they qualify for the reward |
| Shop offer (`shop-offer`) | pair | a shop and a person | the person: the one offer, only if it fits; the shop: a budget band and a town, never a name |
| Recruitment (`job-match`) | pair | an employer and a candidate | the employer: every skill, a years band, pay within budget; the candidate: the pay covers what they expect |
| City and citizens (`event-travel`) | pool | a traffic office and many ticket holders | the office: counts by area, way of travel and time, groups under 3 hidden |
| Person to person (`used-goods`) | pair | a seller and a buyer | the buyer: ownership and warranty proven; the seller: the buyer has the money; both: whether the prices meet |
| Pay talks (`pay-talks`) | pool | a pay survey and many people | each person: their group's pay summary, once it has 5 people; the survey: counts only |

**A rule sheet the business brings.** A business can open a room with a rule sheet of its own, as
plain data, at any middle ground that allows it (`broughtSheets` in `host.js`). The middle ground
needs no change for a new use case. In this version a brought sheet can use:

| | Available in this version |
|---|---|
| Field types | number, numbers (a list), text, words, date, choice |
| Values | a field (`person.age`), `average of`, `total of`, `smallest of`, `largest of`, `count of` a field, or a figure written in the sheet |
| Tests | at least, at most, more than, less than, equals, is one of, has all of, has any of |
| Answers | a test (yes, no or "not proven"), a band of at most 5 names, or "all" (every test says yes) |

The limits stop a sheet from pulling out a private value: at most 8 fields and 8 answers for each
side; band edges at least 10% apart; each field tested at most twice in the other side's answers;
no yes-or-no that confirms one exact word of free text. The person's agent runs the same checks
before it sends anything, shows the person in plain words what each side will learn, and accepts
the sheet by its fingerprint. See [`core/sheet.js`](core/sheet.js) and the gym-offer example in
[`starters/samples.js`](starters/samples.js).

**Around every meeting:** certificate tokens and the registries that vouch for issuers
([`core/CERTIFICATE-TOKENS.md`](core/CERTIFICATE-TOKENS.md)); the person's fingerprint, or a ticked
box standing in for it, checked by the middle ground ([`core/swipe.js`](core/swipe.js)); one swipe for
a short list of small meetings, a swipe of its own for a loan or a sale; certificate tokens sent back
after a meeting (an offer letter); confirmation tokens anyone can check, and carry as one line of
text ([`core/TOKENS.md`](core/TOKENS.md)); and the middle ground's proof of the code it runs: its
files, fingerprints, a stamped statement, a public deploy and an audit.

This is the first version. More functions and use cases come in later versions, from what people
ask for and contribute: open an issue or a discussion.

## What is in this repo

| Folder | What it is | For whom |
|---|---|---|
| [`paper/`](paper/) | The paper | Everyone |
| [`middleground/`](middleground/) | **The Agent Middleground server**: rooms, rule sheets, and the display of the code it runs | Anyone who wants to run or host a middle ground |
| [`starters/personal-agent/`](starters/personal-agent/) | Starter code for a personal agent, with its page and the mock issuers | Developers building agents for people |
| [`starters/company/`](starters/company/) | Starter code for a business agent, with its page | Developers building business agents and APIs |
| [`core/`](core/) | The token core every part shares: signatures, certificate tokens, the swipe, rule sheets a business brings | Everyone who builds on the above |
| [`try/`](try/) | The one-page view | Everyone |

## What this is

This is sample code for a concept paper, kept small so that anyone can read it. It is not a
finished product: everything is held in memory, the real fingerprint works through the browser
(a passkey) with a ticked box to stand in for it, and no money moves.

## Licence

The code is under the [Apache License 2.0](LICENSE): anyone may use it, change it, and build open,
closed or commercial versions, keeping the copyright and the [NOTICE](NOTICE) that credit the
original work. The paper in [`paper/`](paper/) is under [CC BY 4.0](paper/LICENSE): share and
adapt it freely, with credit to Tony Mathew. The Nunito font in `paper/fonts/` is under the SIL
Open Font License. To cite this work, see [CITATION.cff](CITATION.cff).

## Author

Tony Mathew ([@tonymcodes](https://github.com/tonymcodes)). Questions and ideas are welcome in
this repo's issues and discussions.
