# Certificate tokens

A **certificate token** is the proof a person (or a business) brings to a meeting: a salary credit,
a bill, a warranty, a bank balance, a ticket, a licence. What a person types into their agent is
their own word; a certificate token, signed by whoever issued it, makes it proof. An **issuer** is
anyone who gives an agent a certificate token: an employer, a shop, a maker, a bank, a credit bureau,
a ticket office, a university, a government office, and any business agent.

It is one of AMP's three kinds of token; [TOKENS.md](TOKENS.md) lists all three. Certificate tokens go
into a meeting; a confirmation token comes out, one for each side.

Issuing is part of both kits, not a separate one:

- **The personal agent kit** has mock issuers ([`starters/personal-agent/issuers.html`](../starters/personal-agent/issuers.html)),
  so anyone can act out the certificate tokens a person collects, real and fake, and watch them checked.
- **The business agent kit** issues too. After a meeting, and only if the person agreed (their
  agent shares its key in the room, and the business's confirmation token names it as `replyTo`),
  the business signs a certificate token for them (an offer letter, a voucher, an invitation) and
  sends it through the middle ground. The middle ground checks it, holds it in memory, and hands it
  over when that agent collects it.

## How it works, the way https works

| https | AMP |
|---|---|
| A website makes a key pair and keeps the secret key on its server | An issuer makes a key pair and keeps the secret key in its own system (payroll, billing, warranty records) |
| A certificate company checks the website once and signs its certificate | A **registry** (a business registry, a banking regulator, a university body) checks the issuer once and signs a **key note**: this issuer, at this web address, has this key, until this date |
| The server sends its certificate with every connection | The issuer puts its key note inside every certificate token it signs |
| A browser has a short list of certificate companies it trusts | A middle ground has a short public list of registries it trusts ([`middleground/known.js`](../middleground/known.js)) |
| The browser checks the chain: certificate company, then certificate, then the server | The middle ground checks the chain: registry, then key note, then certificate token, then the agent it was issued to |

Nobody is called during the check. The middle ground never calls another server, and does not
need to: everything it needs is inside the token and on its own list.

## What a certificate token holds

```
kind       "paper" (the name the sample code uses for a certificate token)
type       what it is: salary, bill, warranty, funds, ticket, licence…
madeBy     the issuer's name
keyNote    the registry's signed note for the issuer's key (see below)
heldBy     the agent it was issued to, by that agent's open key (a business: by its name)
facts      what it says. In the meeting samples one token backs one value: { field, value }
issued     when it was signed
goodUntil  when it stops counting: days for a bank balance, months for a salary credit, years for a degree
stamp      the issuer's signature over every field above

key note:  kind "key note", madeBy (the registry), name (the issuer), is, web, key, made, goodUntil, stamp
```

## The checks, in order

[`paper.js`](paper.js) runs the same checks in every part: the person's agent checks its own vault
with it, and the middle ground checks what it is shown with it.

1. **Whose key?** The issuer is listed directly, or its key note is signed by a registry on the list,
   names this issuer, and has not run out.
2. **The signature.** The issuer's key signed every word of the token. Change one digit and it fails.
3. **The holder.** The token names this agent. Someone else's token is useless here.
4. **The date.** It has not run out.
5. **The value.** In a meeting, the value brought must be exactly what the token says.

If any check fails, the value still goes into the room as the side's own word, and the
confirmation token says **"not proven"** with the reason, for example *"the signature does not
match: it was changed after signing, or signed with another key"*. A range or a count worked out
from an unproven value is "not proven" too.

## Checking an issuer by hand

The issuer publishes its key id on its own https website. Anyone can open the site and compare it
with the key id in the token, much as a person can look at a website's certificate. The agent's
vault shows, for every certificate token, the issuer's key id, its web address and which registry
signed its key note.

## Two levels of trust, as with https

1. **Listed issuers.** Banks, employers, regulators and other known entities, confirmed by a
   registry on the middle ground's list, or kept on a list of authentic entities. Important
   matters, such as financial approvals, accept only these.
2. **Unknown issuers.** A small shop or a new business, checked over the internet: the middle
   ground confirms that the key is published at the issuer's own https web address. This is how
   anyone can get an https certificate for a website today, and it is enough for small matters,
   such as a loyalty discount.

Each rule sheet says which level each field needs. The sample does the first level today; the
internet check is the next step, and the one place a middle ground would read another server.

**How it evolves.** This is an early phase: no ready-made list of authentic entities exists yet,
and the sample uses one test registry. The lists will grow the way certificate lists did for
https: registries, regulators and industry bodies publish their members' keys, middle ground
hosts choose which lists they trust, and cloud platforms can offer the internet check as part of a
middle ground service.

## Earlier confirmation tokens as proof

A confirmation token is itself signed, by a middle ground. In a later meeting an agent can bring it
(for example "income above ₹50,000 for 3 months: yes") instead of the salary tokens again. This is
how split tokens work, and how a resume becomes a set of tokens.

## Trying fakes

The mock issuers page ([`starters/personal-agent/issuers.html`](../starters/personal-agent/issuers.html)) can make six
kinds of fake, each sent to an agent in place of the real token:

| Fake | What catches it |
|---|---|
| The value changed after signing | the signature no longer matches |
| A forger signs under the issuer's name with its own key | no trusted registry confirmed that key |
| A forger writes its own key note in the registry's name | the key note is not signed by that registry |
| A key note from a registry nobody trusts | the registry is not on the middle ground's list |
| A real token issued to a different agent | it names another agent's key |
| A real token that has run out | its date |

## The sample registry

The sample's registry, *Sample Business Registry*, has its secret key in public, in
[`starters/samples.js`](../starters/samples.js), so anyone running
the sample can play it and give their own sample issuers a key note. It is the same idea as the
test certificates developers use on their own computers. A real middle ground removes it from its
list. A real person pass also has to come from a provider whose key a trusted registry confirmed.

## What this does not solve

- An issuer that is real but lies. The registry is the first answer; later layers can add more.
- A stolen, unlocked phone. Tokens are tied to the agent's key, and the fingerprint rule guards it.
- Cancelling a token early. The sample uses short validity instead of cancel lists: an issuer that
  must correct a token issues a new one.
