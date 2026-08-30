#!/bin/bash
# apply-patch.sh — tambahkan Qwen 3.8 Flash ke opsi model DSH + fix OpenRouter
# Jalankan: bash apply-patch.sh   (membutuhkan izin tulis ke ~/.dsh)
set -euo pipefail
SETTINGS="$HOME/.dsh/settings.yaml"
BAK="$SETTINGS.bak-$(date +%Y%m%d-%H%M%S)"
cp "$SETTINGS" "$BAK"
echo "Backup: $BAK"

python3 - "$SETTINGS" <<'PYEOF'
import sys, re
path = sys.argv[1]
txt = open(path).read()

# 1) qwen-token-plan: tambah qwen3.8-flash setelah qwen3.8-max
anchor1 = """        - id: qwen3.8-max
          name: Qwen 3.8 Max (Token Plan)"""
add1 = anchor1 + """
        - id: qwen3.8-flash
          name: Qwen 3.8 Flash (Token Plan)"""
if 'qwen3.8-flash' not in txt.split('qwen-token-plan')[1].split('qwen-payg')[0] if 'qwen-token-plan' in txt else False:
    pass
if anchor1 in txt and 'Qwen 3.8 Flash (Token Plan)' not in txt:
    txt = txt.replace(anchor1, add1, 1)
    print("+ qwen3.8-flash -> qwen-token-plan")

# 2) qwen-payg: tambah qwen3.8-flash setelah qwen3.7-flash
anchor2 = """        - id: qwen3.7-flash
          name: Qwen 3.7 Flash (Pay as You Go)"""
add2 = anchor2 + """
        - id: qwen3.8-flash
          name: Qwen 3.8 Flash (Pay as You Go)"""
if anchor2 in txt and 'Qwen 3.8 Flash (Pay as You Go)' not in txt:
    txt = txt.replace(anchor2, add2, 1)
    print("+ qwen3.8-flash -> qwen-payg")

# 3) openrouter: ganti model discontinued
old3 = "stealth/ox-alpha"
if old3 in txt:
    txt = txt.replace("stealth/ox-alpha", "z-ai/glm-5.3-flash", 1)
    txt = txt.replace("name: OX Alpha", "name: GLM 5.3 Flash (OpenRouter)", 1)
    print("+ openrouter: stealth/ox-alpha -> z-ai/glm-5.3-flash")

open(path, 'w').write(txt)
print("Selesai. Periksa: grep -n 'qwen3.8-flash' $HOME/.dsh/settings.yaml")
PYEOF

grep -n "qwen3.8-flash|glm-5.3-flash" "$SETTINGS" || echo "(tidak ada perubahan)"
echo
echo "Langkah berikutnya:"
echo "  1. Ganti token Qwen baru di ~/.dsh/.credentials.yaml (lihat README.md)"
echo "  2. Restart DSH web: ~/.dsh/restart-web.sh"
