// KNOWN ISSUERS. The companies and offices whose stamps this middle ground accepts, with each one's open stamp key.
// It works like the list of certificate authorities inside a web browser: short, public, and the same for everyone.
// The list is part of the public code, so anyone can see who is on it and when it changed.
//   - A name on this list can join only with the key written here.
//   - If host.js says openJoin is false, a stamp from anyone not on this list is refused.
// This sample ships with an empty list and open joining, so the examples can run. A real host fills the list in.
(function (root) {
  const MG = root.MG;
  MG.known = {
    // 'State identity office': { web: 'https://identity.example', key: 'the office’s open stamp key' },
  };
  // REGISTRIES. A registry checks an issuer once and signs a key note for it (see core/paper.js). A paper whose issuer has a
  // key note from a registry on this list counts as stamped proof here. This is the middle ground's list of certificate
  // companies, in the https sense: short, public, and changed only by changing this file.
  MG.registries = {
    // TEST ONLY: its secret key is public in starters/samples.js, so anyone can play it. Remove it on a real host.
    'Sample Business Registry': { web: 'https://registry.example', key: '1zOVFJqB086cV13g1XYmOM+BmpgGJSmcOBWCn7du66w=', testOnly: true },
  };
})(typeof window !== 'undefined' ? window : globalThis);
