from __future__ import annotations

import json
import re
import shutil
from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "tournaments.json"
OUTPUT_ROOT = ROOT / "konferanslar"


DEFAULT_DELEGATE_FIELDS = [
    ("fullName", "İsim ve Soy İsim", "text", True),
    ("birthDate", "Doğum Tarihi", "date", True),
    ("phone", "Telefon Numarası", "tel", True),
    ("email", "E-mail Hesabı", "email", True),
    ("city", "Hangi Şehirden Katılım Sağlıyorsunuz?", "city", True),
    ("school", "Okul", "text", True),
    ("experiences", "Deneyimleriniz", "textarea", True),
    ("committee", "Komite Tercihi (1. tercih)", "committee", True),
    ("committee2", "Komite Tercihi (2. tercih)", "committee", True),
    ("reference", "Varsa Referans Olan Kişi", "textarea", False),
    ("notes", "Eklemek İstedikleriniz", "textarea", False),
    ("rules", "Şartları okudum, kabul ediyorum.", "checkbox", True),
]

DEFAULT_ORGANIZATION_FIELDS = [
    ("fullName", "İsim ve Soy İsim", "text", True),
    ("birthDate", "Doğum Tarihi", "date", True),
    ("phone", "Telefon Numarası", "tel", True),
    ("email", "E-mail Hesabı", "email", True),
    ("city", "Hangi Şehirden Katılım Sağlıyorsunuz?", "city", True),
    ("school", "Okul", "text", True),
    ("team", "Organizasyon Birimleri", "team", True),
    ("experiences", "Deneyimleriniz", "textarea", True),
    ("reference", "Varsa Referans Olan Kişi", "textarea", False),
    ("notes", "Eklemek İstedikleriniz", "textarea", False),
    ("rules", "Şartları okudum, kabul ediyorum.", "checkbox", True),
]


def slugify(value: str) -> str:
    table = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    value = value.translate(table).lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "konferans"


def read_data() -> dict:
    if not DATA_FILE.exists():
        return {"tournaments": []}
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def write_data(data: dict) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def normalize_tournament(item: dict) -> dict:
    normalized = dict(item)
    normalized["slug"] = normalized.get("slug") or slugify(normalized.get("name", "konferans"))
    normalized.setdefault("status", "open")
    normalized.setdefault("statusText", "Başvurular Açık")
    normalized.setdefault("dateText", "")
    normalized.setdefault("closedDate", "")
    normalized.setdefault("image", "images/retorik-logo.png")
    normalized.setdefault("description", "")
    normalized.setdefault("delegateTitle", "Delege Başvurusu")
    normalized.setdefault("organizationTitle", "Organizasyon Başvurusu")
    normalized.setdefault("committees", ["Genel Kurul", "Kriz Komitesi", "Basın Komitesi"])
    normalized.setdefault("teams", ["Basın Ekibi", "Lojistik Ekibi", "Delegasyon Ekibi", "Saha Ekibi"])
    normalized.setdefault("forms", {})
    return normalized


def input_html(name: str, label: str, field_type: str, required: bool, tournament: dict, options: list[str] | None = None) -> str:
    required_attr = " required" if required else ""
    safe_label = escape(label)
    safe_name = escape(name)
    options = options or []

    if field_type == "textarea":
        return f'<label class="form-wide">{safe_label}<textarea name="{safe_name}" rows="4"{required_attr}></textarea></label>'
    if field_type == "checkbox":
        return f'<label><input type="checkbox" name="{safe_name}" value="Evet."{required_attr} /> {safe_label}</label>'
    if field_type == "checkboxes":
        choices = "\n".join(
            f'<label><input type="checkbox" name="{safe_name}" value="{escape(value)}" /> {escape(value)}</label>'
            for value in options
        )
        return f'''<fieldset class="form-wide dynamic-choice-group" data-required-group="{safe_name}"{" data-required=\"true\"" if required else ""}>
            <legend>{safe_label}</legend>
            <div class="form-consents">{choices}</div>
        </fieldset>'''
    if field_type in {"select", "radio"}:
        choices = "\n".join(f'<option value="{escape(value)}">{escape(value)}</option>' for value in options)
        return f'''<label class="form-wide">{safe_label}
            <select name="{safe_name}"{required_attr}>
                <option value="" selected disabled>Seçim yapın</option>
                {choices}
            </select>
        </label>'''
    if field_type == "city":
        return f'''<label>{safe_label}
            <select name="{safe_name}" autocomplete="address-level2"{required_attr}>
                <option value="" selected disabled>Şehir seçin</option>
                <option value="Adana">Adana</option>
                <option value="Mersin">Mersin</option>
                <option value="Diğer">Diğer</option>
            </select>
        </label>'''
    if field_type == "committee":
        options = "\n".join(f'<option value="{escape(value)}">{escape(value)}</option>' for value in tournament["committees"])
        return f'''<label class="form-wide">{safe_label}
            <select name="{safe_name}"{required_attr}>
                <option value="" selected disabled>Seçim yapın</option>
                {options}
            </select>
        </label>'''
    if field_type == "team":
        options = "\n".join(f'<option value="{escape(value)}">{escape(value)}</option>' for value in tournament["teams"])
        return f'''<label>{safe_label}
            <select name="{safe_name}"{required_attr}>
                <option value="" selected disabled>Birim seçin</option>
                {options}
            </select>
        </label>'''

    autocomplete = {
        "fullName": " autocomplete=\"name\"",
        "phone": " autocomplete=\"tel\"",
        "email": " autocomplete=\"email\"",
    }.get(name, "")
    html_type = field_type if field_type in {"text", "date", "email", "tel", "number", "time"} else "text"
    return f'<label>{safe_label}<input type="{escape(html_type)}" name="{safe_name}"{autocomplete}{required_attr} /></label>'


