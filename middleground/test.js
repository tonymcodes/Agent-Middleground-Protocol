// THE CHECKS. Every example meeting, every fake, every limit, and the server itself.
// Run from the repo folder:  npm test   (or: node middleground/test.js)
const assert = require('assert'), { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const MG = require('./ground.js');
for (const f of ['../core/stamp.js', '../core/carry.js', '../core/code.js', '../core/paper.js', '../core/swipe.js', '../core/sheet.js', '../core/link.js',
  './known.js', './host.js', './rules.js', '../starters/samples.js', '../starters/personal-agent/agent.js', '../starters/company/company.js']) require(f);

let done = 0; const ok = name => { done++; console.log('ok  ' + name); };
const tick = (holder, list) => MG.swipe.mimic(list.length);   // the sample's ticked box, standing in for a fingerprint
const answers = n => Object.fromEntries(n.confirmed.map(c => [c.says, c.answer]));

// A SMALL WORLD for one middle ground: the sample issuers, people with real person passes, and joined businesses.
async function world(g) {
  g = g || MG.create({ address: 'http://localhost:8787' });
  const call = typeof g === 'function' ? g : MG.link(g), keys = new Map(), store = { get: k => keys.get(k), set: (k, v) => keys.set(k, v) };
  const provider = await MG.sampleIssuer('Sample agent provider', store);
  const { rules } = await call('rules', {}), rule = id => rules.find(r => r.id === id);
  const person = async (how, passkey) => {
    const k = await MG.stamp.newKey(), a = MG.agent(k);
    a.keep(await provider.paper('real person pass', { verified: 'yes', ...(passkey ? { passkey } : {}) }, k.open));
    if (how !== null) a.approve(how || tick);
    return a;
  };
  // The certificate tokens the sample issuers would have sent for one side of one use case.
  const papers = async (id, side, holder, data) => { const s = MG.samples[id][side], out = []; for (const f in (s.stamps || {})) out.push(await (await MG.sampleIssuer(s.stamps[f], store)).forField(f, (data || s.data)[f], holder)); return out; };
  const businesses = {}, business = async (name, stampKey) => { if (!businesses[name]) { businesses[name] = MG.company(name, call, stampKey); await businesses[name].join(); } return businesses[name]; };
  const roomOf = async id => (await call('rooms', {})).rooms.find(r => r.room === id);
  return { g, call, store, provider, rule, person, papers, business, roomOf };
}
// No value one side brought may appear in a token for the other side.
const noValues = (token, data) => { const s = JSON.stringify(token); for (const v of Object.values(data)) for (const part of String(v).split(/[\n;]/).map(x => x.trim()).filter(x => x.length > 4)) assert(!s.includes(part), 'a token leaked "' + part + '"'); };

async function oneMeeting() {
  const W = await world(), F = MG.samples['credit-offer'], bank = await W.business(F.business.name), asha = await W.person();
  const opened = await bank.meetOpen(W.rule('credit-offer'), F.business.data, await W.papers('credit-offer', 'business', F.business.name));
  const listed = (await bank.meetRooms('credit-offer')).rooms;
  assert(listed[0].public.offer && !JSON.stringify(listed).includes(F.business.data.minIncome), 'a waiting room shows public fields only');
  const mine = await asha.meetBring(W.call, listed[0], F.person.data, await W.papers('credit-offer', 'person', asha.open));
  const theirs = await bank.meetPickup(opened.room);
  assert.strictEqual(mine.note.for, 'person'); assert.strictEqual(theirs.note.for, 'business');
  assert.strictEqual(answers(theirs.note)['Income above your minimum in each of the last 3 months'], 'yes');
  assert.strictEqual(answers(theirs.note)['Average monthly income'], '₹50,000 – 1,00,000');
  assert.strictEqual(answers(mine.note)['You qualify for this offer'], 'yes');
  noValues(theirs.note, F.person.data); noValues(mine.note, { minIncome: F.business.data.minIncome });
  assert(theirs.note.otherSideShowed.some(s => /signed by Kestrel Labs payroll/.test(s.proof)), 'the token says who signed what was shown');
  assert(await MG.stamp.check(W.g.stats().stampKey, MG.wordsOf(mine.note), mine.note.stamp) && mine.note.heldBy === asha.open, 'the token is signed by the middle ground and held by the agent');
  assert.strictEqual(mine.note.rules.fingerprint, W.rule('credit-offer').fingerprint, 'the token names the rule sheet’s fingerprint');
  assert(!W.g.stats().meetings.length, 'the room is gone once both tokens are out');
  ok('a meeting: both sides bring data, each gets its own signed confirmation token about the other, in fixed shapes, and the room is wiped');
}

async function tokensBack() {
  const W = await world(), F = MG.samples['credit-offer'], bankKey = await MG.sampleIssuer(F.business.name, W.store);
  const bank = await W.business(F.business.name, { secret: (await MG.stamp.load(W.store.get('issuer:' + F.business.name))).secret, open: bankKey.open, keyNote: bankKey.keyNote });
  const kim = await W.person(), r = await bank.meetOpen(W.rule('credit-offer'), F.business.data, await W.papers('credit-offer', 'business', F.business.name));
  const kimNote = (await kim.meetBring(W.call, await W.roomOf(r.room), F.person.data, await W.papers('credit-offer', 'person', kim.open), 'person', true)).note;
  const bankNote = (await bank.meetPickup(r.room)).note;
  assert.strictEqual(bankNote.replyTo, kim.open, 'the business’s token names the key the person shared');
  assert(!kimNote.replyTo, 'the person’s own token names no key');
  const letter = await bank.issuePaper('offer letter', { field: 'offer letter', value: F.business.data.offer }, bankNote.replyTo, 30);
  assert((await bank.sendPaper(letter, bankNote.replyTo)).delivered);
  assert((await W.call('deliver', { from: F.business.name, key: 'wrong', to: kim.open, paper: letter })).error, 'only a joined business can send');
  assert((await bank.sendPaper(await (await MG.sampleIssuer('Someone else', W.store)).paper('x', { field: 'x', value: 'y' }, kim.open), kim.open)).error, 'a business sends only its own certificate tokens');
  assert(/does not pass/.test((await bank.sendPaper({ ...letter, facts: { field: 'offer letter', value: 'Loan up to ₹50,00,000' } }, kim.open)).error), 'a changed certificate token is refused at the door');
  assert.strictEqual((await (await W.person()).collectPapers(W.call)).papers.length, 0, 'another agent collects nothing');
  const got = await kim.collectPapers(W.call), check = await MG.paper.check(got.papers[0], kim.open, { registries: { [MG.sampleRegistry.name]: MG.sampleRegistry.open } });
  assert(got.papers.length === 1 && check.good && check.confirmed, 'the certificate token the person collects checks as signed by the bank');
  assert.strictEqual((await kim.collectPapers(W.call)).papers.length, 0, 'it leaves the middle ground once collected');
  ok('tokens back: with the person’s agreement the business’s token names their key, the business sends a certificate token through the middle ground, and only that agent collects it');
}

async function fakes() {
  const W = await world(), F = MG.samples['credit-offer'], bank = await W.business(F.business.name);
  const meet = async (paper, value) => {
    const r = await bank.meetOpen(W.rule('credit-offer'), F.business.data, await W.papers('credit-offer', 'business', F.business.name)), who = await W.person();
    const others = (await W.papers('credit-offer', 'person', who.open)).filter(x => x.facts.field !== 'salary');
    await who.meetBring(W.call, await W.roomOf(r.room), { ...F.person.data, salary: value || F.person.data.salary }, [...(paper ? [await paper(who.open)] : []), ...others]);
    const n = (await bank.meetPickup(r.room)).note;
    return { proof: n.otherSideShowed.find(s => /Salary/.test(s.what)).proof, answer: answers(n)['Income above your minimum in each of the last 3 months'] };
  };
  const payroll = await MG.sampleIssuer('Kestrel Labs payroll', W.store), other = new Map(), forgerStore = { get: k => other.get(k), set: (k, v) => other.set(k, v) }, salary = F.person.data.salary;
  const good = await meet(h => payroll.forField('salary', salary, h));
  assert(/signed by Kestrel Labs payroll \(key confirmed by Sample Business Registry\)/.test(good.proof) && good.answer === 'yes', 'a genuine certificate token is proof: ' + good.proof);
  assert.strictEqual((await meet(null, '92000, 94000, 93500')).answer, 'not proven', 'a value with no token behind it is not proven');
  const cases = [
    ['a token changed after signing', /signature does not match/, async h => { const p = await payroll.forField('salary', salary, h); p.facts.value = '92000, 94000, 93500'; return p; }, '92000, 94000, 93500'],
    ['a forger’s own key under the employer’s name', /not confirmed by any registry/, async h => (await MG.sampleIssuer('Kestrel Labs payroll', forgerStore, false)).forField('salary', salary, h)],
    ['a forged key note', /not signed by the registry it names/, async h => { const k = await MG.stamp.newKey(), n = await MG.paper.keyNote({ name: 'Sample Business Registry', secret: k.secret }, { name: 'Kestrel Labs payroll', open: k.open }); return MG.paper.issue({ name: 'Kestrel Labs payroll', secret: k.secret, open: k.open, keyNote: n }, 'salary', { field: 'salary', value: salary }, h); }],
    ['a registry not on the list', /registry this checker does not trust/, async h => { const reg = await MG.stamp.newKey(), k = await MG.stamp.newKey(), n = await MG.paper.keyNote({ name: 'Back Alley Registry', secret: reg.secret }, { name: 'Kestrel Labs payroll', open: k.open }); return MG.paper.issue({ name: 'Kestrel Labs payroll', secret: k.secret, open: k.open, keyNote: n }, 'salary', { field: 'salary', value: salary }, h); }],
    ['someone else’s token', /issued to a different agent/, async () => payroll.forField('salary', salary, (await MG.stamp.newKey()).open)],
    ['a token that has run out', /run out/, h => payroll.forField('salary', salary, h, -1)],
    ['a value typed over a genuine token', /value differs/, h => payroll.forField('salary', salary, h), '99000, 99000, 99000'],
  ];
  for (const [what, why, paper, value] of cases) { const r = await meet(paper, value); assert(why.test(r.proof) && r.answer === 'not proven', what + ': ' + r.proof); }
  ok('fakes: a genuine certificate token is proof; a changed one, a forger’s own key, a forged key note, an unknown registry, someone else’s token, an old token and a typed-over value are each “not proven”, with the reason');
  const fk = await MG.stamp.newKey(), faker = MG.agent(fk);
  faker.keep(await (await MG.sampleIssuer('Sample agent provider', forgerStore, false)).paper('real person pass', { verified: 'yes' }, fk.open)); faker.approve(tick);
  const rf = await bank.meetOpen(W.rule('credit-offer'), F.business.data);
  assert((await faker.meetBring(W.call, await W.roomOf(rf.room), F.person.data)).error, 'a real person pass whose key no registry confirmed is refused');
  ok('a real person pass must come from a provider whose key a trusted registry confirmed');
}

async function roomsAndLimits() {
  const W = await world(), F = MG.samples['credit-offer'], bank = await W.business(F.business.name), cr = W.rule('credit-offer');
  // Either side may open first; only the opener collects.
  const p3 = await W.person(), r3 = await p3.meetOpen(W.call, cr, F.person.data, await W.papers('credit-offer', 'person', p3.open));
  assert((await p3.meetPickup(W.call, r3.room)).waiting, 'before the other side comes there is nothing to collect');
  assert((await bank.meetPickup(r3.room)).error, 'only the side that opened a room collects from it');
  assert((await bank.meetBring(await W.roomOf(r3.room), F.business.data, await W.papers('credit-offer', 'business', F.business.name))).note);
  assert.strictEqual((await p3.meetPickup(W.call, r3.room, 'person')).note.for, 'person');
  // The look limit: one pair, one rule sheet, a few times a day.
  for (let n = 0; n < 2; n++) { const r = await bank.meetOpen(cr, F.business.data); assert(!(await p3.meetBring(W.call, await W.roomOf(r.room), F.person.data)).error); await bank.meetPickup(r.room); }
  const r4 = await bank.meetOpen(cr, F.business.data);
  assert(/limit/.test((await p3.meetBring(W.call, await W.roomOf(r4.room), F.person.data)).error), 'a fourth look by the same pair the same day is refused');
  ok('either side can open a room, only the opener collects, and one pair may meet only a few times a day');
  // Refusals at the door.
  const nobody = MG.agent(await MG.stamp.newKey()); nobody.approve(tick);
  assert((await nobody.meetBring(W.call, await W.roomOf(r4.room), F.person.data)).error, 'no real person pass');
  assert((await W.call('bring', { side: 'business', from: F.business.name, key: 'wrong', room: r4.room, accepts: r4.fingerprint })).error, 'a business with the wrong key');
  assert(/accepts/.test((await W.call('open', { side: 'business', from: F.business.name, key: bank.key(), rule: 'credit-offer' })).error), 'opening without naming the accepted sheet');
  const elsewhere = await W.person();
  assert(/not the one this side accepted/.test((await elsewhere.meetBring(W.call, { ...(await W.roomOf(r4.room)), fingerprint: W.rule('job-match').fingerprint }, F.person.data)).error), 'a room that runs another sheet than the one accepted');
  ok('a meeting refuses an agent with no real person pass, a business with the wrong key, and any side that did not accept the room’s exact rule sheet');
}

async function personToPerson() {
  const W = await world(), U = MG.samples['used-goods'], seller = await W.person(), buyer = await W.person();
  const ru = await seller.meetOpen(W.call, W.rule('used-goods'), U.seller.data, await W.papers('used-goods', 'seller', seller.open), 'seller');
  const nb = (await buyer.meetBring(W.call, await W.roomOf(ru.room), U.buyer.data, await W.papers('used-goods', 'buyer', buyer.open), 'buyer')).note;
  const ns = (await seller.meetPickup(W.call, ru.room, 'seller')).note;
  assert.strictEqual(answers(nb)['The seller owns it: the bill is signed by the shop'], 'yes');
  assert.strictEqual(answers(ns)['The buyer’s price meets your lowest'], 'yes');
  assert(!JSON.stringify(ns).includes(U.buyer.data.most) && !JSON.stringify(nb).includes(U.seller.data.lowest), 'neither price limit is in a token');
  const self = await seller.meetOpen(W.call, W.rule('used-goods'), U.seller.data, [], 'seller');
  assert(/itself/.test((await seller.meetBring(W.call, await W.roomOf(self.room), U.buyer.data, [], 'buyer')).error));
  ok('two personal agents meet as seller and buyer, each gets its own token, and neither price limit leaves the room');
}

async function pools() {
  const W = await world(), T = MG.samples['event-travel'], police = await W.business(T.business.name), pr = await police.meetOpen(W.rule('event-travel'), T.business.data);
  let first;
  for (let n = 0; n < 12; n++) { const a = await W.person(), d = { ...T.person.data, pincode: n < 10 ? '560034' : '560066' }; const r = await a.meetBring(W.call, await W.roomOf(pr.room), d, await W.papers('event-travel', 'person', a.open, d)); first = first || r; }
  const office = (await police.meetPickup(pr.room)).note;
  assert.strictEqual(office.counts['Coming from'].South, 10); assert.strictEqual(office.counts['Coming from'].East, 'fewer than 3');
  assert(!JSON.stringify(office).includes('560034') && answers(first.note)['Your ticket was checked, and not kept'] === 'yes');
  ok('a pool room gives each person a token and the office counts only, with groups smaller than 3 hidden');
  // Pay talks: give one verified figure, see the summary for your group once it has 5 people.
  const P = MG.samples['pay-talks'], survey = await W.business(P.business.name), pt = await survey.meetOpen(W.rule('pay-talks'), P.business.data), pays = [61000, 72000, 80500, 88000, 95000, 120000];
  const tokens = [];
  for (const pay of pays) { const a = await W.person(), d = { ...P.person.data, pay: String(pay) }; tokens.push((await a.meetBring(W.call, await W.roomOf(pt.room), d, await W.papers('pay-talks', 'person', a.open, d))).note); }
  assert.strictEqual(answers(tokens[3])['Middle monthly pay in your group (₹)'], 'too few to show', 'a group of 4 is not shown');
  const sixth = answers(tokens[5]);
  assert.deepStrictEqual([sixth['People in your group so far (same kind of work and city)'], sixth['Lower quarter of monthly pay in your group (₹)'], sixth['Middle monthly pay in your group (₹)'], sixth['Upper quarter of monthly pay in your group (₹)']], [6, 72000, 81000, 88000], 'rounded figures, summarised');
  const own = await W.person(), unproven = (await own.meetBring(W.call, await W.roomOf(pt.room), { ...P.person.data, pay: '500000' }, [])).note;
  assert.strictEqual(answers(unproven)['Your figure was added, rounded to ₹1,000, and your details were dropped'], 'not proven', 'a figure no employer signed is not added');
  const host = (await survey.meetPickup(pt.room)).note;
  assert.strictEqual(host.counts['Kind of work']['Backend engineer'], 6); assert(!/72000|81000|95000/.test(JSON.stringify(host)), 'the survey host sees counts, never figures');
  ok('pay talks: each person gives one figure signed by their employer and sees the summary for their group once it has 5 people; the host sees counts only');
}

async function shopping() {
  const W = await world(), S = MG.samples['shop-offer'], shop = await W.business(S.business.name);
  const meet = async data => { const r = await shop.meetOpen(W.rule('shop-offer'), S.business.data), a = await W.person(); const mine = (await a.meetBring(W.call, await W.roomOf(r.room), data)).note; return { mine, theirs: (await shop.meetPickup(r.room)).note }; };
  const fits = await meet(S.person.data);
  assert(/One offer for you/.test(fits.mine.outcome) && answers(fits.theirs)['Looking for: running shoes, trainers'] === 'yes' && answers(fits.theirs)['Budget, shared only when they are looking for it'] === '₹5,000 – 10,000');
  const not = await meet({ ...S.person.data, wants: 'a kettle' });
  assert(answers(not.theirs)['Budget, shared only when they are looking for it'] === 'not shared' && answers(not.theirs)['Town, shared only when they are looking for it'] === 'not shared', 'a shop learns nothing more about someone not looking for its offer');
  noValues(fits.theirs, { budget: S.person.data.budget });
  ok('a shop’s offer reaches only a person looking for it; the shop learns a budget band and a town, never a name, and nothing from anyone else');
  const L = MG.samples['loyalty-discount'], brand = await W.business(L.business.name), r = await brand.meetOpen(W.rule('loyalty-discount'), L.business.data), buyer = await W.person();
  const mine = (await buyer.meetBring(W.call, await W.roomOf(r.room), L.person.data, await W.papers('loyalty-discount', 'person', buyer.open))).note, theirs = (await brand.meetPickup(r.room)).note;
  assert(answers(mine)['You qualify for: 15% off your next 3 packs'] === 'yes' && answers(theirs)['Times Leaf & Bean coffee was bought since 2026-06-01'] === '6 – 10' && !/Tea leaves|2026-07-09/.test(JSON.stringify(theirs)));
  ok('a loyalty discount from signed bills: the maker learns how often, never the bills');
  const J = MG.samples['job-match'], firm = await W.business(J.business.name), rj = await firm.meetOpen(W.rule('job-match'), J.business.data), anjali = await W.person();
  await anjali.meetBring(W.call, await W.roomOf(rj.room), J.person.data, await W.papers('job-match', 'person', anjali.open));
  const hire = answers((await firm.meetPickup(rj.room)).note);
  assert(hire['Has every skill you listed'] === 'yes' && hire['Pay expectation within your budget'] === 'yes' && hire['Years of experience'] === '5 – 8');
  ok('recruitment: the role learns the candidate fits, with a years band, and neither side’s pay figure crosses');
}

async function shapes() {
  const W = await world(), F = MG.samples['credit-offer'], bank = await W.business(F.business.name), sheet = MG.rules['credit-offer'], look = sheet.look;
  sheet.look = S => { const r = look.call(sheet, S); r.business.incomeBand = S.person.salary.value; return r; };
  try {
    // A changed sheet has a new fingerprint, so both sides would see the change; here they accept it anyway.
    const changed = (await W.call('rules', {})).rules.find(x => x.id === 'credit-offer');
    assert.notStrictEqual(changed.fingerprint, W.rule('credit-offer').fingerprint, 'changing a rule sheet changes its fingerprint');
    const r = await bank.meetOpen(changed, F.business.data), leaky = await W.person();
    const got = await leaky.meetBring(W.call, await W.roomOf(r.room), F.person.data);
    assert(/shape/.test(got.error), "an answer that does not fit its shape stops the room: " + JSON.stringify(got).slice(0, 300));
  } finally { sheet.look = look; }
  ok('a rule sheet answer that does not fit its shape stops the room, so no raw value can cross');
}

// A RULE SHEET THE BUSINESS BRINGS (core/sheet.js): checked by the middle ground and by the person's agent, run with no
// change to the middle ground, and accepted by its fingerprint.
async function broughtSheets() {
  const W = await world(), B = MG.samples.brought, gym = await W.business(B.business.name), sheet = B.sheet;
  assert(MG.sheet.check(sheet).ok, 'the sample sheet passes: ' + JSON.stringify(MG.sheet.check(sheet).problems));
  const bad = (change, why) => { const s = JSON.parse(JSON.stringify(sheet)); change(s); const c = MG.sheet.check(s); assert(!c.ok && c.problems.some(p => why.test(p)), 'expected ' + why + ', got ' + JSON.stringify(c.problems)); };
  bad(s => { s.answers.business.push({ says: 'Age band', band: 'person.age', edges: [30, 31, 32, 33], names: ['a', 'b', 'c', 'd', 'e'] }); }, /rise by at least 10%/);
  bad(s => { s.answers.business.push({ says: 'Older than 30', test: ['person.age', 'more than', 30] }, { says: 'Older than 40', test: ['person.age', 'more than', 40] }); }, /used in 3 answers/);
  bad(s => { s.person.push({ key: 'area', label: 'Area', type: 'text' }); s.answers.business.push({ says: 'Lives in Indiranagar', test: ['person.area', 'equals', 'Indiranagar'] }); }, /cannot test one exact word/);
  bad(s => { s.answers.business[0].test[1] = 'sounds like'; }, /a test is/);
  bad(s => { s.answers.business[0].test[0] = 'person.salary'; }, /not a field/);
  bad(s => { s.look = 'function () {}'; }, /does not know/);
  bad(s => { s.person = Array.from({ length: 9 }, (_, n) => ({ key: 'f' + n, label: 'F' + n, type: 'number' })); }, /1 to 8 fields/);
  ok('a brought rule sheet is checked against the limits: no band can narrow a value, no field is tested more than twice for the other side, no yes or no confirms one exact word, and only the known functions run');

  const r = await gym.meetOpen({ sheet }, B.business.data);
  assert(r.room && r.fingerprint === await MG.sheet.fingerprint(sheet), 'any middle ground runs it: ' + JSON.stringify(r));
  assert((await gym.meetOpen({ sheet: { ...sheet, answers: { business: [{ says: 'x', test: ['person.age', 'sounds like', 1] }] } } }, B.business.data)).error, 'a sheet that fails is refused by the kit');
  assert(/does not pass/.test((await W.call('open', { side: 'business', from: B.business.name, key: gym.key(), sheet: { title: 'x', business: [], person: [] }, accepts: 'x' })).error), 'and by the middle ground');
  const room = await W.roomOf(r.room), asha = await W.person(), seen = await asha.review(room);
  assert(seen.ok && seen.words.learn.find(x => x.who === 'The business').answers.length === sheet.answers.business.length, 'the agent reads it and shows the person what each side learns');
  const mine = (await asha.meetBring(W.call, room, B.person.data, await W.papers('brought', 'person', asha.open))).note, theirs = (await gym.meetPickup(r.room)).note;
  assert(answers(mine)['You qualify for the membership'] === 'yes' && answers(theirs)['Old enough for membership'] === 'yes' && answers(theirs)['Walks enough each day'] === 'yes', JSON.stringify([mine.confirmed, theirs.confirmed]));
  assert.strictEqual(theirs.rules.fingerprint, r.fingerprint); noValues(theirs, { age: B.person.data.age, steps: B.person.data.steps });
  const typed = await W.person(), r2 = await gym.meetOpen({ sheet }, B.business.data);
  await typed.meetBring(W.call, await W.roomOf(r2.room), { ...B.person.data, age: '35' }, []);
  assert.strictEqual(answers((await gym.meetPickup(r2.room)).note)['Old enough for membership'], 'not proven', 'a value the sheet wants backed by a token, without one, is not proven');
  // The agent refuses a room whose sheet was changed, and an agent's own rules can say no.
  const r3 = await gym.meetOpen({ sheet }, B.business.data), changed = { ...(await W.roomOf(r3.room)), sheet: { ...sheet, title: 'Something else' } };
  assert(/not the one the room names/.test((await asha.meetBring(W.call, changed, B.person.data)).error), 'a sheet that is not the room’s own is refused by the agent');
  const careful = MG.agent(await MG.stamp.newKey(), { accept: s => s.person.length <= 2 || 'it asks for more than two things' });
  assert(/more than two things/.test((await careful.review(await W.roomOf(r3.room))).why), 'the person’s own rules');
  ok('a rule sheet a business brings runs at the middle ground with no change to it; the person’s agent checks it the same way, shows it in plain words, and accepts it by its fingerprint');
}

// THE PERSON'S APPROVAL (core/swipe.js). The device is played by a key made here, signing the way a phone's secure chip
// signs a passkey approval.
async function approvals() {
  const wc = require('crypto').webcrypto, W = await world(), F = MG.samples['credit-offer'], bank = await W.business(F.business.name), cr = W.rule('credit-offer');
  const b64 = u => Buffer.from(u).toString('base64'), b64url = u => Buffer.from(u).toString('base64url');
  const sha = async x => new Uint8Array(await wc.subtle.digest('SHA-256', typeof x === 'string' ? new TextEncoder().encode(x) : x));
  const der = raw => { const int = v => { let i = 0; while (i < v.length - 1 && v[i] === 0) i++; v = v.slice(i); return v[0] & 0x80 ? [0, ...v] : [...v]; }; const r = int(raw.slice(0, 32)), s = int(raw.slice(32)); return Uint8Array.from([0x30, r.length + s.length + 4, 2, r.length, ...r, 2, s.length, ...s]); };
  const newChip = async () => { const k = await wc.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); return { k, open: b64(new Uint8Array(await wc.subtle.exportKey('spki', k.publicKey))) }; };
  const chip = await newChip(), other = (await newChip()).open;
  // flags 5: the person was present and the device checked them (fingerprint, face or PIN).
  const device = (opts = {}) => async (holder, purposes) => {
    const list = [].concat(purposes), at = new Date().toISOString(), salts = list.map((_, n) => 'salt' + n + Math.random());
    const codes = await Promise.all(list.map((p, n) => MG.swipe.codeOf(opts.purpose || p, salts[n]))), ch = b64url(await MG.swipe.challenge(holder, at, codes));
    const cd = new TextEncoder().encode(JSON.stringify({ type: 'webauthn.get', challenge: ch, origin: 'http://localhost:8787' }));
    const ad = new Uint8Array(37); ad.set(await sha('localhost')); ad[32] = opts.flags || 5;
    const data = new Uint8Array(ad.length + 32); data.set(ad); data.set(await sha(cd), ad.length);
    const sig = der(new Uint8Array(await wc.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, chip.k.privateKey, data)));
    if (opts.tamper) sig[sig.length - 1] ^= 1;
    return Object.fromEntries(list.map((p, n) => [p, { how: 'device', at, key: chip.open, alg: -7, authData: b64(ad), clientData: b64(cd), sig: b64(sig), codes, salt: salts[n] }]));
  };
  const meet = async (how, passkey = chip.open, share = false) => {
    const a = await W.person(how, passkey), r = await bank.meetOpen(cr, F.business.data, await W.papers('credit-offer', 'business', F.business.name));
    const mine = await a.meetBring(W.call, await W.roomOf(r.room), F.person.data, await W.papers('credit-offer', 'person', a.open), 'person', share);
    return { mine, theirs: mine.error ? null : await bank.meetPickup(r.room) };
  };
  assert(/approval/.test((await meet(null)).mine.error), 'no approval: nothing leaves');
  assert(/not recent/.test((await meet(async () => ({ how: 'mimic', at: new Date(Date.now() - 5 * 60000).toISOString() }))).mine.error), 'an old approval is refused');
  assert(/ticked box standing in for a fingerprint/.test(JSON.stringify((await meet(tick)).theirs.note)), 'the other side is told the approval was the sample’s ticked box');
  ok('a meeting needs the person’s recent approval of that very request; the sample’s ticked box is accepted and named as such');
  const real = await meet(device());
  assert(!real.mine.error && /fingerprint on the device named in their person pass, checked/.test(JSON.stringify(real.theirs.note)), 'a real fingerprint is checked and named');
  assert(/does not name/.test((await meet(device(), null)).mine.error), 'a fingerprint from a device the pass does not name');
  assert(/does not name/.test((await meet(device(), other)).mine.error), 'a fingerprint from another device');
  assert(/different request/.test((await meet(device({ purpose: 'meet:bring:RM-OTHER:x' }))).mine.error), 'a swipe made for another request');
  assert(/did not check the person/.test((await meet(device({ flags: 1 }))).mine.error), 'no fingerprint, face or PIN check');
  assert(/does not match/.test((await meet(device({ tamper: true }))).mine.error), 'a changed signature');
  MG.host.realFingerprintOnly = true;
  try { assert(/only a real fingerprint/.test((await meet(tick)).mine.error)); assert(!(await meet(device())).mine.error); } finally { MG.host.realFingerprintOnly = false; }
  ok('a real fingerprint on the device (a passkey) is checked by the middle ground: tied to this agent and this request, with the device’s own check of the person, from the device the person pass names; a host can require it');

  const trust = { registries: { [MG.sampleRegistry.name]: MG.sampleRegistry.open } };
  assert(!real.theirs.note.swipe, 'without the key shared, the token carries no device signature');
  const proof = (await meet(device(), chip.open, true)).theirs.note.swipe;
  assert(proof && (await MG.swipe.recheck(proof, trust)).ok && !(await MG.swipe.recheck(proof, {})).ok, 'checked again without the middle ground, by anyone who trusts the registry');
  const moved = async change => { const p = JSON.parse(JSON.stringify(proof)); change(p); return (await MG.swipe.recheck(p, trust)).ok; };
  for (const change of [p => { p.purpose = 'meet:bring:RM-OTHER:x'; }, p => { p.holder = 'someone-else'; }, p => { p.pass.facts.passkey = other; }, p => { p.key = other; p.pass.facts.passkey = other; }]) assert(!await moved(change));
  ok('with the person’s key shared, the other side’s token carries the device-signed approval and the person pass, so anyone can check the fingerprint again without the middle ground');

  // ONE SWIPE FOR A LIST of small meetings; a loan needs a swipe of its own; each approval is used once.
  const L = MG.samples['loyalty-discount'], J = MG.samples['job-match'], shop = await W.business(L.business.name), firm = await W.business(J.business.name);
  const r1 = await shop.meetOpen(W.rule('loyalty-discount'), L.business.data), r2 = await firm.meetOpen(W.rule('job-match'), J.business.data);
  let swipes = 0; const counted = how => async (h, p) => { swipes++; return how(h, p); };
  const many = await W.person(counted(device()), chip.open);
  const both = await many.meetList(W.call, [
    { room: await W.roomOf(r1.room), data: L.person.data, papers: await W.papers('loyalty-discount', 'person', many.open), shareKey: true },
    { room: await W.roomOf(r2.room), data: J.person.data, papers: await W.papers('job-match', 'person', many.open) }]);
  assert(swipes === 1 && both.every(x => x.note), 'one swipe approves both: ' + JSON.stringify(both.map(x => x.error)));
  const shopNote = (await shop.meetPickup(r1.room)).note;
  assert(shopNote.swipe.codes.length === 2 && !JSON.stringify(shopNote).includes(r2.room) && (await MG.swipe.recheck(shopNote.swipe, trust)).ok, 'the shop’s token shows only its own item');
  const r3 = await bank.meetOpen(cr, F.business.data), r4 = await shop.meetOpen(W.rule('loyalty-discount'), L.business.data);
  const mixed = await (await W.person(device(), chip.open)).meetList(W.call, [{ room: await W.roomOf(r3.room), data: F.person.data }, { room: await W.roomOf(r4.room), data: L.person.data }]);
  assert(/swipe of its own/.test(mixed[0].error) && mixed[1].note, 'a loan inside a list is refused; the small item still goes');
  const opener = await W.person(null, chip.open), purpose = 'meet:open:' + W.rule('loyalty-discount').fingerprint, once = await device()(opener.open, [purpose]);
  opener.approve(async () => once);
  assert(!(await opener.meetOpen(W.call, W.rule('loyalty-discount'), L.person.data)).error, 'the first use goes');
  assert(/already used/.test((await opener.meetOpen(W.call, W.rule('loyalty-discount'), L.person.data)).error), 'the same approval used again is refused');
  ok('one swipe can approve a list of small meetings the person saw together; an important one (a loan, a sale) needs a swipe of its own; each approval is used once, and a token shows the other side only its own item');
}

