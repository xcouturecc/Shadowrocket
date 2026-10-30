import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(SCRIPT_DIR, '..', 'Rules');
const SOURCE_ORIGIN = 'https://ruleset.skk.moe';
const SENTINEL_DOMAIN = '7h15.ru1353t.1s.m4d3.by.5ukk4w.skk.moe';

const DOMAIN_RULE_TYPES = new Set([
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'DOMAIN-WILDCARD',
  'USER-AGENT'
]);

const IP_RULE_TYPES = new Set([
  'IP-CIDR',
  'IP-CIDR6',
  'IP-ASN'
]);

const SOURCES = [
  // Plain DOMAIN-SET sources.
  ['List/domainset/apple_cdn.conf', 'apple_cdn_domainset.list', 'domainset', 'AGPL-3.0'],
  ['List/domainset/cdn.conf', 'cdn_domainset.list', 'domainset', 'AGPL-3.0'],
  ['List/domainset/download.conf', 'download_domainset.list', 'domainset', 'AGPL-3.0'],
  ['List/domainset/speedtest.conf', 'speedtest_domainset.list', 'domainset', 'AGPL-3.0'],

  // Domain and non-IP rules supported by Shadowrocket on iOS.
  ['List/non_ip/ai.conf', 'ai_non_ip.list', 'domain', 'AGPL-3.0'],
  ['List/non_ip/apple_intelligence.conf', 'apple_intelligence_non_ip.list', 'domain', 'AGPL-3.0'],
  ['List/non_ip/cdn.conf', 'cdn_non_ip.list', 'domain', 'AGPL-3.0'],
  ['List/non_ip/stream.conf', 'stream_non_ip.list', 'domain', 'AGPL-3.0'],
  ['List/non_ip/telegram.conf', 'telegram_non_ip.list', 'domain', 'AGPL-3.0'],
  ['List/non_ip/apple_cn.conf', 'apple_cn_non_ip.list', 'domain', 'AGPL-3.0'],
  ['List/non_ip/apple_services.conf', 'apple_services_non_ip.list', 'domain', 'AGPL-3.0'],
  // Sukka keeps Apple's 17/8 no-resolve rule in the same source file.
  ['List/non_ip/apple_services.conf', 'apple_services_ip.list', 'ip', 'AGPL-3.0'],
  ['List/non_ip/microsoft_cdn.conf', 'microsoft_cdn_non_ip.list', 'domain', 'AGPL-3.0'],
  ['List/non_ip/microsoft.conf', 'microsoft_non_ip.list', 'domain', 'AGPL-3.0'],
  ['List/non_ip/neteasemusic.conf', 'neteasemusic_non_ip.list', 'domain', 'AGPL-3.0'],
  ['List/non_ip/download.conf', 'download_non_ip.list', 'domain', 'AGPL-3.0'],
  ['List/non_ip/lan.conf', 'lan_non_ip.list', 'domain', 'AGPL-3.0'],
  ['List/non_ip/domestic.conf', 'domestic_non_ip.list', 'domain', 'AGPL-3.0'],
  ['List/non_ip/direct.conf', 'direct_non_ip.list', 'domain', 'AGPL-3.0'],
  ['List/non_ip/global.conf', 'global_non_ip.list', 'domain', 'AGPL-3.0'],

  // IP rules. DOMAIN sentinels and unsupported syntax are removed.
  ['List/ip/ai.conf', 'ai_ip.list', 'ip', 'AGPL-3.0'],
  ['List/ip/stream.conf', 'stream_ip.list', 'ip', 'AGPL-3.0'],
  ['List/ip/telegram.conf', 'telegram_ip.list', 'ip', 'AGPL-3.0'],
  ['List/ip/neteasemusic.conf', 'neteasemusic_ip.list', 'ip', 'AGPL-3.0'],
  ['List/ip/lan.conf', 'lan_ip.list', 'ip', 'AGPL-3.0'],
  ['List/ip/domestic.conf', 'domestic_ip.list', 'ip', 'AGPL-3.0'],
  ['List/ip/china_ip.conf', 'china_ip.list', 'ip', 'CC-BY-SA-2.0'],
  ['List/ip/china_ip_ipv6.conf', 'china_ip_ipv6.list', 'ip', 'CC-BY-SA-2.0']
];

function convert(sourceText, mode) {
  const kept = [];
  const droppedTypes = new Map();

  for (const rawLine of sourceText.replaceAll('\r\n', '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.includes(SENTINEL_DOMAIN)) continue;

    if (mode === 'domainset') {
      if (!line.includes(',')) kept.push(line);
      else droppedTypes.set('INVALID-DOMAIN-SET', (droppedTypes.get('INVALID-DOMAIN-SET') ?? 0) + 1);
      continue;
    }

    const type = line.split(',', 1)[0];
    const allowed = mode === 'domain' ? DOMAIN_RULE_TYPES : IP_RULE_TYPES;
    if (allowed.has(type)) kept.push(line);
    else droppedTypes.set(type, (droppedTypes.get(type) ?? 0) + 1);
  }

  if (kept.length === 0) throw new Error(`Conversion produced no rules for mode ${mode}`);
  return { kept, droppedTypes };
}

async function updateOne([sourcePath, outputName, mode, license]) {
  const sourceUrl = `${SOURCE_ORIGIN}/${sourcePath}`;
  const response = await fetch(sourceUrl, {
    headers: { 'user-agent': 'xcouturecc-Shadowrocket-converter/1.0' },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`${sourceUrl}: HTTP ${response.status}`);

  const sourceText = await response.text();
  const { kept, droppedTypes } = convert(sourceText, mode);
  const lastUpdated = sourceText.match(/^# Last Updated:\s*(.+)$/m)?.[1] ?? 'unknown';
  const contentHash = sourceText.match(/^# \$content-hash-v1\$:(.+)$/m)?.[1] ?? 'unknown';
  const dropped = [...droppedTypes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `${type}=${count}`)
    .join(', ') || 'none';

  const header = [
    '# AUTO-GENERATED FILE. DO NOT EDIT.',
    '# Converted for Shadowrocket from Sukka Ruleset.',
    `# Source: ${sourceUrl}`,
    `# Source Last Updated: ${lastUpdated}`,
    `# Source Content Hash: ${contentHash}`,
    `# License: ${license}`,
    `# Conversion Mode: ${mode}`,
    `# Unsupported or inapplicable entries removed: ${dropped}`,
    `# Rule Count: ${kept.length}`,
    ''
  ].join('\n');

  await writeFile(resolve(OUTPUT_DIR, outputName), `${header}${kept.join('\n')}\n`, 'utf8');
  return `${outputName}: ${kept.length} rules; dropped ${dropped}`;
}

await mkdir(OUTPUT_DIR, { recursive: true });
const results = [];
for (const source of SOURCES) results.push(await updateOne(source));
console.log(results.join('\n'));
await import('./update-clash-rules.mjs');
