# Shadowrocket 通用分流配置

> 此目录是 Fork 仓库维护者添加的 Shadowrocket 配置，不属于 Sukka Ruleset 官方支持范围。

## 导入地址

```text
https://raw.githubusercontent.com/xcouturecc/Shadowrocket/master/Shadowrocket/Shadowrocket-Universal-Split-DNS.conf
```

## 使用方法

1. 先在 Shadowrocket 首页添加自建节点，或导入并更新节点订阅（Hysteria2、Trojan 等均可）。
2. 进入“配置”，点击右上角 `+`，粘贴上面的 Raw 地址并下载。
3. 选中下载的配置文件，将首页“全局路由”设为“配置”。
4. 在 Shadowrocket 首页手动选择一个节点。所有需要代理的国外、AI、流媒体及 Telegram 流量都会使用当前节点；配置不会自动选择或切换节点。

国内规则集和中国大陆 IPv4 / IPv6 地址使用直连策略；按上游顺序更早命中 CDN 等代理规则的域名仍会走代理。Shadowrocket 已启用 IPv6，但双栈域名仍优先 IPv4；IPv6-only 目标按相同规则分流。国外和未知流量统一使用小火箭内置的 `PROXY`，也就是首页当前手选的节点，无论来自自建还是订阅。配置没有 `Auto` 和地区策略组，不会后台更换出口。

两份配置的服务规则只引用自动转换的 Sukka 规则，按[上游 README](https://github.com/SukkaW/Surge#规则组列表)的分类顺序排列：测速、通用 CDN、流媒体、AI、Telegram、Apple、Microsoft、网易云、下载、局域网、国内、直连、全球；所有域名规则均位于 IP 规则之前。策略由本仓库选择：国内、Apple 和 Microsoft 专项规则设为直连，国外专项规则和未知流量使用当前 `PROXY` 节点；先命中的规则优先。

APNs 不再有单独的测试配置或自定义网段规则，按上游 `apple_services_non_ip` 中的 Apple 域名与 `apple_services_ip` 中的 `17.0.0.0/8,no-resolve` 处理。上游规则并非针对每个 iOS 系统连接提供到达保证。

## DNS 设计

- 国内直连域名使用阿里 / 腾讯 DoH，失败时不改用代理 DNS。
- 需要本地解析的代理域名通过当前节点使用 Cloudflare / Google DoH；代理连接也可能由远端节点解析域名。
- DNS 失败不会回退到 iOS 系统 DNS。
- 节点域名在隧道建立前通过直连的国内 DoH 加密解析。
- 节点不支持 UDP 时拒绝该 UDP 流量，不静默改成直连。
- Shadowrocket 已启用 IPv6，国内 IPv6 地址列表按 `DIRECT` 处理；公网 IPv6 不排除在 TUN 外。节点域名在支持 IPv6 的网络上也可能通过 IPv6 连接。

## 验证

- 使用 <https://dnsleaktest.com> 的 Extended Test 辅助检查 DNS；同时以客户端日志核对实际 DNS 出口。
- 使用 <https://ip.sb> 检查国外访问的出口 IP。
- 查看 Shadowrocket 日志：国内请求通常命中 `DIRECT`，国外请求通常命中 `Proxy`。
- 在双栈网络和 IPv6-only 网络上分别检查日志：国内 IPv6 地址应命中 `china_ip_ipv6` 或 `GEOIP,CN` 并走 `DIRECT`，国外 IPv6 地址应走 `PROXY`；再检查实际出口 IP。自建与订阅节点都需要验证能否转发目标 IPv6 流量；节点接入地址本身不必是 IPv6。

DNS 分流只约束客户端接管的流量；节点线路、应用自带 DoH/VPN、iCloud Private Relay、IPv6 和节点协议能力仍会影响实际出口。

## 与上游同步

仓库中的 `.github/workflows/sync-upstream.yml` 每天北京时间 11:17 自动拉取并合并 `SukkaW/Surge` 的 `master` 分支，也支持在 GitHub Actions 页面手动运行。

`.github/workflows/update-shadowrocket-rules.yml` 每天北京时间 11:47 从 Sukka 官方 Ruleset Server 获取构建结果，通过 `Shadowrocket/scripts/update-rules.mjs` 转换后写入 `Shadowrocket/Rules/`。主配置只引用本仓库中的这些转换结果，不再依赖第三方 Shadowrocket 规则仓库。

转换器保留 Shadowrocket 支持的域名、USER-AGENT、IPv4/IPv6 CIDR 和 ASN 规则，自动删除 Surge/iOS 不适用或需要 MITM 的 `PROCESS-NAME`、`URL-REGEX` 等内容。当前主配置引用中国 IPv4 / IPv6 地址列表；其余 CDN、下载和网易云均同时覆盖域名/non-IP/IP补充规则。广告、Map Local、全局 MITM 和其他 Surge 专属模块不会转换。

每日更新还会校验 Shadowrocket 与 Clash 配置的域名/IP 规则顺序、与上游 README 对应的规则源优先级和策略是否一致，以及引用的规则文件是否存在。Clash 版本另将可编译的域名集、IP 列表制作成 MRS；无法编译的 `IP-ASN` 和不适用的 `USER-AGENT` 不导入 Clash。

## AI 地区问题检查

更新配置后，在首页手动选择一条受 Gemini / ChatGPT 支持的节点（建议先测试美国），断开并重新连接，再完全退出并重新打开 App。最近请求中的 Gemini/ChatGPT 主域名、登录和 API 请求都应命中 `PROXY`。如果仍提示地区不支持，应更换另一条节点；节点名称是“美国”不代表 Google/OpenAI 对该出口 IP 的定位和风控结果一定是美国。

自定义文件仅放在 `Shadowrocket/` 目录，正常情况下不会干扰上游更新。如果未来上游创建同名文件并产生合并冲突，工作流会失败并保留现状，不会强制覆盖仓库内容。
