import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const profiles = [
  'Shadowrocket/Shadowrocket-Universal-Split-DNS.conf',
  'Shadowrocket/Clash/Shadowrocket-Universal-Split-DNS.yaml'
];
// Keep this in the category order published in SukkaW/Surge README.
const expectedProviders = [
  'speedtest_domainset,PROXY', 'cdn_domainset,PROXY', 'cdn_non_ip,PROXY',
  'stream_non_ip,PROXY', 'ai_non_ip,PROXY', 'apple_intelligence_non_ip,PROXY',
  'telegram_non_ip,PROXY', 'apple_cdn_domainset,DIRECT',
  'apple_services_non_ip,DIRECT', 'apple_cn_non_ip,DIRECT',
  'microsoft_cdn_non_ip,DIRECT', 'microsoft_non_ip,DIRECT',
  'neteasemusic_non_ip,DIRECT', 'download_domainset,PROXY',
  'download_non_ip,PROXY', 'lan_non_ip,DIRECT', 'domestic_non_ip,DIRECT',
  'direct_non_ip,DIRECT', 'global_non_ip,PROXY', 'stream_ip,PROXY',
  'ai_ip,PROXY', 'telegram_ip,PROXY', 'apple_services_ip,DIRECT',
  'neteasemusic_ip,DIRECT', 'lan_ip,DIRECT', 'domestic_ip,DIRECT',
  'china_ip,DIRECT', 'china_ip_ipv6,DIRECT'
];

function ruleKind(rule) {
  const [type, target] = rule.split(',');
  if (type === 'RULE-SET') {
    const name = target.split('/').at(-1).replace(/\.list$/, '');
    return /_ip(?:_ipv6)?$/.test(name) && !name.endsWith('_non_ip') ? 'ip' : 'domain';
  }
  if (type === 'DOMAIN-SET' || type.startsWith('DOMAIN')) return 'domain';
  if (type.startsWith('IP-') || type === 'GEOIP') return 'ip';
  if (type === 'FINAL' || type === 'MATCH') return 'final';
  throw new Error(`Unknown rule type: ${rule}`);
}

