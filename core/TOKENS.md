# Tokens

AMP has three kinds of token, all signed and all checkable by anyone:

| Token | Signed by | Says |
|---|---|---|
| **Certificate token** ([CERTIFICATE-TOKENS.md](CERTIFICATE-TOKENS.md)) | whoever issued it | a fact the issuer stands behind |
| **Personal token** | the person's own agent | the person's own words |
| **Confirmation token** (this page) | the middle ground, after a meeting | what was seen and confirmed |

Certificate and personal tokens go into a meeting. A confirmation token comes out, one for each side.

## What a confirmation token holds

| Field | What it is |
|---|---|
| `v`, `id`, `kind` | The format version (`1`), an unguessable reference, and `confirmation token` |
| `says` | What it is, in plain words |
| `room`, `rules` | The room, and the rule sheet that wrote it: `{ sheet, title, fingerprint }` |
| `for`, `sides` | Which side it is for, and who each side was (a joined business, or "a verified person") |
| `otherSideShowed` | What the other side brought, and the proof behind each value (who signed it, or "their own word") |
| `confirmed` | The answers: `[{ says, answer }]`, each in its fixed shape |
| `outcome` | One line for this side, such as the offer itself |
| `counts` | For a pool room's office: counts by group, small groups hidden |
| `replyTo`, `swipe` | If the person agreed: the key to send them a certificate token, and their device-signed approval with their person pass, to check again |
| `heldBy`, `goodUntil`, `uses` | Who holds it, until when, and `once` |
| `madeBy`, `makerAt`, `made`, `code`, `keyId` | The middle ground's name and https address, when, the code that worked it out, and which of its keys signed |
| `stamp` | The signature over every other field |

The host's stamped statement (`kind: statement`) and an auditor's audit token (`kind: audit`) have
the same `madeBy`, `makerAt`, `keyId` and `stamp`, and are checked the same way.

## Checking a token

1. Read `makerAt` and `keyId`.
2. Ask `makerAt` + `/api/key?id=` + `keyId` for the open key. Check that the key has that id.
3. Check the stamp over every field except `stamp` (`MG.wordsOf` gives the exact words).
4. Check `goodUntil`.

`MG.verify(token)` in [`link.js`](link.js) does all four. From the command line:
`node core/check.js token.json`. Because the address is https, the key is tied to the address, the
same way a website's certificate ties it to its name. There is no list of keys to keep.

Only the maker can say whether a token marked `once` has been used: `POST /api/check` with `use: true`.

**After a key change.** A middle ground that changes its key keeps answering for the old key id
while the host stands by it, so older tokens still check; `MG.verify` then adds `oldKey: true`.
If the old key leaked, the host drops it and its tokens are refused.

## Carrying a token

A program carries a token as one line of text: `MG1.<the token>.<a fresh showing>`. The showing
is signed by the holder's own key, names one receiver, and is good for two minutes. A copy in
another program, or a line sent on to someone else, is refused. See [`carry.js`](carry.js).

## Personal tokens

A **personal token** is a person's own words, signed by their own agent (`MG.carry.state`). It
proves who said it, not that it is true, and it is always shown as their own words.
