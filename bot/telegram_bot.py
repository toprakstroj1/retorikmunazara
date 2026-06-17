from __future__ import annotations

import json
import os
import re
import tempfile
import urllib.error
import urllib.request
import base64
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)


ASK_NAME, ASK_DESCRIPTION, ASK_DATE, ASK_IMAGE, ASK_DELEGATE_FORM, ASK_ORG_FORM, ASK_COMMITTEES, ASK_TEAMS = range(8)
ASK_CLOSE_SLUG, ASK_CLOSE_DATE = range(8, 10)
ASK_EDIT_SLUG, ASK_EDIT_FIELD, ASK_EDIT_VALUE = range(10, 13)

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "tournaments.json"
IMAGE_DIR = ROOT / "assets" / "conference-images"

def load_local_env() -> None:
    for env_file in (ROOT / ".env", ROOT / ".env.local"):
        if not env_file.exists():
            continue
        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_local_env()

ADMIN_IDS = {int(value) for value in os.getenv("TELEGRAM_ADMIN_IDS", "").replace(" ", "").split(",") if value}
GITHUB_REPO = os.getenv("GITHUB_REPO", "")
GITHUB_BRANCH = os.getenv("GITHUB_BRANCH", "main")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")


def slugify(value: str) -> str:
    table = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    value = value.translate(table).lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "konferans"