function ruleLines(content, isClash) {
  if (isClash) {
    const rules = content.split(/^rules:\s*$/m)[1];
    if (!rules) throw new Error('Missing Clash rules section');
    return rules.split('\n').map((line) => line.trim())
      .filter((line) => line.startsWith('- ')).map((line) => line.slice(2));
  }
  const rules = content.split(/^\[Rule\]\s*$/m)[1]?.split(/^\[/m)[0];
  if (!rules) throw new Error('Missing Shadowrocket [Rule] section');
  return rules.split('\n').map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function providerRules(rules) {
  return rules.filter((rule) => /^(?:RULE-SET|DOMAIN-SET),/.test(rule))
    .map((rule) => {
      const [, target, policy] = rule.split(',');
      const name = target.split('/').at(-1).replace(/\.list$/, '');
      return `${name},${policy}`;
    });
}

const providerOrder = new Map();
for (const profile of profiles) {
  const isClash = profile.endsWith('.yaml');
  const content = await readFile(resolve(root, profile), 'utf8');
  const ruleUrls = [...content.matchAll(/https:\/\/raw\.githubusercontent\.com\/[^\s,]+/g)]
    .map(([url]) => url);
  for (const url of ruleUrls) {
    if (!url.startsWith('https://raw.githubusercontent.com/xcouturecc/Shadowrocket/master/Shadowrocket/')) {
      throw new Error(`${profile}: rule URL points outside the maintained repository: ${url}`);
    }
  }
  const rules = ruleLines(content, isClash);
  providerOrder.set(profile, providerRules(rules));
  let seenIp = false;
  for (const [index, rule] of rules.entries()) {
    const kind = ruleKind(rule);
    if (kind === 'domain' && seenIp) {
      throw new Error(`${profile}: domain rule after IP rule at ${index + 1}: ${rule}`);
    }
    if (kind === 'ip') seenIp = true;
    if (kind === 'final' && index !== rules.length - 1) {
      throw new Error(`${profile}: final rule is not last: ${rule}`);
    }
    if (!isClash && (rule.startsWith('RULE-SET,') || rule.startsWith('DOMAIN-SET,'))) {
      const filename = rule.split(',')[1].split('/').at(-1);
      await access(resolve(root, 'Shadowrocket/Rules', filename));
    }
  }
  console.log(`${profile}: ${rules.length} ordered rules`);
}

const reference = providerOrder.get(profiles[0]);
if (JSON.stringify(reference) !== JSON.stringify(expectedProviders)) {
  throw new Error(`${profiles[0]}: provider order or policy differs from Sukka README categories`);
}
for (const profile of profiles.slice(1)) {
  const actual = providerOrder.get(profile);
  if (JSON.stringify(actual) !== JSON.stringify(reference)) {
    throw new Error(`${profile}: provider order or policy differs from ${profiles[0]}`);
  }
}
console.log(`${reference.length} rule providers have matching priority and policy across profiles`);

const clash = await readFile(resolve(root, profiles[1]), 'utf8');
const dns = clash.split(/^dns:\s*$/m)[1]?.split(/^proxies:\s*$/m)[0];
const bootstrap = dns?.match(/^  default-nameserver:\s*\[([^\]]+)\]/m)?.[1]
  .split(',').map((server) => server.trim());
if (!bootstrap?.length || bootstrap.some((server) => !server.startsWith('https://'))) {
  throw new Error('Clash DNS bootstrap must use encrypted DNS IP endpoints');
}
if (!/^  respect-rules: true$/m.test(dns)
  || !/^  nameserver: .*#PROXY/m.test(dns)
  || !/^  proxy-server-nameserver:/m.test(dns)
  || /^  fallback:/m.test(dns)) {
  throw new Error('Clash DNS routing or fallback no longer matches the split-DNS design');
}
const providerSection = clash.split(/^rule-providers:\s*$/m)[1]?.split(/^rules:\s*$/m)[0];
if (!providerSection) throw new Error('Missing Clash rule providers');
const providers = new Map();
let current;
for (const line of providerSection.split('\n')) {
  const name = line.match(/^  ([a-z0-9_]+):\s*$/)?.[1];
  if (name) {
    current = { name };
    providers.set(name, current);
  } else if (current) {
    const field = line.match(/^    (behavior|format|path):\s*(\S+)/);
    if (field) current[field[1]] = field[2];
  }
}
for (const provider of providers.values()) {
  if (!['domain', 'classical', 'ipcidr'].includes(provider.behavior)) {
    throw new Error(`${provider.name}: invalid behavior`);
  }
  if (!['yaml', 'mrs'].includes(provider.format) || !provider.path?.endsWith(`.${provider.format}`)) {
    throw new Error(`${provider.name}: format/path mismatch`);
  }
  await access(resolve(root, 'Shadowrocket/Clash', provider.path));
}
for (const rule of ruleLines(clash, true)) {
  if (rule.startsWith('RULE-SET,')) {
    const [, name, , option] = rule.split(',');
    if (!providers.has(name)) throw new Error(`Unknown Clash provider: ${name}`);
    if (ruleKind(rule) === 'ip') {
      const source = await readFile(resolve(root, 'Shadowrocket/Rules', `${name}.list`), 'utf8');
      // MRS conversion intentionally excludes IP-ASN; only CIDRs reach this provider.
      const entries = source.split(/\r?\n/).filter((line) => /^IP-CIDR6?,/.test(line));
      const noResolveCount = entries.filter((line) => line.endsWith(',no-resolve')).length;
      if (noResolveCount > 0 && noResolveCount < entries.length) {
        throw new Error(`${name}: mixed no-resolve IP rules need separate providers`);
      }
      if ((noResolveCount === entries.length) !== (option === 'no-resolve')) {
        throw new Error(`${name}: Clash no-resolve differs from the Sukka source`);
      }
    }
  }
}
console.log(`${providers.size} Clash rule providers available`);