// THE CODE LINE (core/code.js): which starter code a side says it runs.
async function codeLine() {
  const own = await MG.codeOf('personal agent', MG.read), biz = await MG.codeOf('company', MG.read);
  assert(/^personal agent [0-9a-f]{16}$/.test(own) && /^company [0-9a-f]{16}$/.test(biz) && own.slice(-16) !== biz.slice(-16));
  const changed = await MG.codeOf('personal agent', async f => (await MG.read(f)) + (f.endsWith('agent.js') ? '\n// one changed line' : ''));
  assert.notStrictEqual(changed, own, 'one changed line gives a different code line');
  assert.strictEqual(await MG.codeOf('personal agent', async f => (await MG.read(f)).replace(/\r?\n/g, '\r\n')), own, 'the same on every computer');
  ok('code line: each starter has one fingerprint worked out from its own files, and one changed line changes it');
  const g = MG.create({ approved: [own, biz], starterCode: 'only' }), W = await world(g), F = MG.samples['credit-offer'];
  const bank = MG.company(F.business.name, W.call, null, biz); assert((await bank.join()).key, 'approved company code is served');
  assert((await MG.company('Old Shop', W.call).join()).error.includes('approved starter code'), 'a company that states no code line is refused');
  const room = async () => W.roomOf((await bank.meetOpen(W.rule('credit-offer'), F.business.data)).room);
  const as = async runs => { const k = await MG.stamp.newKey(), a = MG.agent(k, { runs }); a.keep(await W.provider.paper('real person pass', { verified: 'yes' }, k.open)); a.approve(tick); return a; };
  assert((await (await as(own)).meetBring(W.call, await room(), F.person.data)).note, 'approved agent code is served');
  assert((await (await as(changed)).meetBring(W.call, await room(), F.person.data)).error.includes('approved starter code'));
  const other = await as(changed), r = await room(), swapped = { ...(await other.request('meet:bring:' + r.room + ':' + r.fingerprint, { side: 'person', room: r.room, accepts: r.fingerprint, data: F.person.data })), runs: own };
  assert((await W.call('bring', swapped)).error, 'the agent’s stamp covers its code line, so it cannot be swapped on the way');
  ok('code line: a middle ground can refuse visitors that do not state approved starter code');
}