def form_fields_html(fields: list[tuple[str, str, str, bool]], tournament: dict) -> tuple[str, str]:
    grid_items = []
    consent_items = []
    for field in fields:
        markup = input_html(*field, tournament=tournament)
        if field[2] == "checkbox":
            consent_items.append(markup)
        else:
            grid_items.append(markup)
    return "\n".join(grid_items), "\n".join(consent_items)


def dynamic_form_fields_html(config: dict, fallback_fields: list[tuple[str, str, str, bool]], tournament: dict) -> tuple[str, str]:
    questions = config.get("questions") if isinstance(config, dict) else None
    if not questions:
        return form_fields_html(fallback_fields, tournament)

    grid_items = []
    consent_items = []
    for index, question in enumerate(questions, start=1):
        name = question.get("name") or f"q_{index}"
        label = question.get("label") or f"Soru {index}"
        field_type = question.get("kind") or question.get("type") or "text"
        required = bool(question.get("required"))
        options = question.get("options") or []
        markup = input_html(name, label, field_type, required, tournament, options)
        if field_type == "checkbox":
            consent_items.append(markup)
        else:
            grid_items.append(markup)
    return "\n".join(grid_items), "\n".join(consent_items)


def page_html(tournament: dict) -> str:
    delegate_grid, delegate_consents = dynamic_form_fields_html(
        tournament["forms"].get("delegate", {}),
        DEFAULT_DELEGATE_FIELDS,
        tournament,
    )
    org_grid, org_consents = dynamic_form_fields_html(
        tournament["forms"].get("organization", {}),
        DEFAULT_ORGANIZATION_FIELDS,
        tournament,
    )
    google_config = json.dumps(tournament["forms"], ensure_ascii=False, indent=4)
    title = escape(tournament["name"])
    description = escape(tournament["description"])
    date_text = escape(tournament.get("dateText") or "Konferans")

    if tournament["status"] == "closed":
        closed = escape(tournament.get("closedDate") or tournament.get("statusText") or "Başvurular kapandı")
        picker = f'''
        <section class="application-picker" aria-label="Başvuru durumu">
            <div class="application-container picker-grid">
                <article class="application-choice-card reveal-card">
                    <span class="choice-number">01</span>
                    <div>
                        <p class="card-badge">Kapalı</p>
                        <h2>Başvurular Kapandı</h2>
                        <p>Bu konferans için başvuru alımı tamamlandı. Kapanış tarihi: {closed}</p>
                    </div>
                    <a href="../../#collections" class="apply-btn">Etkinliklere Dön</a>
                </article>
            </div>
        </section>'''
    else:
        picker = f'''
        <section class="application-picker" aria-label="Başvuru türü seçimi">
            <div class="application-container picker-grid">
                <article class="application-choice-card reveal-card">
                    <span class="choice-number">01</span>
                    <div>
                        <p class="card-badge">Katılımcı</p>
                        <h2>Delege Başvurusu</h2>
                        <p>Konferansta komite oturumlarına katılıp temsil, müzakere ve karar yazımı süreçlerinde yer almak isteyen katılımcılar için.</p>
                    </div>
                    <button type="button" class="apply-btn js-application-open" data-target="delegate">Başvuru Sekmesini Aç</button>
                </article>

                <article class="application-choice-card reveal-card">
                    <span class="choice-number">02</span>
                    <div>
                        <p class="card-badge">Organizasyon</p>
                        <h2>Organizasyon Başvurusu</h2>
                        <p>Basın, lojistik, saha akışı ve ekip koordinasyonunda görev alarak konferansın yürütülmesine destek olmak isteyenler için.</p>
                    </div>
                    <button type="button" class="apply-btn js-application-open" data-target="organization">Başvuru Sekmesini Aç</button>
                </article>
            </div>
        </section>'''

    return f'''<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
    <title>{title} Başvuru | RETORİK</title>
    <meta name="description" content="{description}" />
    <meta name="theme-color" content="#8B1A1A" />
    <link rel="icon" href="../../images/retorik-logo.png" type="image/png" />
    <link rel="apple-touch-icon" href="../../images/retorik-logo.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Sora:wght@500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../../styles.css" />
    <link rel="stylesheet" href="../../card-buttons.css" />
    <link rel="stylesheet" href="../../theme-refresh.css" />
    <link rel="stylesheet" href="../../gencmeclis/basvuru.css" />
</head>
<body class="gencmeclis-page">
    <nav id="navbar">
        <div class="nav-container">
            <a href="../../" class="logo-link">
                <img src="../../images/retorik-logo.png" class="logo-svg" alt="Retorik Logo">
                <span class="logo-text">RETORİK</span>
            </a>
            <ul class="nav-links">
                <li><a href="../../#home" class="nav-link">Anasayfa</a></li>
                <li><a href="../../#collections" class="nav-link active">Etkinlikler</a></li>
                <li><a href="../../#featured" class="nav-link">Münazara</a></li>
                <li><a href="https://tab.retorikmunazara.com" class="nav-link" target="_blank" rel="noopener noreferrer">Tab</a></li>
                <li><a href="../../#team" class="nav-link">Ekibimiz</a></li>
                <li><a href="../../#contact" class="nav-link">İletişim</a></li>
            </ul>
        </div>
    </nav>

    <main>
        <section class="application-hero">
            <div class="hero-orbit" aria-hidden="true"></div>
            <div class="application-container">
                <div class="application-kicker">{date_text} | Konferans Başvurusu</div>
                <h1>{title}</h1>
                <p>{description}</p>
            </div>
        </section>

        {picker}

        <section class="application-form-stage" data-application-stage hidden>
            <div class="application-container">
                <div class="application-form-card" id="delege" data-application-panel="delegate" hidden>
                    <div class="form-panel-head">
                        <div>
                            <p class="application-kicker">Delege Başvurusu</p>
                            <h2>Delege Bilgileri</h2>
                        </div>
                        <button class="form-close" type="button" data-close-application aria-label="Formu kapat">&times;</button>
                    </div>
                    <form class="gencmeclis-form" data-google-form="delegate">
                        <div class="form-grid">{delegate_grid}</div>
                        <div class="form-consents">{delegate_consents}</div>
                        <div class="form-actions">
                            <button class="form-submit" type="submit">Başvuruyu Gönder</button>
                            <p class="form-status" role="status"></p>
                        </div>
                    </form>
                </div>

                <div class="application-form-card" id="orga" data-application-panel="organization" hidden>
                    <div class="form-panel-head">
                        <div>
                            <p class="application-kicker">Organizasyon Başvurusu</p>
                            <h2>Ekip Görev Bilgileri</h2>
                        </div>
                        <button class="form-close" type="button" data-close-application aria-label="Formu kapat">&times;</button>
                    </div>
                    <form class="gencmeclis-form" data-google-form="organization">
                        <div class="form-grid">{org_grid}</div>
                        <div class="form-consents">{org_consents}</div>
                        <div class="form-actions">
                            <button class="form-submit" type="submit">Başvuruyu Gönder</button>
                            <p class="form-status" role="status"></p>
                        </div>
                    </form>
                </div>
            </div>
        </section>
    </main>

    <div class="success-overlay" data-success-overlay hidden>
        <div class="success-card" role="status" aria-live="polite">
            <span class="success-mark" aria-hidden="true">✓</span>
            <p class="application-kicker">Başvuru Alındı</p>
            <h2>Başvurunuz başarıyla gönderildi.</h2>
            <p>Değerlendirme ekibi bilgilerinizi Google Forms üzerinden aldı.</p>
        </div>
    </div>

    <script>
    window.GOOGLE_FORM_CONFIG = {google_config};
    </script>
    <script src="../../konferanslar/basvuru.js"></script>
</body>
</html>
'''


def build_site() -> None:
    data = read_data()
    tournaments = [normalize_tournament(item) for item in data.get("tournaments", [])]
    for tournament in tournaments:
        target = OUTPUT_ROOT / tournament["slug"]
        target.mkdir(parents=True, exist_ok=True)
        (target / "index.html").write_text(page_html(tournament), encoding="utf-8")


def copy_image(source: Path, slug: str) -> str:
    if not source.exists():
        raise FileNotFoundError(source)
    target_dir = ROOT / "assets" / "conference-images"
    target_dir.mkdir(parents=True, exist_ok=True)
    suffix = source.suffix.lower() or ".jpg"
    target = target_dir / f"{slug}{suffix}"
    shutil.copy2(source, target)
    return target.relative_to(ROOT).as_posix()


if __name__ == "__main__":
    build_site()
