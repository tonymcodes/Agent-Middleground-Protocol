# Personal agent starter

The smallest working personal agent: the side that holds one person's certificate tokens and
acts for them at a middle ground.

- **A vault** for certificate tokens (a real person pass, payslips, bills, a degree) and the
  confirmation tokens it gets back.
- **The rule sheet first.** Before it brings anything into a room, the agent reads the room's rule
  sheet. A sheet the business brought is checked with the same checks the middle ground runs, and
  shown to the person in plain words: what they bring, and what each side will learn. The agent
  accepts it by its fingerprint, so the person approves exactly that sheet (`review`).
- **One swipe, one screen** ([`../../core/swipe.js`](../../core/swipe.js)). Nothing that sends the
  person's data leaves without their approval, and the middle ground checks it. The person sees one
  important item, or a short list of small ones, and one swipe approves exactly that screen
  (`meetList`). A loan or a sale needs a swipe of its own.
- **A real fingerprint, or a ticked box for trying it.** The page offers a real fingerprint on the
  device (a passkey: fingerprint, face or the device's PIN, on most phones and laptops), or a ticked
  box that stands in for it. The sample provider names the passkey in the person pass, and the middle
  ground accepts a fingerprint only from that passkey. The other side's token says which was used.
- **Tokens back.** If the person lets the other side send them a certificate token (an offer
  letter), the agent collects it from the middle ground (`collectPapers`).
- **Carrying a token.** The agent shows a token it holds to one receiver, as one line of text (`show`).

| File | What it is |
|---|---|
| `agent.js` | The personal agent. Needs the token core in [`../../core/`](../../core/) |
| `meet.html` | The personal agent's page: the vault, the data it brings, the rule sheet check and the approval. It fits a phone |
| `issuers.html` | Mock issuers: real and fake certificate tokens to try |

## Use it

```
const me = MG.agent(await MG.stamp.newKey());
me.keep(passFromMyProvider);                                            // a real person pass
me.keep(payslipFromMyEmployer);                                         // certificate tokens, as they arrive
me.approve((holder, list) => MG.swipe.device(passkey, holder, list));   // the fingerprint
const { rooms } = await call('rooms', { rule: 'credit-offer' });
const seen = await me.review(rooms[0]);                                 // what each side will learn
const { note } = await me.meetBring(call, rooms[0], data, me.find('salary'));
```

To try it on a computer with no fingerprint reader, starter code can use
`me.approve((holder, list) => MG.swipe.mimic(list.length))`, a ticked box standing in for it.
The person's own rules can be added: `MG.agent(key, { accept: sheet => true or 'a reason to say no' })`.

The same file runs in a web page and in Node. In a web page the agent needs https, or this same
computer (localhost): a browser makes and checks signatures only there.
