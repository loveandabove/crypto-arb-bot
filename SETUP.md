# Mac mini kurulumu

Bot Mac mini'de 7/24 çalışır; sonuçlara aynı Wi-Fi'daki her cihazdan bakılır.

## 1. Node kurulu mu?

Terminal'de:

```bash
node --version
```

Sürüm çıkmıyorsa: https://nodejs.org adresinden "LTS" sürümünü indir ve kur (ya da `brew install node`).

## 2. Kodu indir

```bash
git clone https://github.com/loveandabove/crypto-arb-bot.git ~/Projects/crypto-arb-bot
```

## 3. Servisi kur

```bash
bash ~/Projects/crypto-arb-bot/scripts/install-service.sh
```

Çıktıdaki adresi (örn. `http://Gadis-Mac-mini.local:5230`) telefon/laptop tarayıcısına yaz. Mac mini'nin kendisinde `http://localhost:5230`.

## Mac mini uyumasın

Sistem Ayarları → Enerji → "Ekran kapalıyken bilgisayarın otomatik uyumasını engelle" açık olsun. Ekran kapanabilir, bilgisayar uyumasın.

## Güncelleme

```bash
cd ~/Projects/crypto-arb-bot && git pull && bash scripts/install-service.sh
```

## Durdurma

```bash
bash ~/Projects/crypto-arb-bot/scripts/uninstall-service.sh
```

Veriler (`data/`) silinmez.
