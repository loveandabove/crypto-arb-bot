# Crypto Arb Bot (sanal)

Kraken ve Binance.US üzerinde üçgen arbitraj fırsatlarını tarayan, **sahte parayla** işlem yapan bot.
Gerçek fiyat, sahte 1000 $. Hiçbir borsaya emir gönderilmez; hesap, anahtar, para gerekmez.

## Çalıştırma

```bash
npm start
```

Sonra tarayıcıda: http://localhost:5230

## Ne yapıyor?

1. Her iki borsanın bütün paritelerini çeker, "USD → A → B → USD" şeklinde kapanan bütün üçgenleri bulur.
2. Saniyede 4 kez her üçgeni canlı alış/satış fiyatıyla hesaplar:
   - **Komisyon öncesi** artıda mı? (fırsat var mı)
   - **Komisyon sonrası** artıda mı? (gerçekten para kazandırır mı)
3. Komisyon sonrası eşiği (`minNetProfitPct`) geçen üçgen bulursa sanal işlem yapar:
   üç emri sırayla "gönderir", her emir arasında `latencyMs` bekler ve o anki fiyattan dolar.
   Böylece gerçek bir botun yaşadığı "fırsatı gördüm ama emrim varana kadar fiyat kaçtı" durumu simüle edilir.
4. Bakiye, işlemler ve günlük istatistikler `data/` altında saklanır; yeniden başlatınca kaldığı yerden devam eder.

## Ayarlar (`config.json`)

| Alan | Anlamı |
|---|---|
| `startBalanceUsd` | Sanal başlangıç parası (her borsa için ayrı) |
| `maxTradeUsd` | Tek üçgende en fazla kaç dolar döner |
| `minNetProfitPct` | Komisyon sonrası en az yüzde kaç kâr görünce işlem yapar |
| `latencyMs` | Emir gecikmesi simülasyonu (ms) |
| `exchanges.*.takerFeePct` | Borsanın işlem başı komisyonu (%) — hesabın büyüyünce düşer, buradan güncelle |

Komisyon varsayılanları: Kraken Pro giriş seviyesi %0,40, Binance.US %0,10.

## Dosyalar

- `src/index.mjs` — başlatıcı
- `src/engine.mjs` — üçgen bulma, hesaplama, sanal işlem
- `src/exchanges/` — borsa bağlantıları (Kraken websocket, Binance.US saniyelik sorgu)
- `src/ledger.mjs` — sanal bakiye ve işlem defteri
- `src/dashboard.mjs` — web sayfası
- `data/` — kayıtlar (git'e girmez)

## Sınırlar

- Sadece `"mode": "paper"` var. Başka bir mod yazılırsa program başlamayı reddeder.
- Fiyatlar defterin en üst satırından alınır; büyük emirlerde gerçek dolum biraz daha kötü olur.
- Borsanın minimum emir tutarları tek tek kontrol edilmez; `minTradeUsd` ile kabaca sınırlanır.
