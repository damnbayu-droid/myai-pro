# Permintaan Perubahan MyAI OS Gateway — Dukung Provider Asli untuk Claude & Kimi pada Request Bertools

Kepada: Admin / Developer MyAI OS Gateway (console.myai.nexus)
Dari: Pengguna MyAI Code (editor DeepSeek Harness)
Tanggal: 24 Agu 2026
Prioritas: Tinggi — memblokir penggunaan Claude & Kimi di editor agent mode

## Ringkasan Masalah

Gateway saat ini **memaksa provider GPT** untuk semua request yang membawa parameter `tools` (mode agent/editor), dan **menolak** field yang tidak memiliki tier GPT. Akibatnya:

1. Field `reasoning_general` (tier1 = Claude) yang dipanggil dengan `tools` → **diproses oleh GPT**, bukan Claude. Claude tidak pernah benar-benar dipakai di mode agent.
2. Field `kimi` (tier1 = Moonshot Kimi K3) yang dipanggil dengan `tools` → **HTTP 422 ditolak**, karena field ini tidak punya tier GPT.
3. Editor (DeepSeek Harness) selalu berjalan sebagai agent dan selalu mengirim `tools`, sehingga **Claude dan Kimi praktis tidak bisa dipakai** dari editor — hanya DeepSeek dan GPT yang berfungsi.

## Bukti (hasil uji langsung, 24 Agu 2026)

Kunci: `MYAI_OS_GATEWAY_KEY_TIER1` (tier 1). Endpoint: `/api/v1/chat/completions`.

| Field | Request | Hasil |
|---|---|---|
| `reasoning_general` | tanpa `tools` | HTTP 200, `provider_used: "claude"` ✅ |
| `reasoning_general` | dengan `tools` | HTTP 200, `provider_used: "gpt"` ⚠️ (Claude diganti GPT) |
| `kimi` | tanpa `tools` | HTTP 200, `provider_used: "kimi_k3"` ✅ |
| `kimi` | dengan `tools` | HTTP 422: `Field 'kimi' has no 'gpt' tier configured, but this request includes 'tools'. Add a gpt tier to this field's pool assignments in the dashboard, or omit 'tools'.` ❌ |

Pesan error lain yang muncul di editor:
`No active, in-scope key found for model 'claude-sonnet-4-5'. Check GET /api/v1/models for currently available options, and confirm this key's provider_scope grants access (tools mode requires gpt).`

## Perubahan yang Diminta

Agar Claude dan Kimi bisa memakai **provider asli mereka sendiri** (bukan default GPT) pada request bertools, mohon:

1. **Jangan paksa ganti provider ke GPT** saat request membawa `tools`. Biarkan field memakai tier-1 provider aslinya (Claude untuk `reasoning_general`, Kimi untuk `kimi`), selama provider tersebut mendukung tool/function calling.
   - Claude mendukung function calling (native Anthropic tools).
   - Moonshot Kimi K3 mendukung function calling (OpenAI-compatible tools).

2. **Hapus syarat "field wajib punya tier GPT untuk request bertools"** atau ubah menjadi fallback opsional:
   - Prioritas 1: provider tier-1 field yang mendukung tools (mis. Claude / Kimi).
   - Fallback (opsional): jika tier-1 tidak tersedia/busy, baru turun ke GPT.

3. **Perbaiki pengecekan `provider_scope`** agar kunci tier-1 tidak menolak model Claude/Kimi pada mode tools — kunci tersebut memang dimaksudkan untuk mengakses seluruh pool field gateway.

4. **Sinkronkan `GET /api/v1/models`** dengan perilaku di atas: cantumkan informasi tier tools-capable per field, supaya klien (editor) bisa menampilkan opsi model yang realistis dan tidak menampilkan model yang akan ditolak.

## Hasil yang Diharapkan

- `reasoning_general` + `tools` → `provider_used: "claude"`
- `kimi` + `tools` → `provider_used: "kimi_k3"`
- Editor MyAI Code dapat memakai Claude & Kimi sebagai opsi model agent, dengan provider asli masing-masing.

## Konteks Tambahan

- Field `reasoning_general` memang dirancang tier-1 = Claude (sesuai `GET /api/v1/models`).
- Field `kimi` tier-1 = Moonshot Kimi K3 (sesuai `GET /api/v1/models`).
- Perilaku ini mengikuti siklus review tier internal gateway (update tiap ±12 jam); mohon pertimbangkan perubahan ini pada siklus berikutnya, atau beri tahu jika perlu koordinasi waktu rilis.

Terima kasih.
