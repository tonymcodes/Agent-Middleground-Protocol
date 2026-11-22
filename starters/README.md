# Starters: the two sides

A middle ground sits between two sides. This folder has starter code for each of them, kept apart
so it is clear which code is for which side.

| Starter | Who it is for | Its code |
|---|---|---|
| [`personal-agent/`](personal-agent/) | A person's phone or device: it holds their certificate tokens and acts for them. `issuers.html` acts out the issuers | [`../core/`](../core/) + `agent.js` |
| [`company/`](company/) | A business agent: a company's, an office's or an institution's own system. It opens rooms, gets confirmation tokens, and can issue certificate tokens | [`../core/`](../core/) + `company.js` |

Both use the same token core in [`../core/`](../core/). Each page in this folder is one side, and
talks to the middle ground over the network exactly as it would from another machine.

| Page | What it is |
|---|---|
| `personal-agent/meet.html` | The personal agent in meetings: the vault, the data it brings, the rule sheet check, and the approval (ticked box or real fingerprint). It fits a phone |
| `company/meet.html` | The business agent: the data it brings, its rooms, its own rule sheet, and certificate tokens it sends back |
| `personal-agent/issuers.html` | Mock issuers: real and fake certificate tokens to try |
| `serve.js` | A plain page server, to run each side on its own port or machine (see the root README) |
| `samples.js` | Made-up sample data for every use case, and the sample registry (test only) |

## How the two sides reach a middle ground

Neither kit cares where the middle ground is. Each is given a link, which is one of two things:

```
const call = MG.link(MG.create());                     // a middle ground in the same page or program
const call = MG.link('https://middleground.example');  // a middle ground on the internet
```

The pages find the address by themselves: `?mg=` in the page's address, the one chosen before, the
server that served the page, or the sample on this computer (http://localhost:8787). In real use an
agent finds one from its trusted list ([`middlegrounds.json`](middlegrounds.json)), from the
business's own website (`/.well-known/amp.json`), or by any address it checks first with
`MG.inspect`. The root [README](../README.md#how-the-two-sides-find-a-middle-ground) explains each.

## A full meeting in a few lines

A bank opens a room. A person's agent reads the room's rule sheet and brings its data with the
certificate tokens that back it. Each gets its own confirmation token.

```
// The business side
const bank = MG.company('Northbank', call);
await bank.join();
const { rules } = await bank.meetRules();
const { room } = await bank.meetOpen(rules.find(r => r.id === 'credit-offer'), { offer: '…', minIncome: '50000', … });

// The person's side: payslips signed by the employer are already in the vault
me.approve((holder, list) => MG.swipe.device(passkey, holder, list));   // on a phone: the fingerprint
const { rooms } = await call('rooms', { rule: 'credit-offer' });
const { note } = await me.meetBring(call, rooms[0], { salary: '62000, 64000, 63500', … }, me.find('salary'));

// Back on the business side
const mine = await bank.meetPickup(room);     // "Income above your minimum: yes", and an income band
```

The bank never sees a payslip, and the person's agent never sees the bank's limits.

**A rule sheet of the business's own** runs the same way: `bank.meetOpen({ sheet: mySheet }, data)`.
The person's agent checks it with `me.review(room)` (and `meetBring` does so by itself) before it
sends anything.

## The code line

Each starter has one fingerprint, worked out from its own files. Its name and fingerprint make its
code line, such as `personal agent 7a32479f78622d6d`, and a side sends it with every request. A
middle ground can count or accept only visitors that state approved starter code. It is the
sender's own statement, not proof; see [`../middleground/README.md`](../middleground/README.md).

## Tests

`npm test` (from the repo folder) runs every use case with the two kits alone, once in one program
and once against a middle ground server over the network.
