/**
 * Encrypts and sets REPLIERS_API_KEY as a GitHub Actions secret
 * using the repo's public key and tweetsodium
 */
import { execSync } from 'child_process';
import https from 'https';

const GH_TOKEN     = process.env.GH_TOKEN;
const REPLIERS_KEY = process.env.REPLIERS_KEY;
const REPO         = 'killergrowth/sundgren-realty';

// Get repo public key
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'KillerGrowth-BJ',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      }
    }, res => {
      let out = '';
      res.on('data', d => out += d);
      res.on('end', () => resolve({ status: res.statusCode, body: out ? JSON.parse(out) : {} }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const pubKeyRes = await request('GET', `/repos/${REPO}/actions/secrets/public-key`);
const { key, key_id } = pubKeyRes.body;
console.log('Got pub key, key_id:', key_id);

// Encrypt using tweetsodium
const sodium = (await import('tweetsodium')).default;
const messageBytes = Buffer.from(REPLIERS_KEY);
const keyBytes     = Buffer.from(key, 'base64');
const encrypted    = sodium.seal(messageBytes, keyBytes);
const encryptedB64 = Buffer.from(encrypted).toString('base64');

// PUT the secret
const putRes = await request('PUT', `/repos/${REPO}/actions/secrets/REPLIERS_API_KEY`, {
  encrypted_value: encryptedB64,
  key_id,
});
console.log('Secret set, status:', putRes.status); // 201 created or 204 updated
