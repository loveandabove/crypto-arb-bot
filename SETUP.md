# Mac mini kurulumu

Bot Mac mini'de 7/24 çalışır; sonuçlara aynı Wi-Fi'daki her cihazdan bakılır.

## 1. Node kurulu mu?

Terminal'de:

```bash
node --version
```

Sürüm çıkmıyorsa: https://nodejs.org adresinden "LTS" sürümünü indir ve kur (ya da `brew install node`).

## 2. Kur (tek satır)

Terminal'e şunu yaz, Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/loveandabove/crypto-arb-bot/main/scripts/bootstrap.sh | bash
```

Kodu indirir, servisi kurar, sonunda bakılacak adresi yazar (örn. `http://Gadis-Mac-mini.local:5230`). Mac mini'nin kendisinde `http://localhost:5230`.

## Mac mini uyumasın

Sistem Ayarları → Enerji → "Ekran kapalıyken bilgisayarın otomatik uyumasını engelle" açık olsun. Ekran kapanabilir, bilgisayar uyumasın.

## Güncelleme

Aynı tek satırı tekrar çalıştır; veriler korunur.

## Durdurma

```bash
bash ~/Projects/crypto-arb-bot/scripts/uninstall-service.sh
```

Veriler (`data/`) silinmez.