def load_data() -> dict[str, Any]:
    if not DATA_FILE.exists():
        return {"tournaments": []}
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def save_data(data: dict[str, Any]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_form_action(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    value = value.replace("/viewform", "/formResponse")
    if "/formResponse" not in value and "/d/e/" in value:
        value = value.rstrip("/") + "/formResponse"
    return value.split("?")[0]


def parse_entry_map(text: str) -> dict[str, Any]:
    text = text.strip()
    if text == "-":
        return {}
    try:
        parsed = json.loads(text)
        if "action" in parsed:
            parsed["action"] = normalize_form_action(parsed["action"])
        return parsed
    except json.JSONDecodeError:
        pass

    config: dict[str, Any] = {"action": "", "fields": {}}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = [part.strip() for part in line.split("=", 1)]
        if key in {"action", "url", "form"}:
            config["action"] = normalize_form_action(value)
        elif key.startswith("birthDate."):
            config["fields"].setdefault("birthDate", {})[key.split(".", 1)[1]] = value
        else:
            config["fields"][key] = value
    return config


def split_values(text: str, fallback: list[str]) -> list[str]:
    if text.strip() == "-":
        return fallback
    values = [part.strip() for part in re.split(r"[\n,;]+", text) if part.strip()]
    return values or fallback


def require_admin(update: Update) -> bool:
    if not ADMIN_IDS:
        return True
    user = update.effective_user
    return bool(user and user.id in ADMIN_IDS)


@dataclass
class PendingFile:
    path: str
    content: bytes | str


@dataclass
class RepoCommitter:
    files: list[PendingFile] = field(default_factory=list)

    def add_text(self, path: str, content: str) -> None:
        self.files.append(PendingFile(path.replace("\\", "/"), content))

    def add_binary(self, path: str, content: bytes) -> None:
        self.files.append(PendingFile(path.replace("\\", "/"), content))

    def commit(self, message: str) -> None:
        if not (GITHUB_TOKEN and GITHUB_REPO):
            return
        for item in self.files:
            put_github_file(item.path, item.content, message)


def github_request(url: str, method: str = "GET", payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def put_github_file(path: str, content: bytes | str, message: str) -> None:
    repo_path = path.strip("/")
    api_url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{repo_path}"
    sha = None
    try:
        existing = github_request(f"{api_url}?ref={GITHUB_BRANCH}")
        sha = existing.get("sha")
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise

    raw = content.encode("utf-8") if isinstance(content, str) else content
    payload: dict[str, Any] = {
        "message": message,
        "content": base64.b64encode(raw).decode("ascii"),
        "branch": GITHUB_BRANCH,
    }
    if sha:
        payload["sha"] = sha
    github_request(api_url, method="PUT", payload=payload)


def build_page(slug: str) -> str:
    import sys

    scripts_dir = ROOT / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    from tournament_site import build_site

    build_site()
    return (ROOT / "konferanslar" / slug / "index.html").read_text(encoding="utf-8")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not require_admin(update):
        await update.message.reply_text("Bu botu kullanma yetkin yok.")
        return
    await update.message.reply_text(
        "RETORİK turnuva botu hazır.\n\n"
        "/yeni - yeni konferans aç\n"
        "/liste - turnuvaları göster\n"
        "/kapat - başvuruyu kapat\n"
        "/duzenle - ad/açıklama/tarih/durum düzenle\n"
        "/iptal - aktif işlemi iptal et"
    )


async def list_tournaments(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not require_admin(update):
        return
    tournaments = load_data().get("tournaments", [])
    if not tournaments:
        await update.message.reply_text("Henüz botla eklenmiş turnuva yok.")
        return
    lines = []
    for item in tournaments:
        status = "açık" if item.get("status") != "closed" else f"kapalı ({item.get('closedDate', '-')})"
        lines.append(f"- {item.get('slug')}: {item.get('name')} | {status}")
    await update.message.reply_text("\n".join(lines))


async def new_tournament(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not require_admin(update):
        await update.message.reply_text("Bu botu kullanma yetkin yok.")
        return ConversationHandler.END
    context.user_data["new_tournament"] = {}
    await update.message.reply_text("Konferans adını yaz.")
    return ASK_NAME


async def ask_description(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    name = update.message.text.strip()
    context.user_data["new_tournament"].update({"name": name, "slug": slugify(name)})
    await update.message.reply_text("Adın altında duracak kısa açıklamayı yaz.")
    return ASK_DESCRIPTION


async def ask_date(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["new_tournament"]["description"] = update.message.text.strip()
    await update.message.reply_text("Kartta görünecek tarih/durum metnini yaz. Örnek: 14 Haziran 2026")
    return ASK_DATE


async def ask_image(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["new_tournament"]["dateText"] = update.message.text.strip()
    await update.message.reply_text("Konferans görselini fotoğraf veya dosya olarak gönder.")
    return ASK_IMAGE


async def ask_delegate_form(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    item = context.user_data["new_tournament"]
    slug = item["slug"]
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    tg_file = None
    suffix = ".jpg"
    if update.message.photo:
        tg_file = await update.message.photo[-1].get_file()
    elif update.message.document:
        tg_file = await update.message.document.get_file()
        suffix = Path(update.message.document.file_name or "image.jpg").suffix or ".jpg"

    if tg_file is None:
        await update.message.reply_text("Görsel alamadım. Lütfen fotoğraf ya da dosya olarak gönder.")
        return ASK_IMAGE

    image_path = IMAGE_DIR / f"{slug}{suffix.lower()}"
    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        temp_name = temp_file.name
    await tg_file.download_to_drive(temp_name)
    image_path.write_bytes(Path(temp_name).read_bytes())
    Path(temp_name).unlink(missing_ok=True)
    item["image"] = image_path.relative_to(ROOT).as_posix()

    await update.message.reply_text(
        "Delege Google Form bilgilerini gönder.\n\n"
        "Format:\n"
        "action=https://docs.google.com/forms/d/e/.../viewform\n"
        "fullName=entry.123\n"
        "birthDate.year=entry.456_year\n"
        "birthDate.month=entry.456_month\n"
        "birthDate.day=entry.456_day\n"
        "phone=entry...\n"
        "email=entry...\n"
        "school=entry...\n"
        "experiences=entry...\n"
        "committee=entry...\n"
        "committee2=entry...\n"
        "reference=entry...\n"
        "notes=entry...\n"
        "rules=entry...\n\n"
        "Boş bırakmak için `-` yaz."
    )
    return ASK_DELEGATE_FORM


async def ask_org_form(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["new_tournament"].setdefault("forms", {})["delegate"] = parse_entry_map(update.message.text)
    await update.message.reply_text(
        "Organizasyon Google Form bilgilerini aynı formatta gönder. Boş bırakmak için `-` yazabilirsin.\n"
        "Organizasyon alanlarında `team=entry.x` kullan."
    )
    return ASK_ORG_FORM


async def ask_committees(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["new_tournament"].setdefault("forms", {})["organization"] = parse_entry_map(update.message.text)
    await update.message.reply_text("Komite seçeneklerini virgülle veya satır satır yaz. Varsayılan için `-` yaz.")
    return ASK_COMMITTEES


async def ask_teams(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    fallback = ["Genel Kurul", "Kriz Komitesi", "Basın Komitesi"]
    context.user_data["new_tournament"]["committees"] = split_values(update.message.text, fallback)
    await update.message.reply_text("Organizasyon birimlerini virgülle veya satır satır yaz. Varsayılan için `-` yaz.")
    return ASK_TEAMS


async def finish_new(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    item = context.user_data["new_tournament"]
    item["teams"] = split_values(update.message.text, ["Basın Ekibi", "Lojistik Ekibi", "Delegasyon Ekibi", "Saha Ekibi"])
    item["status"] = "open"
    item["statusText"] = "Başvurular Açık"

    data = load_data()
    data["tournaments"] = [t for t in data.get("tournaments", []) if t.get("slug") != item["slug"]]
    data["tournaments"].append(item)
    save_data(data)

    page = build_page(item["slug"])
    committer = RepoCommitter()
    committer.add_text("data/tournaments.json", DATA_FILE.read_text(encoding="utf-8"))
    committer.add_text(f"konferanslar/{item['slug']}/index.html", page)
    committer.add_binary(item["image"], (ROOT / item["image"]).read_bytes())
    committer.commit(f"Yeni konferans: {item['name']}")

    await update.message.reply_text(
        f"Konferans açıldı: {item['name']}\n"
        f"Sayfa: /konferanslar/{item['slug']}/\n"
        "GitHub bağlıysa Netlify otomatik deploy başlatır."
    )
    return ConversationHandler.END


async def close_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not require_admin(update):
        return ConversationHandler.END
    await list_tournaments(update, context)
    await update.message.reply_text("Kapatılacak turnuvanın slug değerini yaz.")
    return ASK_CLOSE_SLUG


async def close_date(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["close_slug"] = update.message.text.strip()
    await update.message.reply_text("Kapanış tarihini yaz. Örnek: 17 Haziran 2026")
    return ASK_CLOSE_DATE


async def finish_close(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    slug = context.user_data["close_slug"]
    closed_date = update.message.text.strip()
    data = load_data()
    target = None
    for item in data.get("tournaments", []):
        if item.get("slug") == slug:
            item["status"] = "closed"
            item["statusText"] = "Tamamlandı"
            item["closedDate"] = closed_date
            target = item
            break
    if not target:
        await update.message.reply_text("Bu slug ile turnuva bulamadım.")
        return ConversationHandler.END
    save_data(data)
    page = build_page(slug)
    committer = RepoCommitter()
    committer.add_text("data/tournaments.json", DATA_FILE.read_text(encoding="utf-8"))
    committer.add_text(f"konferanslar/{slug}/index.html", page)
    committer.commit(f"Başvuru kapandı: {target.get('name')}")
    await update.message.reply_text(f"{target.get('name')} kapatıldı. Kapanış tarihi: {closed_date}")
    return ConversationHandler.END


async def edit_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not require_admin(update):
        return ConversationHandler.END
    await list_tournaments(update, context)
    await update.message.reply_text("Düzenlenecek turnuvanın slug değerini yaz.")
    return ASK_EDIT_SLUG


async def edit_field(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["edit_slug"] = update.message.text.strip()
    await update.message.reply_text("Düzenlenecek alanı yaz: name, description, dateText, statusText, committees, teams")
    return ASK_EDIT_FIELD


async def edit_value(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    field_name = update.message.text.strip()
    if field_name not in {"name", "description", "dateText", "statusText", "committees", "teams"}:
        await update.message.reply_text("Bu alan desteklenmiyor.")
        return ConversationHandler.END
    context.user_data["edit_field"] = field_name
    await update.message.reply_text("Yeni değeri yaz.")
    return ASK_EDIT_VALUE


async def finish_edit(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    slug = context.user_data["edit_slug"]
    field_name = context.user_data["edit_field"]
    value: Any = update.message.text.strip()
    if field_name in {"committees", "teams"}:
        value = split_values(value, [])

    data = load_data()
    target = None
    for item in data.get("tournaments", []):
        if item.get("slug") == slug:
            item[field_name] = value
            target = item
            break
    if not target:
        await update.message.reply_text("Bu slug ile turnuva bulamadım.")
        return ConversationHandler.END

    save_data(data)
    page = build_page(slug)
    committer = RepoCommitter()
    committer.add_text("data/tournaments.json", DATA_FILE.read_text(encoding="utf-8"))
    committer.add_text(f"konferanslar/{slug}/index.html", page)
    committer.commit(f"Konferans düzenlendi: {target.get('name')}")
    await update.message.reply_text("Düzenleme kaydedildi.")
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.clear()
    await update.message.reply_text("İşlem iptal edildi.")
    return ConversationHandler.END


def main() -> None:
    token = os.getenv("8808132965:AAF5U_GMqrKL2xXthnWP789RrTYs_15Gk5Y")
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN ortam değişkeni eksik.")

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("liste", list_tournaments))
    app.add_handler(ConversationHandler(
        entry_points=[CommandHandler("yeni", new_tournament)],
        states={
            ASK_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, ask_description)],
            ASK_DESCRIPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, ask_date)],
            ASK_DATE: [MessageHandler(filters.TEXT & ~filters.COMMAND, ask_image)],
            ASK_IMAGE: [MessageHandler((filters.PHOTO | filters.Document.IMAGE), ask_delegate_form)],
            ASK_DELEGATE_FORM: [MessageHandler(filters.TEXT & ~filters.COMMAND, ask_org_form)],
            ASK_ORG_FORM: [MessageHandler(filters.TEXT & ~filters.COMMAND, ask_committees)],
            ASK_COMMITTEES: [MessageHandler(filters.TEXT & ~filters.COMMAND, ask_teams)],
            ASK_TEAMS: [MessageHandler(filters.TEXT & ~filters.COMMAND, finish_new)],
        },
        fallbacks=[CommandHandler("iptal", cancel)],
    ))
    app.add_handler(ConversationHandler(
        entry_points=[CommandHandler("kapat", close_start)],
        states={
            ASK_CLOSE_SLUG: [MessageHandler(filters.TEXT & ~filters.COMMAND, close_date)],
            ASK_CLOSE_DATE: [MessageHandler(filters.TEXT & ~filters.COMMAND, finish_close)],
        },
        fallbacks=[CommandHandler("iptal", cancel)],
    ))
    app.add_handler(ConversationHandler(
        entry_points=[CommandHandler("duzenle", edit_start)],
        states={
            ASK_EDIT_SLUG: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_field)],
            ASK_EDIT_FIELD: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_value)],
            ASK_EDIT_VALUE: [MessageHandler(filters.TEXT & ~filters.COMMAND, finish_edit)],
        },
        fallbacks=[CommandHandler("iptal", cancel)],
    ))
    app.add_handler(CommandHandler("iptal", cancel))
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
