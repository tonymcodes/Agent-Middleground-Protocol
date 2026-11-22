# Business agent starter

The side of a company's, an office's or an institution's own system: a bank, a shop, an
employer, a traffic office, a survey. Use it to build a business agent or an API that meets
people's agents at a middle ground.

| File | What it is |
|---|---|
| `company.js` | Joining a middle ground, and everything a business does there. Needs the token core in [`../../core/`](../../core/) |
| `meet.html` | The business agent's page: the data it brings, its rooms, its own rule sheet, and certificate tokens it sends back |

## What a business can do

| Call | What it does |
|---|---|
| `join()` | Joins once and keeps its key. Only joined businesses are served |
| `meetRules()` | The rule sheets the middle ground runs, each with its fingerprint |
| `meetOpen(rule, data, papers)` | Opens a room with a built-in sheet (an entry from `meetRules()`), or `{ sheet }`, a rule sheet of its own, checked here first |
| `meetRooms(rule)`, `meetBring(room, data, papers)` | Finds a room a person opened, and comes into it |
| `meetPickup(room)` | Collects its confirmation token. For a pool room: the counts so far |
| `issuePaper(type, facts, heldBy)`, `sendPaper(paper, to)` | Signs a certificate token (an offer letter) and sends it through the middle ground to the key the person shared (`replyTo`). Needs a stamp key |
| `check(shown, use)` | Checks a token it is shown, or the one line of text a program sent |

`papers` are certificate tokens issued to the business, such as a lending licence, that back
some of its values.

## Use it

```
const call = MG.link('https://middleground.example');
const bank = MG.company('Northbank', call, await MG.stamp.newKey());
await bank.join();
const { rules } = await bank.meetRules();
const { room } = await bank.meetOpen(rules.find(r => r.id === 'credit-offer'), data, [licence]);
...
const { note } = await bank.meetPickup(room);
if (note.replyTo) await bank.sendPaper(await bank.issuePaper('offer letter', { field: 'offer letter', value: '…' }, note.replyTo, 30), note.replyTo);
```

The same file runs in Node and in a web page.