// THREE SIDES, through a link: a business and a person's agent reach a middle ground, in one program or over the network.
async function threeSides(call, tag) {
  const W = await world(call), F = MG.samples['credit-offer'], runs = await MG.codeOf('company', MG.read);
  const bank = MG.company(F.business.name + ' ' + tag, call, null, runs); await bank.join();
  const r = await bank.meetOpen(W.rule('credit-offer'), F.business.data, await W.papers('credit-offer', 'business', F.business.name));
  const k = await MG.stamp.newKey(), me = MG.agent(k, { runs: await MG.codeOf('personal agent', MG.read) });
  me.keep(await W.provider.paper('real person pass', { verified: 'yes' }, k.open)); me.approve(tick);
  const found = (await call('rooms', { rule: 'credit-offer' })).rooms.find(x => x.room === r.room);
  const mine = await me.meetBring(call, found, F.person.data, await W.papers('credit-offer', 'person', k.open)), theirs = await bank.meetPickup(r.room);
  assert(mine.note && theirs.note && answers(theirs.note)['Income above your minimum in each of the last 3 months'] === 'yes', JSON.stringify(mine.error || theirs.error));
  return { mine, theirs };
}

async function serverUp(port, env) {
  const child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env: { ...process.env, PORT: port, ...(env || {}) } });
  await new Promise((go, fail) => { child.stdout.once('data', go); child.once('error', fail); child.once('exit', () => fail(new Error('the test server on port ' + port + ' stopped at once: is the port in use?'))); });
  return child;
}

