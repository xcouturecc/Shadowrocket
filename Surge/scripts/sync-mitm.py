from pathlib import Path
import re
import urllib.request

url = "https://raw.githubusercontent.com/SukkaLab/ruleset.skk.moe/master/Modules/sukka_mitm_hostnames.sgmodule"
with urllib.request.urlopen(url, timeout=30) as response:
    module = response.read().decode()
hostname = next(line for line in module.splitlines() if line.startswith("hostname ="))
hostname = hostname.replace("%APPEND% ", "")
assert len(hostname) > 100 and "%" not in hostname
profile = Path("Surge/Surge-Universal-Split-DNS.conf")
content = profile.read_text()
content, count = re.subn(r"(# BEGIN SUKKA MITM HOSTNAMES\n).*?(\n# END SUKKA MITM HOSTNAMES)", lambda match: match[1] + hostname + match[2], content, flags=re.S)
assert count == 1
profile.write_text(content)
