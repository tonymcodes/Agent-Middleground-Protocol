// RULE SHEETS. Each kind of meeting has one public rule sheet. It says:
//   - what each side brings (its fields),
//   - which of those fields are public (they may appear in the notes) and which stay private,
//   - which notes the middle ground may write for each side, each in a fixed shape:
//       yes-no   "yes", "no" or "not proven" (not proven: the field was not signed by its issuer)
//       band     one of a fixed list of ranges
//       count    a whole number
//       choice   one of a fixed list of words
//   - the look: the small calculation that reads both sides' data and fills in the notes.
// These are the built-in sheets, one for each example in the paper. A business can also bring a sheet of its own, as
// plain data, to any middle ground, with no change to the middle ground (core/sheet.js).
// The middle ground refuses any answer that does not fit its shape, so a rule sheet cannot pass a raw value across.
// A band or a choice may also be "not proven", when the value it comes from is not backed by a trusted certificate token.
// Anyone can read every rule sheet here, and every note names the fingerprint of the rule sheet that wrote it.
//
// Sides: a sheet names its two sides in sides (default: business and person) and who each is in who (business or person).
// Two people can meet too: the used-goods sheet has a seller and a buyer, both personal agents.
// look(S) gets every side's fields, as S.business, S.person, S.seller and so on.
// Each side's field arrives as { value, stamped, by }: the value as text, whether a certificate token from its issuer
// backs it exactly, and who stamped it.
//
// Two kinds of room:
//   pair   one person and one business. Each gets a note about what its witness saw of the other side.
//   pool   one business or office and many people. Each person gets a note; the office gets counts only.
//
// A pool room's look also gets kept: the rounded figures the room holds for each group (pay talks); it may return keep.
// To add a built-in sheet: copy one below and run the tests. To try a new use case with no change to the middle ground,
// bring a rule sheet instead (core/sheet.js).
(function (root) {
  const MG = root.MG || (root.MG = {});
  const num = v => Number(String(v == null ? '' : v).replace(/[₹,\s]/g, '')) || 0;
  const nums = v => String(v == null ? '' : v).split(/[;,]\s*(?=\d)|\s*\n\s*/).map(num).filter(n => n > 0);
  const words = v => String(v == null ? '' : v).split(/[,;\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const lines = v => String(v == null ? '' : v).split('\n').map(s => s.trim()).filter(Boolean);
  const yes = ok => ok ? 'yes' : 'no';
  const proof = (f, ok) => !f || !f.stamped ? 'not proven' : yes(ok);
  const rs = n => '₹' + Math.round(n).toLocaleString('en-IN');
  const bandOf = (n, edges, names) => { for (let i = 0; i < edges.length; i++) if (n < edges[i]) return names[i]; return names[names.length - 1]; };

  MG.rules = {
    // ---------- 1. Finance ----------
    'credit-offer': {
      title: 'A credit offer without handing over statements',
      field: 'Finance', kind: 'pair',
      ownSwipe: true,   // a loan: the person approves it with a swipe of its own, never as part of a list
      business: [
        { key: 'offer', label: 'The offer', type: 'text', public: true },
        { key: 'fixedDays', label: 'Days the terms stay fixed', type: 'number', public: true },
        { key: 'minIncome', label: 'Lowest monthly income for this offer (₹)', type: 'number' },
        { key: 'maxShare', label: 'Most of the income existing instalments may take (%)', type: 'number' },
        { key: 'licence', label: 'Lending licence', type: 'text', public: true, proof: 'signed by the central bank' },
      ],
      person: [
        { key: 'salary', label: 'Salary credits, last 3 months (₹)', type: 'numbers', proof: 'signed by the employer' },
        { key: 'instalments', label: 'Loan instalments paid each month (₹)', type: 'number', proof: 'signed by a credit bureau' },
        { key: 'missed', label: 'Missed payments in the last 12 months', type: 'number', proof: 'signed by a credit bureau' },
      ],
      notes: {
        business: [
          { key: 'incomeAbove', says: () => 'Income above your minimum in each of the last 3 months', shape: 'yes-no' },
          { key: 'incomeBand', says: () => 'Average monthly income', shape: { band: ['below ₹25,000', '₹25,000 – 50,000', '₹50,000 – 1,00,000', '₹1,00,000 – 2,00,000', 'above ₹2,00,000'] } },
          { key: 'instalmentsWithin', says: () => 'Existing instalments within your limit', shape: 'yes-no' },
          { key: 'noMissed', says: () => 'No missed payments in the last 12 months', shape: 'yes-no' },
        ],
        person: [
          { key: 'licensed', says: () => 'The lender holds a lending licence', shape: 'yes-no' },
          { key: 'qualify', says: () => 'You qualify for this offer', shape: 'yes-no' },
          { key: 'fixed', says: pub => 'The terms stay fixed for ' + num(pub.fixedDays) + ' days', shape: 'yes-no' },
        ],
      },
      look({ person: P, business: B }) {
        const s = nums(P.salary.value).slice(-3), avg = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0, min = num(B.minIncome.value);
        const above = s.length === 3 && s.every(x => x > min), within = num(P.instalments.value) <= avg * num(B.maxShare.value) / 100, clean = num(P.missed.value) === 0;
        const ok = above && within && clean && P.salary.stamped && P.instalments.stamped && P.missed.stamped;
        return {
          business: { incomeAbove: proof(P.salary, above), incomeBand: P.salary.stamped ? bandOf(avg, [25000, 50000, 100000, 200000], this.notes.business[1].shape.band) : 'not proven', instalmentsWithin: proof(P.instalments, within), noMissed: proof(P.missed, clean) },
          person: { licensed: proof(B.licence, !!B.licence.value), qualify: yes(ok), fixed: yes(num(B.fixedDays.value) > 0) },
          outcome: {
            person: ok ? 'Offer for you: ' + B.offer.value : 'This offer does not fit this time. Nothing about you was kept.',
            business: ok ? 'Eligible. The person decides whether to go ahead; no name or number is shared until they accept.' : 'Not eligible for this offer.',
          },
        };
      },
    },

    // ---------- 2. Shopping ----------
    'loyalty-discount': {
      title: 'A loyalty discount proven by bills',
      field: 'Shopping', kind: 'pair',
      business: [
        { key: 'brand', label: 'Brand', type: 'text', public: true },
        { key: 'times', label: 'Purchases needed', type: 'number', public: true },
        { key: 'since', label: 'Counting from (date)', type: 'text', public: true },
        { key: 'reward', label: 'The reward', type: 'text', public: true },
      ],
      person: [
        { key: 'bills', label: 'Bills: one line each, "brand, date, shop"', type: 'lines', proof: 'signed by the shops' },
        { key: 'city', label: 'City', type: 'choice', options: ['Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Other'] },
      ],
      notes: {
        business: [
          { key: 'loyal', says: pub => 'Bought ' + pub.brand + ' at least ' + num(pub.times) + ' times since ' + pub.since, shape: 'yes-no' },
          { key: 'howOften', says: pub => 'Times ' + pub.brand + ' was bought since ' + pub.since, shape: { band: ['none', '1 – 2', '3 – 5', '6 – 10', 'more than 10'] } },
          { key: 'city', says: () => 'City', shape: { choice: ['Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Other'] } },
        ],
        person: [
          { key: 'qualify', says: pub => 'You qualify for: ' + pub.reward, shape: 'yes-no' },
        ],
      },
      look({ person: P, business: B }) {
        const brand = String(B.brand.value).trim().toLowerCase(), since = String(B.since.value).trim();
        const n = lines(P.bills.value).map(l => l.split(',').map(s => s.trim())).filter(([b, d]) => (b || '').toLowerCase() === brand && (d || '') >= since).length;
        const ok = n >= num(B.times.value);
        const city = this.notes.business[2].shape.choice.includes(P.city.value) ? P.city.value : 'Other';
        return {
          business: { loyal: proof(P.bills, ok), howOften: P.bills.stamped ? bandOf(n, [1, 3, 6, 11], this.notes.business[1].shape.band) : 'not proven', city },
          person: { qualify: yes(ok && P.bills.stamped) },
          outcome: {
            person: ok && P.bills.stamped ? 'Your reward: ' + B.reward.value + '. Show this note at checkout.' : 'Not yet. Nothing about you was kept.',
            business: ok && P.bills.stamped ? 'A loyal buyer, proven by verified bills. Their agent holds the reward.' : 'Not a match this time.',
          },
        };
      },
    },

    // A shop's offer, without spam. The shop opens a room with one offer; a person's agent brings what they are looking for,
    // a budget and a town. The person learns whether the offer fits, and gets it only if it does. The shop learns whether
    // this was a buyer for it, a budget band and a town, never a name. One offer, matched on this one request.
    'shop-offer': {
      title: 'An offer from a shop, without spam',
      field: 'Shop offer', kind: 'pair',
      openedBy: ['business'],
      business: [
        { key: 'offer', label: 'The offer', type: 'text', public: true },
        { key: 'kind', label: 'What it is (words a buyer may use, comma separated)', type: 'text', public: true },
        { key: 'price', label: 'Price (₹)', type: 'number', public: true },
        { key: 'towns', label: 'Towns it delivers to (comma separated)', type: 'text' },
      ],
      person: [
        { key: 'wants', label: 'Looking for', type: 'text' },
        { key: 'budget', label: 'Most I will spend (₹)', type: 'number' },
        { key: 'town', label: 'Town', type: 'choice', options: ['Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Kochi', 'Other'] },
      ],
      notes: {
        person: [
          { key: 'fits', says: pub => 'It is what you are looking for: ' + pub.offer, shape: 'yes-no' },
          { key: 'budget', says: pub => 'Its price, ' + rs(num(pub.price)) + ', is within your budget', shape: 'yes-no' },
          { key: 'delivers', says: () => 'It delivers to your town', shape: 'yes-no' },
        ],
        business: [
          { key: 'wants', says: pub => 'Looking for: ' + pub.kind, shape: 'yes-no' },
          { key: 'budget', says: () => 'Budget, shared only when they are looking for it', shape: { band: ['below ₹2,000', '₹2,000 – 5,000', '₹5,000 – 10,000', 'above ₹10,000', 'not shared'] } },
          { key: 'town', says: () => 'Town, shared only when they are looking for it', shape: { choice: ['Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Kochi', 'Other', 'not shared'] } },
        ],
      },
      look({ person: P, business: B }) {
        const kinds = words(B.kind.value), wanted = words(P.wants.value).join(' ');
        const wants = kinds.some(k => wanted.includes(k)), within = num(B.price.value) <= num(P.budget.value);
        const delivers = words(B.towns.value).includes(String(P.town.value).trim().toLowerCase()), fits = wants && within && delivers;
        return {
          person: { fits: yes(wants), budget: yes(within), delivers: yes(delivers) },
          business: { wants: yes(wants), budget: wants ? bandOf(num(P.budget.value), [2000, 5000, 10000], ['below ₹2,000', '₹2,000 – 5,000', '₹5,000 – 10,000', 'above ₹10,000']) : 'not shared', town: wants ? P.town.value : 'not shared' },
          outcome: {
            person: fits ? 'One offer for you: ' + B.offer.value + ', ' + rs(num(B.price.value)) + '.' : 'This offer does not fit your request. Nothing about you was kept.',
            business: fits ? 'A buyer for this offer. Their agent holds the offer; no name or contact is shared.' : wants ? 'Looking for this, but the price or the town does not fit.' : 'Not looking for this. Nothing else is shared.',
          },
        };
      },
    },

    // ---------- 3. Recruitment ----------
    'job-match': {
      title: 'A role meets a candidate',
      field: 'Recruitment', kind: 'pair',
      business: [
        { key: 'role', label: 'The role', type: 'text', public: true },
        { key: 'skills', label: 'Skills needed (comma separated)', type: 'text', public: true },
        { key: 'minYears', label: 'Least years of experience', type: 'number', public: true },
        { key: 'payRange', label: 'Pay range, as shown to candidates', type: 'text', public: true },
        { key: 'maxPay', label: 'Most the company will pay a year (₹)', type: 'number' },
      ],
      person: [
        { key: 'skills', label: 'Skills (comma separated)', type: 'text', proof: 'scored by a talent-pool interviewer' },
        { key: 'years', label: 'Years of experience', type: 'number', proof: 'signed by past employers' },
        { key: 'degree', label: 'Degree', type: 'text', proof: 'signed by the university' },
        { key: 'expected', label: 'Pay you expect a year (₹)', type: 'number' },
      ],
      notes: {
        business: [
          { key: 'skillsAll', says: () => 'Has every skill you listed', shape: 'yes-no' },
          { key: 'years', says: () => 'Years of experience', shape: { band: ['under 2', '2 – 4', '5 – 8', 'more than 8'] } },
          { key: 'yearsEnough', says: pub => 'At least ' + num(pub.minYears) + ' years of experience', shape: 'yes-no' },
          { key: 'degree', says: () => 'Degree confirmed by the university', shape: 'yes-no' },
          { key: 'payFits', says: () => 'Pay expectation within your budget', shape: 'yes-no' },
        ],
        person: [
          { key: 'skillsMatch', says: pub => 'Your skills cover the role: ' + pub.role, shape: 'yes-no' },
          { key: 'payCovers', says: () => 'The pay covers what you expect', shape: 'yes-no' },
        ],
      },
      look({ person: P, business: B }) {
        const need = words(B.skills.value), have = words(P.skills.value), all = need.every(s => have.includes(s));
        const yrs = num(P.years.value), enough = yrs >= num(B.minYears.value), fits = num(P.expected.value) <= num(B.maxPay.value);
        const ok = all && enough && fits && P.skills.stamped && P.years.stamped;
        return {
          business: { skillsAll: proof(P.skills, all), years: P.years.stamped ? bandOf(yrs, [2, 5, 9], this.notes.business[1].shape.band) : 'not proven', yearsEnough: proof(P.years, enough), degree: proof(P.degree, !!P.degree.value), payFits: yes(fits) },
          person: { skillsMatch: yes(all), payCovers: yes(fits) },
          outcome: {
            person: ok ? 'Interview invitation: ' + B.role.value + ', ' + B.payRange.value + '. Accept it from your agent if you want to go ahead.' : 'Not a match this time. Nothing about you was kept.',
            business: ok ? 'A matched candidate. Their agent decides whether to accept the interview.' : 'Not a match.',
          },
        };
      },
    },

    // ---------- 4. City and citizens ----------
    'event-travel': {
      title: 'Planning traffic from the people coming to an event',
      field: 'City and citizens', kind: 'pool',
      openedBy: ['business'],
      business: [
        { key: 'event', label: 'The event', type: 'text', public: true },
        { key: 'office', label: 'The office asking', type: 'text', public: true },
      ],
      person: [
        { key: 'ticket', label: 'Ticket', type: 'text', proof: 'signed by the ticket office' },
        { key: 'pincode', label: 'Setting out from (pincode)', type: 'text' },
        { key: 'mode', label: 'Travelling by', type: 'choice', options: ['car', 'two-wheeler', 'metro', 'bus', 'cab or auto', 'walking'] },
        { key: 'setOut', label: 'Setting out', type: 'choice', options: ['before 5 pm', '5 – 6 pm', '6 – 7 pm', 'after 7 pm'] },
      ],
      notes: {
        person: [
          { key: 'counted', says: pub => 'Counted for the travel plan of: ' + pub.event, shape: 'yes-no' },
          { key: 'ticketChecked', says: () => 'Your ticket was checked, and not kept', shape: 'yes-no' },
        ],
        // The office's note holds counts only: one table for each of these, with small groups hidden.
        business: [
          { key: 'people', says: () => 'People counted', shape: 'count' },
        ],
      },
      poolShows: 'Each person’s ticket, area, way of travel and time', poolProof: 'tickets signed by the ticket office; the rest their own word',
      groups: {
        area: { label: 'Coming from', order: ['South', 'East', 'North', 'West', 'Other areas'], of: P => ({ '560034': 'South', '560011': 'South', '560102': 'South', '560100': 'South', '560066': 'East', '560037': 'East', '560038': 'East', '560024': 'North', '560064': 'North', '560010': 'West' })[String(P.pincode.value).trim()] || 'Other areas' },
        mode: { label: 'Travelling by', of: P => P.mode.value },
        setOut: { label: 'Setting out', of: P => P.setOut.value },
      },
      look({ person: P, business: B }) {
        const ok = P.ticket.stamped && String(P.ticket.value).length > 0;
        return { person: { counted: yes(ok), ticketChecked: proof(P.ticket, ok) }, count: ok, outcome: { person: ok ? 'Thank you. You were counted; your address and ticket were dropped.' : 'Not counted: the ticket was not signed by the ticket office.' } };
      },
    },

    // ---------- 5. Person to person ----------
    // Two personal agents meet: a seller and a buyer. The buyer's witness sees the seller's stamped bill and warranty;
    // the seller's witness sees that the buyer has the money. Neither price leaves the room, only whether they meet.
    'used-goods': {
      title: 'Used goods between two people',
      field: 'Person to person', kind: 'pair',
      ownSwipe: true,   // money changes hands: a swipe of its own
      sides: ['seller', 'buyer'], who: { seller: 'person', buyer: 'person' },
      seller: [
        { key: 'item', label: 'The item', type: 'text', public: true },
        { key: 'asking', label: 'Asking price (₹)', type: 'number', public: true },
        { key: 'lowest', label: 'Lowest price I will take (₹)', type: 'number' },
        { key: 'bill', label: 'Bill: item; date bought; price paid', type: 'text', proof: 'signed by the shop' },
        { key: 'warranty', label: 'Warranty valid until (date)', type: 'text', proof: 'signed by the maker' },
      ],
      buyer: [
        { key: 'wants', label: 'Looking for', type: 'text' },
        { key: 'most', label: 'Most I will pay (₹)', type: 'number' },
        { key: 'funds', label: 'Money available to spend (₹)', type: 'number', proof: 'signed by the bank' },
      ],
      notes: {
        buyer: [
          { key: 'owns', says: () => 'The seller owns it: the bill is signed by the shop', shape: 'yes-no' },
          { key: 'warranty', says: () => 'The warranty is still valid', shape: 'yes-no' },
          { key: 'age', says: () => 'Bought', shape: { band: ['less than 1 year ago', '1 – 2 years ago', '2 – 5 years ago', 'more than 5 years ago', 'not known'] } },
          { key: 'meets', says: () => 'Your price meets the seller’s lowest', shape: 'yes-no' },
        ],
        seller: [
          { key: 'funds', says: pub => 'The buyer has the money to pay your asking price of ' + rs(num(pub.asking)), shape: 'yes-no' },
          { key: 'meets', says: () => 'The buyer’s price meets your lowest', shape: 'yes-no' },
          { key: 'wants', says: pub => 'The buyer is looking for: ' + pub.item, shape: 'yes-no' },
        ],
      },
      look({ seller: S, buyer: B }) {
        const bought = new Date((String(S.bill.value).split(';')[1] || '').trim()), years = (Date.now() - bought.getTime()) / (365.25 * 86400000);
        const meets = num(B.most.value) >= num(S.lowest.value), item = String(S.item.value).toLowerCase();
        const wants = words(B.wants.value).length > 0 && words(B.wants.value).every(w => item.includes(w));
        const price = meets ? Math.min(num(S.asking.value), Math.round((num(B.most.value) + num(S.lowest.value)) / 2 / 500) * 500) : 0;
        const deal = meets ? 'A price you can both accept: ' + rs(price) + '. Each of you decides whether to go ahead.' : 'Your prices do not meet. Nothing about either of you was kept.';
        return {
          buyer: { owns: proof(S.bill, !!S.bill.value), warranty: proof(S.warranty, new Date(S.warranty.value).getTime() > Date.now()), age: !S.bill.stamped ? 'not proven' : isNaN(years) ? 'not known' : bandOf(years, [1, 2, 5], ['less than 1 year ago', '1 – 2 years ago', '2 – 5 years ago', 'more than 5 years ago']), meets: yes(meets) },
          seller: { funds: proof(B.funds, num(B.funds.value) >= num(S.asking.value)), meets: yes(meets), wants: yes(wants) },
          outcome: { buyer: deal, seller: deal },
        };
      },
    },

    // ---------- 6. Pay talks ----------
    // Give one verified figure, see the summary for your kind of work. A pool room: each person brings their pay, signed
    // by their employer, and at once gets back the lower quarter, middle and upper quarter for their group, once the group
    // has 5 people. The figure goes in rounded and the person is dropped; the survey host sees counts only.
    'pay-talks': {
      title: 'Pay talks: give one verified figure, see the summary for your kind of work',
      field: 'Pay talks', kind: 'pool',
      openedBy: ['business'],
      business: [
        { key: 'survey', label: 'The pay survey', type: 'text', public: true },
        { key: 'host', label: 'Run by', type: 'text', public: true },
      ],
      person: [
        { key: 'role', label: 'Kind of work', type: 'choice', options: ['Backend engineer', 'Frontend engineer', 'Data analyst', 'Designer', 'Other'] },
        { key: 'city', label: 'City', type: 'choice', options: ['Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Other'] },
        { key: 'pay', label: 'Monthly pay (₹)', type: 'number', proof: 'signed by the employer' },
      ],
      notes: {
        person: [
          { key: 'counted', says: () => 'Your figure was added, rounded to ₹1,000, and your details were dropped', shape: 'yes-no' },
          { key: 'people', says: () => 'People in your group so far (same kind of work and city)', shape: 'count' },
          { key: 'low', says: () => 'Lower quarter of monthly pay in your group (₹)', shape: 'count' },
          { key: 'middle', says: () => 'Middle monthly pay in your group (₹)', shape: 'count' },
          { key: 'high', says: () => 'Upper quarter of monthly pay in your group (₹)', shape: 'count' },
        ],
        business: [
          { key: 'people', says: () => 'People who gave a verified figure', shape: 'count' },
        ],
      },
      poolShows: 'Each person’s kind of work, city and monthly pay', poolProof: 'pay signed by the employer; the rest their own word',
      groups: {
        role: { label: 'Kind of work', of: P => P.role.value },
        city: { label: 'City', of: P => P.city.value },
      },
      // kept: the rounded figures this room holds so far, for each group. Only rounded figures are kept, never a person.
      look({ person: P }, kept) {
        const SHOW_FROM = 5, ok = P.pay.stamped && num(P.pay.value) > 0, group = P.role.value + ' · ' + P.city.value, mine = Math.round(num(P.pay.value) / 1000) * 1000;
        const list = [...((kept && kept[group]) || []), ...(ok ? [mine] : [])].sort((a, b) => a - b), enough = ok && list.length >= SHOW_FROM;
        const at = q => list[Math.floor(q * (list.length - 1))], hidden = 'too few to show';
        return {
          person: { counted: proof(P.pay, ok), people: ok ? list.length : 0, low: enough ? at(0.25) : hidden, middle: enough ? at(0.5) : hidden, high: enough ? at(0.75) : hidden },
          count: ok, keep: ok ? [group, mine] : null,
          outcome: { person: !ok ? 'Not added: the pay figure was not signed by the employer. Nothing was kept.' : enough ? 'Thank you. Your figure is in, and here is the summary for your group.' : 'Thank you. Your figure is in. The summary shows once your group has ' + SHOW_FROM + ' people.' },
        };
      },
    },
  };

  // The fingerprint of a rule sheet: its fields, notes and look, as written. Every note names it.
  MG.ruleFingerprint = async function (id) {
    const r = MG.rules[id], text = JSON.stringify({ id, kind: r.kind, sides: r.sides || null, fields: (r.sides || ['business', 'person']).map(s => r[s] || null) }) + String(r.look) + Object.values(r.groups || {}).map(g => String(g.of)).join('') + Object.values(r.notes).flat().map(n => n.key + String(n.says) + JSON.stringify(n.shape)).join('');
    return (await MG.fingerprint(text)).slice(0, 16);
  };
  // Does an answer fit its shape?
  MG.fitsShape = function (shape, a) {
    if (shape === 'yes-no') return ['yes', 'no', 'not proven'].includes(a);
    if (shape === 'count') return (Number.isInteger(a) && a >= 0) || a === 'too few to show';
    // A band or a choice worked out from a value that no trusted paper backs is "not proven" too.
    if (shape && shape.band) return shape.band.includes(a) || a === 'not proven';
    if (shape && shape.choice) return shape.choice.includes(a) || a === 'not proven';
    return false;
  };
  if (typeof module !== 'undefined') module.exports = MG;
})(typeof window !== 'undefined' ? window : globalThis);
