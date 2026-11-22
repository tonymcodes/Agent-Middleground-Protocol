// SAMPLE DATA for trying a meeting. One set for each rule sheet in middleground/rules.js, for each side, and one rule
// sheet a business brings ("brought").
// Each value comes with the name of the issuer that stamps it, so a sample shows how stamped proof works.
// Change a value on the page and it loses its stamp: the note will then say "not proven" or "their own figure".
// These are made-up people, companies and figures.
(function (root) {
  const MG = root.MG || (root.MG = {});
  MG.samples = {
    'credit-offer': {
      business: { name: 'Northbank',
        data: { offer: 'Personal loan up to ₹5,00,000 at 11.5% a year', fixedDays: '30', minIncome: '50000', maxShare: '40', licence: 'Lending licence NB-2291, valid to 31 Dec 2027' },
        stamps: { licence: 'Sample Central Bank' },
        issues: { type: 'offer letter', value: d => d.offer + '; terms fixed for ' + d.fixedDays + ' days', days: 30 } },
      person: { name: 'Asha',
        data: { salary: '62000, 64000, 63500', instalments: '9000', missed: '0' },
        stamps: { salary: 'Kestrel Labs payroll', instalments: 'Sample Credit Bureau', missed: 'Sample Credit Bureau' } },
    },
    'loyalty-discount': {
      business: { name: 'Leaf & Bean Coffee',
        data: { brand: 'Leaf & Bean coffee', times: '5', since: '2026-06-01', reward: '15% off your next 3 packs' },
        issues: { type: 'reward voucher', value: d => d.reward + ' (' + d.brand + ')', days: 90 } },
      person: { name: 'Asha',
        data: { bills: 'Leaf & Bean coffee, 2026-06-14, FreshMart\nLeaf & Bean coffee, 2026-07-09, FreshMart\nLeaf & Bean coffee, 2026-08-02, FreshMart\nTea leaves, 2026-08-02, FreshMart\nLeaf & Bean coffee, 2026-09-11, FreshMart\nLeaf & Bean coffee, 2026-10-05, FreshMart\nLeaf & Bean coffee, 2026-11-01, FreshMart', city: 'Bengaluru' },
        stamps: { bills: 'FreshMart' } },
    },
    'job-match': {
      business: { name: 'Kestrel Labs hiring',
        data: { role: 'Backend engineer, Bengaluru', skills: 'Node.js, SQL, cloud', minYears: '3', payRange: '₹18 – 22 lakh a year', maxPay: '2200000' },
        issues: { type: 'interview invitation', value: d => d.role + ', ' + d.payRange, days: 14 } },
      person: { name: 'Anjali',
        data: { skills: 'Node.js, SQL, cloud, React', years: '5', degree: 'B.Tech, Computer Science', expected: '2000000' },
        stamps: { skills: 'Sample talent pool', years: 'Arcus Systems (past employer)', degree: 'Sample University' } },
    },
    'event-travel': {
      business: { name: 'Bengaluru Traffic Police',
        data: { event: 'Cricket match, Chinnaswamy Stadium, 22 Nov, 7:30 pm', office: 'Bengaluru Traffic Police' } },
      person: { name: 'Ravi',
        data: { ticket: 'Chinnaswamy Stadium, 22 Nov, Stand B', pincode: '560034', mode: 'metro', setOut: '5 – 6 pm' },
        stamps: { ticket: 'Sample Ticket Office' } },
      // For "add sample people": person number n of a crowd, where they come from and how.
      crowd: n => ({ pincode: ['560034', '560011', '560102', '560100', '560066', '560037', '560038', '560024', '560064', '560010', '560078', '560076'][(n * 7) % 12], mode: ['car', 'two-wheeler', 'metro', 'metro', 'bus', 'cab or auto'][(n * 5) % 6], setOut: ['before 5 pm', '5 – 6 pm', '5 – 6 pm', '6 – 7 pm', 'after 7 pm'][(n * 3) % 5] }),
    },
    'used-goods': {
      seller: { name: 'Meera',
        data: { item: 'Road bike, Velora R2', asking: '32000', lowest: '28000', bill: 'Velora R2 road bike; 2025-03-10; ₹48000', warranty: '2027-03-10' },
        stamps: { bill: 'Pedal Point (the shop)', warranty: 'Velora Cycles' } },
      buyer: { name: 'Rohan',
        data: { wants: 'road bike', most: '30000', funds: '45000' },
        stamps: { funds: 'Northbank' } },
    },
    'shop-offer': {
      business: { name: 'Stride Sports',
        data: { offer: 'Trail running shoes, Stride X2', kind: 'running shoes, trainers', price: '6499', towns: 'Bengaluru, Mysuru, Kochi' } },
      person: { name: 'Asha',
        data: { wants: 'running shoes for trails', budget: '8000', town: 'Bengaluru' } },
    },
    'pay-talks': {
      business: { name: 'Open Pay Survey',
        data: { survey: 'Monthly pay for tech work, 2026', host: 'Open Pay Survey, a not-for-profit' } },
      person: { name: 'Priya',
        data: { role: 'Backend engineer', city: 'Bengaluru', pay: '88000' },
        stamps: { pay: 'Kestrel Labs payroll' } },
      // For "add sample people": person number n of a crowd, with their own employer-signed pay.
      crowd: n => ({ role: ['Backend engineer', 'Backend engineer', 'Frontend engineer', 'Data analyst', 'Designer'][n % 5], city: ['Bengaluru', 'Bengaluru', 'Mumbai', 'Chennai'][n % 4], pay: String(52000 + ((n * 7919) % 60) * 1000) }),
    },
    // A RULE SHEET THE BUSINESS BRINGS (core/sheet.js). Plain data: the middle ground runs it with no change of its own.
    'brought': {
      business: { name: 'Stride Gym',
        data: { offer: '3 months of membership at half price', minAge: '18', minSteps: '4000' } },
      person: { name: 'Asha',
        data: { age: '29', steps: '6500', city: 'Bengaluru' },
        stamps: { age: 'Sample identity office' } },
      sheet: {
        title: 'A gym membership offer',
        business: [
          { key: 'offer', label: 'The offer', type: 'text', public: true },
          { key: 'minAge', label: 'Youngest member', type: 'number' },
          { key: 'minSteps', label: 'Fewest steps walked a day', type: 'number' },
        ],
        person: [
          { key: 'age', label: 'Age', type: 'number', proof: 'signed by an identity office' },
          { key: 'steps', label: 'Steps walked a day', type: 'number' },
          { key: 'city', label: 'City', type: 'choice', options: ['Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Other'] },
        ],
        answers: {
          business: [
            { says: 'Old enough for membership', test: ['person.age', 'at least', 'business.minAge'] },
            { says: 'Walks enough each day', test: ['person.steps', 'at least', 'business.minSteps'] },
            { says: 'Lives in a city with a Stride Gym', test: ['person.city', 'is one of', ['Bengaluru', 'Mumbai']] },
          ],
          person: [
            { says: 'You qualify for the membership', all: true },
          ],
        },
        outcome: { person: 'Your offer: 3 months of membership at half price. Show this token at the desk.', business: 'A new member who meets every check. No age, step count or city was shared.' },
      },
    },
  };

  // THE SAMPLE REGISTRY. FOR TRYING THINGS OUT ONLY.
  // A registry checks an issuer once and signs a key note for it (see core/paper.js), like a certificate company signs a
  // website's certificate. A real registry keeps its secret key to itself. This sample one has its secret key right here, in
  // public, so anyone running the sample can play the registry and give their own sample issuers a key note.
  // It is the same idea as the test certificates developers use on their own computers: never trust it for anything real.
  // A real middle ground removes "Sample Business Registry" from its list in middleground/known.js.
  MG.sampleRegistry = {
    name: 'Sample Business Registry',
    open: '1zOVFJqB086cV13g1XYmOM+BmpgGJSmcOBWCn7du66w=',
    secretText: 'MC4CAQAwBQYDK2VwBCIEIKF22gI7OPKkLN6CyWwT0MKJaOJqf2vPhVWqLuUZO8Ae',   // public on purpose: test only
  };
  // A SAMPLE ISSUER, for trying things out: its key is made once and kept by keyStore ({ get, set }), and the sample registry
  // (MG.sampleRegistry above, test only) signs its key note. withNote: false gives an issuer whose key no registry confirmed.
  MG.sampleIssuer = async function (name, keyStore, withNote) {
    const slot = 'issuer:' + name;
    let t = keyStore && keyStore.get(slot);
    if (!t) { t = await MG.stamp.newText(); if (keyStore) keyStore.set(slot, t); }
    const key = await MG.stamp.load(t);
    let keyNote;
    if (withNote !== false && MG.sampleRegistry) {
      const reg = await MG.stamp.load(MG.sampleRegistry.secretText);
      keyNote = await MG.paper.keyNote({ name: MG.sampleRegistry.name, secret: reg.secret }, { name, open: key.open, web: 'https://' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.example' });
    }
    const me = MG.issuer(name, key, { keyNote });
    // The meeting samples use one paper for one value of a rule sheet's field.
    me.forField = (field, value, heldBy, days) => me.paper(field, { field, value: String(value) }, heldBy, days);
    return me;
  };
  if (typeof module !== 'undefined') module.exports = MG;
})(typeof window !== 'undefined' ? window : globalThis);
