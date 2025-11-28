// dns-test.mjs
import dns from 'node:dns/promises';

const host = 'db.pcqjkfcbjgebeejvugyt.supabase.co';

console.log('Testing DNS lookup for:', JSON.stringify(host));

try {
  const all = await dns.lookup(host, { all: true });
  console.log('dns.lookup all ->', all);
} catch (err) {
  console.error('dns.lookup error ->', err);
}
