# Surge 配置

`Surge-Universal-Split-DNS.conf` 是面向中国大陆常见网络环境整理的 Surge 通用配置，适用于 Surge for iOS 和 macOS。规则直接引用 [SukkaW/Surge](https://github.com/SukkaW/Surge) 上游地址，不复制规则内容，因此上游规则更新后无需手工维护本地规则副本。

## 导入

主配置：

```text
https://raw.githubusercontent.com/coutureone/Shadowrocket/master/Surge/Surge-Universal-Split-DNS.conf
```

APNs Direct 模块（可选）：

```text
https://raw.githubusercontent.com/coutureone/Shadowrocket/master/Modules/sukka_apns_direct.sgmodule
```

主配置已经显式将 Apple Push Notification Service 设为 `DIRECT`，同时使用 Surge 内置 `SYSTEM` 规则集，因此**只使用这份主配置时不需要额外启用 APNs 模块**。该模块保留给其他未包含这些规则的 Surge 配置使用。

## 策略结构

默认行为：

- Apple Push Notification Service：`DIRECT`
- Surge 系统流量：`DIRECT`
- macOS：额外启用 SukkaW 原生广告 / 隐私 Reject 规则
- iOS：自动忽略大型广告规则，保持移动端轻量与兼容性
- Common CDN：`PROXY`（与 `global.conf` 使用相同策略）
- Apple 中国大陆 CDN：`DIRECT`
- Apple / Microsoft / 网易云 / 局域网 / 中国大陆常见服务：`DIRECT`
- AI：`AI` 策略组，默认继承 `PROXY`
- Telegram：`Telegram` 策略组，默认继承 `PROXY`
- Streaming：`Streaming` 策略组，默认继承 `PROXY`
- 其他海外常用服务：`PROXY`
- 中国大陆 IPv4 / IPv6：`DIRECT`
- 未匹配流量：`FINAL,PROXY,dns-failed`

配置不包含节点。请把自建节点或订阅节点加入 `[Proxy]`，并加入 `PROXY` 策略组。若以后希望 AI、Telegram 或 Streaming 使用不同落地节点，可直接把对应节点加入相应策略组，无需修改规则区。

## macOS 广告过滤

SukkaW 上游明确更推荐将大型广告 / 隐私 / Malware 规则用于 Surge for Mac，而移动平台更适合使用专门的内容过滤工具。因此这份配置使用 Surge 的行级 Requirement，让同一份 Profile 在不同平台自动采用不同策略：

```ini
#!REQUIREMENT SYSTEM=='macOS' DOMAIN-SET,https://ruleset.skk.moe/List/domainset/reject.conf,REJECT,extended-matching
#!REQUIREMENT SYSTEM=='macOS' DOMAIN-SET,https://ruleset.skk.moe/List/domainset/reject_extra.conf,REJECT
#!REQUIREMENT SYSTEM=='macOS' RULE-SET,https://ruleset.skk.moe/List/non_ip/reject-drop.conf,REJECT-DROP,pre-matching
#!REQUIREMENT SYSTEM=='macOS' RULE-SET,https://ruleset.skk.moe/List/non_ip/reject.conf,REJECT,extended-matching
#!REQUIREMENT SYSTEM=='macOS' RULE-SET,https://ruleset.skk.moe/List/non_ip/reject-no-drop.conf,REJECT-NO-DROP,extended-matching
#!REQUIREMENT SYSTEM=='macOS' RULE-SET,https://ruleset.skk.moe/List/ip/reject.conf,REJECT-DROP
```

效果：

- Surge for Mac：自动启用基础广告规则、Extra 补充规则及 IP 补充规则。
- Surge for iOS：上述行自动忽略，不加载大型广告库。
- 不启用 `reject_phishing`，避免扩大误拦截范围；如果未来确有需求再手动开启。
- 不启用 `sukka_enhance_adblock`、`MITM Hostnames`、`URL-REGEX` 等 HTTPS 解密 / Rewrite 方案，优先保证银行、支付、AI、流媒体和常用 App 的兼容性。

`#!REQUIREMENT` 建议配合远程 / 托管 Profile 使用。Surge 官方说明通过 UI 修改 Profile 时 Requirement 表达式可能丢失，因此不要在 Surge 图形界面里把这份远程配置另存后长期手工改动；需要修改时直接改仓库文件再更新 Profile。

## DNS 与 IPv6

默认使用：

```ini
dns-server = 223.5.5.5, 119.29.29.29
encrypted-dns-server = https://dns.alidns.com/dns-query, https://doh.pub/dns-query
hijack-dns = *:53
```

配置启用 IPv6，并加载 SukkaW 的 `china_ip_ipv6`。如果实际网络环境不具备稳定 IPv6，可按设备网络环境自行关闭 `ipv6`，并同时删除或注释 `china_ip_ipv6` 规则。

## 规则顺序

本配置严格遵循以下结构：

```text
自定义域名 / SYSTEM
→ DOMAIN-SET（macOS AdBlock / Speedtest / Common CDN / Apple CDN）
→ non_ip（macOS AdBlock / Common CDN / Streaming / AI / Telegram）
→ non_ip 国内与直连
→ global
→ IP（macOS AdBlock / 精准服务）
→ LAN / domestic / china_ip
→ FINAL
```

这是为了保证所有域名类规则都在 IP 类规则之前完成匹配，尽量避免为本应直接代理的域名提前触发本地 DNS 解析。

## Common CDN 与 Download

按照 SukkaW 上游 README 的建议，本配置加载 Common CDN 的 `domainset` 与 `non_ip` 两组规则，并与 `global.conf` 一样使用 `PROXY`。这样即使没有独立 CDN 节点，也能覆盖一部分 `global.conf` 未包含的静态资源与对象存储域名，同时继续由上游维护规则内容。

Download 规则暂不加载。它更适合存在独立下载节点、低倍率节点或专门下载策略的配置；以后如果有这类策略，再按 SukkaW 上游顺序加入即可。

## QUIC / UDP

`block-quic = per-policy` 使用 Surge 官方默认行为，由具体策略决定是否阻断 QUIC，不再对所有代理全局强制回退 TCP。

`udp-policy-not-supported-behaviour = REJECT` 用于保证命中的代理策略不支持 UDP Relay 时直接拒绝，而不是意外直连。

## APNs

主配置中以下规则固定为直连：

```ini
DOMAIN-SUFFIX,push.apple.com,DIRECT
DOMAIN-SUFFIX,push-apple.com.akadns.net,DIRECT
RULE-SET,SYSTEM,DIRECT
```

因此 APNs 行为与 `Modules/sukka_apns_direct.sgmodule` 保持一致，不再存在“主配置代理优先、模块直连”的冲突。
