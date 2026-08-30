# Perbaikan Opsi Model DSH (Qwen 3.8 Flash + Token Qwen/Kimi)

Dibuat: 2026-08-30 · oleh agent DeepSeek Harness

## Ringkasan Diagnosis (hasil uji LANGSUNG terhadap endpoint asli)

| Provider | Model | Endpoint | Hasil Uji |
|---|---|---|---|
| qwen-token-plan | qwen3.8-max | token-plan.ap-southeast-1.maas.aliyuncs.com | ❌ HTTP 401 `invalid_api_key` — **key ditolak Alibaba** |
| qwen-token-plan | qwen3.8-flash | (sama) | ❌ HTTP 401 `invalid_api_key` (key tidak valid) |
| qwen-payg | qwen3.7-flash | dashscope-intl.aliyuncs.com | ❌ HTTP 401 `invalid_api_key` — **key ditolak DashScope** |
| qwen-payg | qwen3.8-flash | (sama) | ❌ HTTP 401 `invalid_api_key` (key tidak valid) |
| kimi (pi-proxy) | kimi-k3 | 127.0.0.1:3080/connectors/api/pi-proxy/kimi | ✅ HTTP 200 `provider_used: kimi_k3` — **BERFUNGSI** |
| kimi-direct | kimi-k3 | api.moonshot.ai | ✅ HTTP 200 — **BERFUNGSI** |
| openrouter | stealth/ox-alpha | openrouter.ai | ⚠️ HTTP 404 — key VALID, tapi model **discontinued** (diganti GLM-5.3 Flash) |

### Akar masalah
1. **Token Qwen tidak bekerja** karena API key yang tersimpan di `~/.dsh/.credentials.yaml`
   (`QWEN_TOKEN_PLAN_API_KEY` & `QWEN_PAYG_API_KEY`) **ditolak oleh Alibaba** (401 invalid_api_key —
   kedaluwarsa/direvoke/salah). Bukan masalah kode, murni kredensial.
2. **Kimi sebenarnya bekerja** — baik lewat pi-proxy (pakai key gateway) maupun langsung Moonshot.
3. **OpenRouter** key-nya valid, hanya model `stealth/ox-alpha` yang sudah tidak ada (404 → pakai `z-ai/glm-5.3-flash`).

## Status (2026-08-30 03:25)
- ✅ **Qwen 3.8 Flash SUDAH ditambahkan** ke opsi model (qwen-token-plan & qwen-payg) di `~/.dsh/settings.yaml`
- ✅ OpenRouter diperbaiki: `stealth/ox-alpha` → `z-ai/glm-5.3-flash`
- ✅ Backup: `~/.dsh/settings.yaml.bak-20260830-032535`
- ⏳ **BELUM**: token Qwen baru (user akan pasang sendiri) + restart DSH web

## Yang Perlu Dilakukan

### 1. Ganti token Qwen (WAJIB — hanya bisa dari sisi user)
Buat API key baru di Alibaba:
- **Token Plan**: https://token-plan.ap-southeast-1.maas.aliyuncs.com (console Alibaba Cloud Model Studio)
- **PayG/DashScope**: https://dashscope-intl.aliyuncs.com (Dashboard → API-Keys)

Lalu perbarui `~/.dsh/.credentials.yaml`:
```yaml
refs:
  QWEN_TOKEN_PLAN_API_KEY: "sk-...KEY-BARU..."
  QWEN_PAYG_API_KEY: "sk-...KEY-BARU..."
```
(atau lewat GUI: Settings → 模型 → edit provider → tempel key baru → Save)

### 2. Tambahkan Qwen 3.8 Flash ke opsi model
File `settings.patch.yaml` berisi blok yang harus ditambahkan ke
`~/.dsh/settings.yaml` bagian `llm-pi-ai.providers` (lihat file patch & jalankan `apply-patch.sh`).

Catatan: id model API bisa jadi `qwen3.8-flash` (setelah GA) atau `qwen3.8-flash-next`
(open-weights preview 2026-08-26). Jika 404 "model not found", coba id alternatif tsb.

### 3. Perbaiki OpenRouter (opsional tapi disarankan)
Ganti `stealth/ox-alpha` → `z-ai/glm-5.3-flash` (lihat patch).

## Cara Terapkan
1. `bash dsh-model-options-fix/apply-patch.sh` (membackup + menambahkan qwen3.8-flash + fix openrouter)
2. Restart DSH web: `~/dsh/restart-web.sh` (atau biarkan hot-reload)
3. Set key qwen baru (langkah 1) lalu coba model di GUI.
