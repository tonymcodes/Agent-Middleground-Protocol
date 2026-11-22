// Used by .github/workflows/deploy.yml. Prints the deploy settings for App Engine from the workflow's own values:
// where the code came from, the public run that is deploying it, the address, the audit token and the stamp keys.
// The output goes to deploy-env.yaml, which is never committed and never shown.
const e = process.env, q = v => JSON.stringify(v || '');
const repo = 'https://github.com/' + (e.GITHUB_REPOSITORY || '');
console.log('env_variables:\n' + [
  ['SOURCE_REPO', repo], ['SOURCE_VERSION', e.GITHUB_SHA], ['DEPLOY_RUN', repo + '/actions/runs/' + (e.GITHUB_RUN_ID || '')],
  ['PUBLIC_URL', e.PUBLIC_URL], ['STAMP_KEY', e.STAMP_KEY], ['AUDIT_TOKEN', e.AUDIT_TOKEN], ['OLD_KEYS', e.OLD_KEYS],
].map(([k, v]) => '  ' + k + ': ' + q(v)).join('\n'));
