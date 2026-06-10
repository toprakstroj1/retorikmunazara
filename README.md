<!-- Decorative README -->
# ╔═╗┬ ┬┬  ┬┌─┐┌┬┐  ╦  ┬ ┬
# ╠╣ │ ││  ││   │   ║  └┬┘
# ╚  └─┘┴─┘┴└─┘ ┴   ╩   ┴ 

## ✦ RETORİK — Adana Münazara Topluluğu (Website)

> Sözün gücü, gençlerin sesi.

────────── ✦ ✦ ✦ ──────────

Merhaba! Bu klasör RETORİK web sitesinin statik kaynaklarını içerir. Aşağıda hızlı bir rehber ve kısa notlar bulacaksın — şık ve anlaşılır.

● Ne var burada?

- `index.html` — Sayfanın tüm yapısı (Etkinlikler, Ekibimiz, Footer, Popuplar).
- `styles.css`, `popup.css`, `team-styles.css` — Stil dosyaları.
- `scripts.js` — Etkileşimler: popup'lar, carousel, formlar.
- `icons/` — SVG ikonlar (kullanılan `user.svg`, `team.svg`, `mail.svg`, `instagram.svg`, `tiktok.svg` vb.).
- `images/` — Görseller (turnuva afişleri, ekip fotoğrafları, logo).

────────── ✦ ✦ ✦ ──────────

● Hızlı Önizleme (Yerel)

1) Terminalde proje klasörüne gel:

```powershell
cd "c:\Users\Toprak Efe\Desktop\wev\retorikmunazara"
```

2) Python varsa kısa sunucu:

```powershell
python -m http.server 8000
```

Tarayıcıda http://localhost:8000 aç.

────────── ✦ ✦ ✦ ──────────

● Hızlı Düzenleme İpuçları

- Yönetim Kurulu: `index.html` → `section.team` içinden düzenlenir.
- Etkinlikler: `section.collections` içindeki `.collection-card` yapısını kopyalayın.
- `Çukurova Genç Meclis Demo`: kart içindeki `Başvuru Yap` butonu bir popup (`id="cgmPopup"`) açar; popup butonları `icons/` içindeki SVG'leri kullanır.
- İkon güncellemek istersen `icons/` altındaki SVG dosyalarını düzenle veya değiştir.

────────── ✦ ✦ ✦ ──────────

● Popup & Başvurular

- Popup fonksiyonları: `scripts.js` — `showCGMPopup()`, `closeCGMPopup()`, `showAgoraPopup()`, vb.
- Popup stilleri ve animasyon: `popup.css`.
- Başvuru linkleri şu an yerel yollar: `gencmeclis/basvuru/#vekil` ve `gencmeclis/basvuru/#orga` — istersen gerçek Google Forms linkleriyle değiştiririm.

────────── ✦ ✦ ✦ ──────────

● Sosyal & İletişim

- `TikTok`, `Instagram` ve `E-posta` linkleri footer içinde, `icons/` SVG ikonu ile gösteriliyor.

────────── ✦ ✦ ✦ ──────────

● Stil & Tema

- Renkler `styles.css` içindeki `:root` değişkenlerinde tanımlı (`--accent`, `--accent-hover`, vb.).
- SVG ikonları temaya göre daha esnek olsun istersen, SVG içlerinde `stroke="currentColor"`/`fill="currentColor"` kullanabilirim.

────────── ✦ ✦ ✦ ──────────

İstersen README'i daha da süsleyeyim (ASCII art, renkli badge'ler veya kısa deploy talimatları). Nasıl olsun? 💫

