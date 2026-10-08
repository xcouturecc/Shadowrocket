from pathlib import Path
import urllib.request

url = "https://raw.githubusercontent.com/SukkaLab/ruleset.skk.moe/master/Modules/sukka_mitm_hostnames.sgmodule"
with urllib.request.urlopen(url, timeout=30) as response:
    module = response.read().decode()
assert "[MITM]" in module and "hostname = %APPEND%" in module
assert len(module) > 100
path = Path("Surge/Modules/sukka_mitm_hostnames.sgmodule")
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(module)
