# RETORİK Telegram Turnuva Botu Kullanım Rehberi

Bu sistem `retorikmunazara` klasörü içinde çalışır ve Netlify'a yüklenebilir durumdadır.

## Sistem ne yapar?

- Telegram botundan yeni konferans/turnuva açarsın.
- Bot senden ad, kısa adres adı, açıklama, tarih/durum yazısı, görsel, delege form JSON'u ve organizasyon form JSON'u ister.
- Bilgiler `data/tournaments.json` dosyasına yazılır.
- Başvuru sayfası `<kisa-ad>/index.html` olarak üretilir ve sitede `retorikmunazara.com/<kisa-ad>/` şeklinde açılır.
- Ana sayfa `managed-tournaments.js` ile bu turnuvaları otomatik kart olarak gösterir.
- GitHub repo Netlify'a bağlıysa her bot işlemi sonrası Netlify otomatik deploy alır.

## Netlify ayarı

Repo kökü `retorikmunazara` olmalı.

Netlify build ayarı:

```text
Build command: npm install && python scripts/build.py
Publish directory: .
```

Bu ayarlar `netlify.toml` içine de eklendi.

## Telegram botu için gerekli değişkenler

Bot artık 7/24 çalışan ayrı bir Python worker istemez. Telegram mesajları doğrudan Netlify Function'a gelir:

```text
/api/telegram
```

Netlify sadece mesaj geldiğinde fonksiyonu çalıştırır. Bu yüzden Render gibi sürekli çalışan servis gerekmez.

Netlify > Site configuration > Environment variables bölümüne şunları ekle:

```text
TELEGRAM_BOT_TOKEN=BotFather'dan aldığın token
TELEGRAM_ADMIN_IDS=telegram_id_1,telegram_id_2
GITHUB_TOKEN=GitHub fine-grained personal access token
GITHUB_REPO=kullaniciadi/repo-adi
GITHUB_BRANCH=main
TELEGRAM_WEBHOOK_SECRET=uzun-rastgele-bir-yazi
```

`TELEGRAM_ADMIN_IDS` boş bırakılırsa botu herkes kullanabilir. Bunu boş bırakma.

Telegram ID öğrenmek için Telegram'da `@userinfobot` gibi bir bot kullanabilirsin.

GitHub token için repo content okuma/yazma yetkisi yeterlidir.

## Telegram webhook bağlama

Netlify deploy bittikten sonra Telegram'a webhook adresini bildirmen gerekir.

PowerShell'de:

```powershell
$env:TELEGRAM_BOT_TOKEN="BOT_TOKEN"
$env:TELEGRAM_WEBHOOK_SECRET="NETLIFY_ENV_ICINE_YAZDIGIN_SECRET"
$site="https://SITE_ADIN.netlify.app"
Invoke-RestMethod -Method Post `
  -Uri "https://api.telegram.org/bot$env:TELEGRAM_BOT_TOKEN/setWebhook" `
  -Body @{
    url="$site/api/telegram"
    secret_token=$env:TELEGRAM_WEBHOOK_SECRET
  }
```

Kontrol:

```powershell
Invoke-RestMethod "https://api.telegram.org/bot$env:TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

`url` alanında `https://SITE_ADIN.netlify.app/api/telegram` görünmelidir.

Webhook'u kapatmak istersen:

```powershell
Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$env:TELEGRAM_BOT_TOKEN/deleteWebhook"
```

## Eski Python bot alternatifi

`bot/telegram_bot.py` dosyası ayrı worker çalıştırmak isteyenler için duruyor. Ücretsiz ve Netlify uyumlu önerilen yöntem webhook fonksiyonudur.

## Bot komutları

```text
/start
/yeni
/liste
/kapat
/kaldir
/duzenle
/iptal
```

`/yeni` yeni konferans açar.

`/kapat` bir turnuvanın başvurusunu kapatır ve kapanış tarihini sayfaya işler.

`/kaldir` veya `/sil` turnuvayı tamamen listeden ve üretilmiş başvuru sayfasından kaldırır.

`/duzenle` şu alanları değiştirir:

```text
name
description
dateText
statusText
committees
teams
```

## Google Forms entry bilgilerini alma

Artık en kolay yöntem ayrı araç sitesidir.

## Form Entry Aracı

Yeni klasör:

```text
form-entry-araci
```

Bu klasörü Netlify'a ayrı site olarak yükleyebilirsin.

Netlify ayarı:

```text
Base directory: form-entry-araci
Build command: npm install
Publish directory: .
```

Kullanım:

1. Google Form linkini araca yapıştır.
2. Araç soru başlıklarını, entry id'lerini ve seçenekleri çıkarır.
3. `Bota Atılacak JSON` çıktısını kopyala.
4. Telegram botu `/yeni` akışında delege veya organizasyon form bilgisi istediğinde bu JSON'u gönder.

Bu yöntem Google Form'daki gerçek soruları yeni başvuru sayfasına taşır. Yani her turnuva aynı sabit soru şablonuna bağlı kalmaz.

Delege veya organizasyon formlarından biri olmayacaksa bot sorunca `-` yazabilirsin. İkisi birden boş bırakılamaz.

## Yerelde test

```powershell
cd "c:\Users\Toprak Efe\Desktop\wev\retorikmunazara"
python scripts/build.py
python -m http.server 8000
```

Tarayıcıda:

```text
http://localhost:8000
```

## Dosya yapısı

```text
data/tournaments.json              Turnuva verileri
assets/conference-images/          Botla yüklenen görseller
<kisa-ad>/index.html               Üretilen başvuru sayfaları
konferanslar/basvuru.js            Başvuru formu gönderim kodu
managed-tournaments.js             Ana sayfaya bot turnuvalarını ekler
bot/telegram_bot.py                Telegram botu
bot/requirements.txt               Bot bağımlılıkları
scripts/tournament_site.py         Sayfa üretici
scripts/build.py                   Netlify build komutu
netlify/functions/telegram.ts      Telegram webhook fonksiyonu
```
