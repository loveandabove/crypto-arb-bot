# Crypto Arb Bot

Gadi ile Türkçe konuş; kod, commit mesajı ve dosya adları İngilizce.

- **Sadece sanal (paper) mod var.** Gerçek emir gönderen kod yazılmaz; Gadi açıkça isterse önce tasarım konuşulur, API anahtarını Gadi girer (sadece al-sat yetkisi, para çekme yok), anahtar `.env`'de durur, asla koda/loga/commit'e girmez.
- Mac mini'de launchd servisi olarak çalışır: `bash scripts/install-service.sh`. Kod değişince: `git pull` + aynı script (servisi yeniden başlatır). Log: `data/server.log`.
- `data/` git dışında; bakiye ve işlem geçmişi orada. Silme.
- Bu bilgisayarda geliştirme/önizleme: `.claude/launch.json` → `crypto-arb-bot` (port 5230). Servis kuruluysa önce `bash scripts/uninstall-service.sh`, yoksa port çakışır.
- Commit: `feat(arb-bot): ...` / `fix(arb-bot): ...`.