async function server() {
  const port = 8799, base = 'http://localhost:' + port, child = await serverUp(port);
  try {
    const s = await (await fetch(base + '/api/status')).json();
    assert.strictEqual(s.running.placesThatWriteAFile, 0); assert.strictEqual(s.running.placesThatCallAnotherServer, 0);
    for (const f of s.running.files) assert(Buffer.from(await (await fetch(base + '/source/' + f.file)).arrayBuffer()).equals(fs.readFileSync(path.join(__dirname, '..', f.file))), f.file + ' is served exactly as it is on disk');
    const said = await (await fetch(base + '/api/statement')).json();
    assert(await MG.stamp.check(s.stampKey, MG.wordsOf(said), said.stamp) && said.codeFingerprint === s.running.codeFingerprint, 'the stamped statement names the running code');
    const crypto = require('crypto'), fp = t => crypto.createHash('sha256').update(t.replace(/\r\n/g, '\n')).digest('hex');
    assert.strictEqual(fp(s.running.logic.map(f => f + ':' + fp(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'))).join('\n')), s.running.codeFingerprint, 'anyone can work the code fingerprint out again');
    let codeNow = s.starterCode; const lines = [await MG.codeOf('personal agent', MG.read), await MG.codeOf('company', MG.read)];
    for (let n = 0; n < 20 && codeNow.accepted.length < 2; n++) { await new Promise(r => setTimeout(r, 100)); codeNow = (await (await fetch(base + '/api/status')).json()).starterCode; }
    assert.deepStrictEqual(codeNow, { rule: 'note', accepted: lines }, 'the server lists the code lines of the two starters in its folder');
    const seen = await MG.inspect(base);
    assert.deepStrictEqual(seen.checks.map(c => c.good).slice(0, 6), [true, true, true, true, true, true], 'a local copy passes every check about itself');
    const disk = f => { const b = fs.readFileSync(path.join(__dirname, '..', f)); return MG.binaryFiles.test(f) ? new Uint8Array(b) : b.toString(); };
    assert.strictEqual(await MG.repoFingerprint(s.running.files.map(f => f.file), disk), s.running.repoFingerprint, 'anyone can work out the whole-repo fingerprint');
    assert.deepStrictEqual([seen.deploy, seen.audit], [null, null], 'a local copy was not deployed in public, and has no audit');
    assert(s.folderNow.files.every(f => f.state === 'same as loaded') && !s.running.files.some(f => f.file.startsWith('middleground/local-cert')), 'the whole folder is shown, except the closed folders');
    ok('server shows every file it runs, with no place that writes a file or calls another server, and one code fingerprint anyone can work out again');
    ok('an agent can inspect a middle ground by program: files, fingerprints, the stamped statement, the folder now, and the public repo');

    const before = fs.readdirSync(__dirname).sort().join(), { mine } = await threeSides(MG.link(base), 'B');
    ok('the same sides over the network: the same agent and company code reaches a middle ground server by its address');
    assert.deepStrictEqual(await MG.verify(mine.note), { good: true, maker: s.name, makerAt: base, code: mine.note.code }, 'MG.verify checks a token with its maker’s address and key id alone');
    assert.strictEqual((await MG.verify({ ...mine.note, outcome: 'Something else' })).good, false, 'a changed token is refused');
    assert.strictEqual((await MG.verify({ ...mine.note, makerAt: 'http://example.com' })).why, 'The token does not name an https address for its maker.');
    assert.strictEqual((await MG.verify({ ...mine.note, keyId: '0000000000000000' })).good, false, 'a key the maker does not have');
    const check = t => fetch(base + '/api/check', { method: 'POST', body: JSON.stringify(t) }).then(r => r.json());
    assert((await check({ token: mine.note, use: true })).good && /already used/.test((await check({ token: mine.note, use: true })).why), 'a token marked once is used once');
    ok('every token names its maker’s address and key id: MG.verify checks it with those alone, and the maker counts a single use');
    assert.strictEqual(fs.readdirSync(__dirname).sort().join(), before); assert.strictEqual((await fetch(base + '/server.js')).status, 404);
    ok('no new file appears in the folder');

    const plain = { 'x-forwarded-proto': 'http' }, refused = await fetch(base + '/api/join', { method: 'POST', body: '{"name":"x"}', headers: plain });
    assert(refused.status === 400 && (await refused.json()).error.includes('Not encrypted'));
    const moved = await fetch(base + '/', { headers: plain, redirect: 'manual' });
    assert(moved.status === 301 && moved.headers.get('location').startsWith('https://'));
    assert.strictEqual((await (await fetch(base + '/api/status', { headers: { 'x-forwarded-proto': 'https' } })).json()).connection, 'encrypted');
    ok('anything that arrives without encryption is refused');
  } finally { child.kill(); }
}

// A host changes its stamp key. Tokens stamped with the old key still check while the old open key is kept.
async function keyChange() {
  const port = 8796, base = 'http://localhost:' + port, S = MG.stamp, first = await S.newText(), second = await S.newText(), firstOpen = (await S.load(first)).open;
  const before = await MG.create({ key: first, address: base }).state({ kind: 'statement', says: 'Stamped before the change' });
  let child = await serverUp(port, { STAMP_KEY: second, OLD_KEYS: firstOpen });
  try {
    const r = await MG.verify(before);
    assert(r.good && r.oldKey, 'a token from before the change still checks, and says it was an older key');
    assert.strictEqual((await (await fetch(base + '/api/check', { method: 'POST', body: JSON.stringify({ token: before }) })).json()).good, true);
  } finally { child.kill(); }
  child = await serverUp(port, { STAMP_KEY: second, OLD_KEYS: '' });
  try { assert.strictEqual((await MG.verify(before)).good, false, 'once the old key is dropped (say it leaked), its tokens are refused'); } finally { child.kill(); }
  ok('a host can change its stamp key: old tokens keep checking while it keeps the old open key, and stop when it drops it');
}

// Deployed by the public workflow, with an audit token. A stand-in for GitHub's records and the auditor answers on one port.
async function deployAndAudit() {
  const port = 8793, base = 'http://localhost:' + port, side = 8794, other = 'http://localhost:' + side, http = require('http');
  require('../core/audit.js');
  const auditKey = await MG.stamp.newText(), auditOpen = (await MG.stamp.load(auditKey)).open, audit = await MG.audit({ key: auditKey, by: 'Sample audit', at: other, about: base, days: 90 });
  let version = '', title = '', shown = [];
  const stand = http.createServer((q, s) => { s.setHeader('content-type', 'application/json');
    if (q.url.startsWith('/api/key')) return s.end(JSON.stringify({ key: auditOpen, name: 'Sample audit' }));
    if (q.url.includes('/git/trees/')) return s.end(JSON.stringify({ tree: shown.map(p => ({ path: p, type: 'blob' })), truncated: false }));
    if (q.url.startsWith('/raw/')) { s.setHeader('content-type', 'application/octet-stream'); return s.end(fs.readFileSync(path.join(__dirname, '..', decodeURIComponent(q.url.slice(5))))); }
    if (q.url.includes('/workflows/deploy.yml/runs')) return s.end(JSON.stringify({ workflow_runs: [{ id: 42 }] }));
    if (q.url.endsWith('/actions/runs/42')) return s.end(JSON.stringify({ id: 42, head_sha: version, path: '.github/workflows/deploy.yml', conclusion: 'success', display_title: title, updated_at: '2026-11-20T10:00:00Z' }));
    s.statusCode = 404; s.end('{}'); });
  await new Promise(go => stand.listen(side, go));
  const env = run => ({ PUBLIC_URL: base, AUDIT_TOKEN: JSON.stringify(audit), DEPLOY_RUN: run });
  let child = await serverUp(port, env('set below'));
  try {
    const st = await (await fetch(base + '/api/status')).json(), o = st.running.origin;
    assert(o.repo && o.version, 'this check needs a git copy');
    version = o.version; shown = st.running.files.map(f => f.file);
    child.kill(); child = await serverUp(port, env(o.repo + '/actions/runs/42'));
    title = 'Deploy ' + version + ' to ' + base;
    const seen = await MG.inspect(base, { github: other, raw: other + '/raw' });
    assert(seen.good && seen.repoOnGitHub === seen.repoFingerprint, 'with the same repo, a public deploy and an audit, every check passes');
    shown = shown.concat('README.md');
    assert.notStrictEqual((await MG.inspect(base, { github: other, raw: other + '/raw' })).repoOnGitHub, seen.repoFingerprint, 'a file more or less gives another whole-repo fingerprint');
    shown = shown.slice(0, -1);
    assert(seen.deploy.run.endsWith('/actions/runs/42') && seen.audit.by === 'Sample audit');
    assert.strictEqual((await MG.inspect(base, { github: other, auditors: ['https://audit.example'] })).audit, null, 'an agent can accept only the auditors it names');
    title = 'Deploy ' + version + ' to https://somewhere.else';
    assert.strictEqual((await MG.inspect(base, { github: other })).deploy, null, 'a run that deployed to another address does not count');
    ok('a middle ground can show the public run that deployed it and a stamped audit, and an agent checks both by program');
    ok('one fingerprint for the whole repo: worked out the same way from GitHub and from the running copy, and any file changed, added or missing changes it');
  } finally { child.kill(); stand.close(); }
}

// With a certificate the server speaks https itself. Needs the test certificate in middleground/local-cert/ (see the README).
async function encrypted() {
  const cert = path.join(__dirname, 'local-cert', 'cert.pem'), key = path.join(__dirname, 'local-cert', 'key.pem');
  if (!fs.existsSync(cert)) return console.log('skip  https on its own certificate (no middleground/local-cert folder)');
  const port = 8797, https = require('https'), ca = fs.readFileSync(cert), child = await serverUp(port, { TLS_CERT: cert, TLS_KEY: key });
  const get = options => new Promise((done, fail) => https.get({ host: 'localhost', port, path: '/api/status', ...options }, r => { let t = ''; r.on('data', d => t += d); r.on('end', () => done(JSON.parse(t))); }).on('error', fail));
  try {
    assert.strictEqual((await get({ ca })).connection, 'encrypted');
    await assert.rejects(get({}), 'a client that cannot check the certificate must not connect');
    await assert.rejects(fetch('http://localhost:' + port + '/api/status'), 'plain http must not work on the https port');
    ok('with a certificate the server speaks https, the certificate is checked, and plain http does not work');
  } finally { child.kill(); }
}

(async () => {
  for (const t of [oneMeeting, tokensBack, fakes, roomsAndLimits, personToPerson, pools, shopping, shapes, broughtSheets, approvals, codeLine]) await t();
  await threeSides(MG.link(MG.create()), 'A'); ok('the sides in one program: a personal agent and a business reach a middle ground through a link, with the kits alone');
  for (const t of [server, keyChange, deployAndAudit, encrypted]) await t();
  console.log('\nAll ' + done + ' checks passed.');
})().catch(e => { console.error('FAILED: ' + (e.stack || e.message)); process.exit(1); });
