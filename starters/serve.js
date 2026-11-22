// A PLAIN PAGE SERVER, for running each side on its own: on its own port of one computer, or on its own machine.
// It only hands out the files in this repo. It is not a middle ground and has no /api.
//   node starters/serve.js 8788 personal-agent                 the personal agent's page, on port 8788
//   node starters/serve.js 8789 company                        the business agent's page, on port 8789
//   node starters/serve.js 8790 issuers                        the mock issuers page, on port 8790
// A third value names the middle ground the page should use, such as https://mg.example. Without it, each page finds
// the middle ground running on this computer (http://localhost:8787).
//   node starters/serve.js 8789 company https://mg.example
// ON ANOTHER MACHINE, serve the page over https: a browser lets a page sign and check only over https or on localhost.
// Set TLS_CERT and TLS_KEY to the certificate files, the same as for the middle ground.
// The business agent's server also says, on its own website, where this business meets: GET /.well-known/amp.json.
// A personal agent can read it to find the middle ground the business has chosen.
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PORT = Number(process.argv[2]) || 8788;
const SIDE = ['company', 'issuers'].includes(process.argv[3]) ? process.argv[3] : 'personal-agent';
const GROUND = (process.argv[4] || '').replace(/\/$/, '');
const PAGE = { 'personal-agent': ['personal-agent/meet.html', 'personal agent'], company: ['company/meet.html', 'business agent'], issuers: ['personal-agent/issuers.html', 'mock issuers'] }[SIDE];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const send = (res, code, type, body) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(body); };

const TLS = process.env.TLS_CERT && process.env.TLS_KEY ? { cert: fs.readFileSync(process.env.TLS_CERT), key: fs.readFileSync(process.env.TLS_KEY) } : null;
const answer = (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') { res.writeHead(302, { Location: '/starters/' + PAGE[0] + (GROUND ? '?mg=' + encodeURIComponent(GROUND) : '') }); return res.end(); }
  // WHERE THIS BUSINESS MEETS: the middle grounds it has chosen, named on its own website.
  if (url === '/.well-known/amp.json' && SIDE === 'company') return send(res, 200, TYPES['.json'], JSON.stringify({
    business: 'The sample businesses (starter code)', meetsAt: [{ name: 'The middle ground this business has chosen', address: GROUND || 'http://localhost:8787' }],
    ruleSheets: ['credit-offer', 'loyalty-discount', 'shop-offer', 'job-match', 'event-travel', 'pay-talks', 'brought'] }, null, 2));
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT + path.sep) || !TYPES[path.extname(file)] || !fs.existsSync(file) || file.includes(path.sep + '.git')) return send(res, 404, 'text/plain', 'Not found');
  send(res, 200, TYPES[path.extname(file)], fs.readFileSync(file));
};
(TLS ? https.createServer(TLS, answer) : http.createServer(answer)).listen(PORT, () => console.log('The ' + PAGE[1] + ' page: ' + (TLS ? 'https' : 'http') + '://localhost:' + PORT + (GROUND ? '   (middle ground: ' + GROUND + ')' : '   (middle ground: the one on this computer, http://localhost:8787)')));
