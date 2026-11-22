// HOST: who runs this copy, and the one message they may show. Edit this file when you host your own.
(function (root) {
  const MG = root.MG;
  MG.host = {
    name: 'Sample host',
    // true: any company or office may join with its own stamp key (fine for a sample).
    // false: only the issuers listed in known.js are accepted.
    openJoin: true,
    // The starter code of visitors (see core/code.js). "note": serve every authenticated visitor and count who states approved code.
    // "only": refuse a request that does not state an approved code line.
    starterCode: 'note',
    // MEETINGS. How many times one business and one person may meet over the same rule sheet in a day.
    // A low limit stops either side rebuilding the other's data from many small looks.
    looksPerPair: 3,
    // THE PERSON'S APPROVAL. Data leaves a personal agent only after the person approves it (core/swipe.js).
    // false: a real fingerprint, or the sample's ticked box standing in for one (fine for a sample).
    // true: only a real fingerprint swipe on the person's device.
    realFingerprintOnly: false,
    // RULE SHEETS A BUSINESS BRINGS (core/sheet.js). true: a business may open a room with a rule sheet of its own, as plain
    // data, checked against the limits in core/sheet.js, so new use cases need no change here. false: built-in sheets only.
    broughtSheets: true,
    // Code lines of other public starters this host accepts, beside the two starters in this folder.
    alsoAccepted: [],
    // HOW THIS HOST EARNS. The ways open to a host, none of which needs a profile of anyone (see the README):
    //   a tiny fee for each request, billed to the person's agent provider from the counts on the page,
    //   a share when a deal made here succeeds, as a payment gateway takes,
    //   nothing: hosted free, to show the host's own cloud or to offer its users something extra.
    earns: ['hosted free to show the host’s cloud'],
    why: 'Hosted free, to show what this host’s cloud can do',
    // One short, labelled message. It is part of the public code, so everyone can see exactly what is shown.
    message: { from: 'Sample host', text: 'Simple cloud servers from ₹300 a month.' },
  };
})(typeof window !== 'undefined' ? window : globalThis);
