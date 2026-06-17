# RETORİK Telegram Turnuva Botu Kullanım Rehberi

Bu sistem `retorikmunazara` klasörü içinde çalışır ve Netlify'a yüklenebilir durumdadır.

## Sistem ne yapar?

- Telegram botundan yeni konferans/turnuva açarsın.
- Bot senden ad, açıklama, tarih/durum yazısı, görsel, Google Form entry bilgileri, komite ve organizasyon birimlerini ister.
- Bilgiler `data/tournaments.json` dosyasına yazılır.
- Başvuru sayfası `konferanslar/<slug>/index.html` olarak üretilir.
- Ana sayfa `managed-tournaments.js` ile bu turnuvaları otomatik kart olarak gösterir.
- GitHub repo Netlify'a bağlıysa her bot işlemi sonrası Netlify otomatik deploy alır.

## Netlify ayarı

Repo kökü `retorikmunazara` olmalı.

Netlify build ayarı:

```text
Build command: python scripts/build.py
Publish directory: .
```

Bu ayarlar `netlify.toml` içine de eklendi.

## Telegram botu için gerekli değişkenler

Botu ücretsiz bir worker ortamında çalıştırman gerekir. Render, Koyeb veya Railway free plan gibi bir servis kullanabilirsin. Bot polling ile çalışır, webhook gerekmez.

Gerekli environment variables:

```text
TELEGRAM_BOT_TOKEN=BotFather'dan aldığın token
TELEGRAM_ADMIN_IDS=telegram_id_1,telegram_id_2
GITHUB_TOKEN=GitHub fine-grained personal access token
GITHUB_REPO=kullaniciadi/repo-adi
GITHUB_BRANCH=main
```

`TELEGRAM_ADMIN_IDS` boş bırakılırsa botu herkes kullanabilir. Bunu boş bırakma.

Telegram ID öğrenmek için Telegram'da `@userinfobot` gibi bir bot kullanabilirsin.

GitHub token için repo content okuma/yazma yetkisi yeterlidir.

## Render ile ücretsiz çalıştırma

1. GitHub repo'yu Render'a bağla.
2. New > Background Worker seç.
3. Root directory olarak `retorikmunazara` seç.
4. Build command:

```bash
pip install -r bot/requirements.txt
```

5. Start command:

```bash
python bot/telegram_bot.py
```

6. Environment variables bölümüne yukarıdaki değişkenleri ekle.

Repo kökü doğrudan `retorikmunazara` ise root directory seçmene gerek yok.

## Bot komutları

```text
/start
/yeni
/liste
/kapat
/duzenle
/iptal
```

`/yeni` yeni konferans açar.

`/kapat` bir turnuvanın başvurusunu kapatır ve kapanış tarihini sayfaya işler.

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

En kolay ve bedava yöntem:

1. Google Form oluştur.
2. Form sorularını site alanlarıyla eşleştir.
3. Formda sağ üstten üç nokta > Önceden doldurulmuş bağlantı al seç.
4. Her soruya örnek cevap yaz.
5. Linki oluştur.
6. Link içindeki `entry.xxxxx=...` parçalarından entry numaralarını al.

Delege formu için bot şu formatı ister:

```text
action=https://docs.google.com/forms/d/e/FORM_ID/viewform
fullName=entry.123
birthDate.year=entry.456_year
birthDate.month=entry.456_month
birthDate.day=entry.456_day
phone=entry.789
email=entry.111
school=entry.222
experiences=entry.333
committee=entry.444
committee2=entry.555
reference=entry.666
notes=entry.777
rules=entry.888
```

Organizasyon formu için aynı formatı kullan, sadece komite yerine:

```text
team=entry.999
```

Google Form linki `/viewform` olsa bile bot bunu otomatik `/formResponse` haline çevirir.

Bir formu sonra bağlayacaksan bot sorunca `-` yazabilirsin. Bu durumda sayfa açılır ama kullanıcı başvuru göndermeye çalışınca form eşleşmesi yok uyarısı görür.

## Site alanları

Delege başvurusunda kullanılan alanlar:

```text
fullName
birthDate
phone
email
city
school
experiences
committee
committee2
reference
notes
rules
```

Organizasyon başvurusunda kullanılan alanlar:

```text
fullName
birthDate
phone
email
city
school
team
experiences
reference
notes
rules
```

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
konferanslar/<slug>/index.html     Üretilen başvuru sayfaları
konferanslar/basvuru.js            Başvuru formu gönderim kodu
managed-tournaments.js             Ana sayfaya bot turnuvalarını ekler
bot/telegram_bot.py                Telegram botu
bot/requirements.txt               Bot bağımlılıkları
scripts/tournament_site.py         Sayfa üretici
scripts/build.py                   Netlify build komutu
```
