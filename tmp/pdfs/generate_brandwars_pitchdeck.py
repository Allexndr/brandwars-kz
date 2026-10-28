from __future__ import annotations

from pathlib import Path
from textwrap import wrap

from PIL import Image
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.pagesizes import landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output/pdf/brandwars-pitch-deck-ru.pdf"
ASSET_DIR = Path(
    "/var/folders/79/_kv5bshj3ls6c2dh887pgy500000gn/T/cursor/screenshots"
)

MAP = ASSET_DIR / "brandwars-map-native.png"
CLAIM = ASSET_DIR / "brandwars-claim.png"
AUTO = ASSET_DIR / "brandwars-auto-category.png"
CHARACTER = ASSET_DIR / "brandwars-character-pricing.png"

W, H = landscape((960, 540))

INK = HexColor("#0F172A")
MUTED = HexColor("#64748B")
PAPER = HexColor("#F7F7F2")
WHITE = HexColor("#FFFFFF")
ORANGE = HexColor("#C2410C")
ORANGE_SOFT = HexColor("#F5E5DC")
TEAL = HexColor("#0F766E")
TEAL_SOFT = HexColor("#DDEDEA")
NAVY = HexColor("#06141D")
LINE = HexColor("#DCE1E3")
LIME = HexColor("#87A61C")

FONT_DIR = Path("/System/Library/Fonts/Supplemental")
pdfmetrics.registerFont(TTFont("Arial", str(FONT_DIR / "Arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(FONT_DIR / "Arial Bold.ttf")))
pdfmetrics.registerFont(TTFont("Georgia", str(FONT_DIR / "Georgia.ttf")))
pdfmetrics.registerFont(TTFont("Georgia-Bold", str(FONT_DIR / "Georgia Bold.ttf")))


def crop_image(path: Path, x: float, y: float, w: float, h: float, anchor=(0.5, 0.5)):
    image = Image.open(path).convert("RGB")
    src_ratio = image.width / image.height
    dst_ratio = w / h
    if src_ratio > dst_ratio:
        crop_w = int(image.height * dst_ratio)
        left = int((image.width - crop_w) * anchor[0])
        box = (left, 0, left + crop_w, image.height)
    else:
        crop_h = int(image.width / dst_ratio)
        top = int((image.height - crop_h) * anchor[1])
        box = (0, top, image.width, top + crop_h)
    cropped = image.crop(box)
    return ImageReader(cropped), x, y, w, h


def background(c: canvas.Canvas, color=PAPER):
    c.setFillColor(color)
    c.rect(0, 0, W, H, stroke=0, fill=1)


def brand(c: canvas.Canvas, dark=False):
    c.setFont("Georgia-Bold", 13)
    c.setFillColor(WHITE if dark else INK)
    c.drawString(40, H - 34, "BrandWars")
    c.setFillColor(ORANGE)
    c.drawString(110, H - 34, ".kz")


def page_no(c: canvas.Canvas, number: int, dark=False):
    c.setFillColor(Color(1, 1, 1, 0.55) if dark else MUTED)
    c.setFont("Arial", 8)
    c.drawRightString(W - 36, 22, f"{number:02d}")


def title(c: canvas.Canvas, text: str, subtitle: str | None = None, dark=False):
    c.setFont("Georgia-Bold", 27)
    c.setFillColor(WHITE if dark else INK)
    c.drawString(40, H - 82, text)
    if subtitle:
        c.setFont("Arial", 11)
        c.setFillColor(Color(1, 1, 1, 0.68) if dark else MUTED)
        c.drawString(40, H - 106, subtitle)


def lines(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    size=13,
    leading=18,
    color=INK,
    font="Arial",
    max_lines=None,
):
    approx = max(8, int(width / (size * 0.55)))
    rows = []
    for paragraph in text.split("\n"):
        rows.extend(wrap(paragraph, width=approx, break_long_words=False) or [""])
    if max_lines:
        rows = rows[:max_lines]
    c.setFont(font, size)
    c.setFillColor(color)
    for row in rows:
        c.drawString(x, y, row)
        y -= leading
    return y


def pill(c: canvas.Canvas, text: str, x: float, y: float, fill=ORANGE_SOFT, color=ORANGE):
    width = pdfmetrics.stringWidth(text, "Arial-Bold", 9) + 24
    c.setFillColor(fill)
    c.roundRect(x, y - 15, width, 24, 12, fill=1, stroke=0)
    c.setFillColor(color)
    c.setFont("Arial-Bold", 9)
    c.drawString(x + 12, y - 7, text)
    return width


def bullet(c: canvas.Canvas, text: str, x: float, y: float, width: float, color=INK):
    c.setFillColor(ORANGE)
    c.circle(x + 4, y - 5, 3, fill=1, stroke=0)
    return lines(c, text, x + 18, y, width - 18, 12, 17, color)


def source(c: canvas.Canvas, text: str, url: str | None = None, dark=False):
    c.setFont("Arial", 6.6)
    c.setFillColor(Color(1, 1, 1, 0.5) if dark else MUTED)
    c.drawString(40, 22, text)
    if url:
        c.linkURL(url, (40, 16, min(W - 80, 40 + len(text) * 3.4), 30))


def card(c: canvas.Canvas, x, y, w, h, fill=WHITE, stroke=LINE, radius=12):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.7)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def metric(c: canvas.Canvas, value: str, label: str, x: float, y: float, width: float):
    c.setFont("Georgia-Bold", 26)
    c.setFillColor(INK)
    c.drawString(x, y, value)
    lines(c, label, x, y - 24, width, 9.5, 13, MUTED)


def cover(c: canvas.Canvas):
    background(c, NAVY)
    image, x, y, w, h = crop_image(MAP, 500, 0, 460, 540, anchor=(0.52, 0.55))
    c.drawImage(image, x, y, w, h, mask="auto")
    c.setFillColor(Color(0.02, 0.08, 0.11, 0.45))
    c.rect(480, 0, 480, 540, fill=1, stroke=0)
    brand(c, dark=True)
    pill(c, "ПИТЧДЕК 2026", 40, 455, fill=Color(1, 1, 1, 0.1), color=WHITE)
    lines(
        c,
        "Живая планета\nбрендов",
        40,
        388,
        440,
        size=42,
        leading=48,
        color=WHITE,
        font="Georgia-Bold",
    )
    lines(
        c,
        "Игровая рекламная платформа, где бренд покупает не баннер, а место в мире.",
        40,
        273,
        390,
        size=16,
        leading=23,
        color=Color(1, 1, 1, 0.78),
    )
    c.setStrokeColor(Color(1, 1, 1, 0.2))
    c.line(40, 102, 430, 102)
    c.setFont("Arial-Bold", 11)
    c.setFillColor(WHITE)
    c.drawString(40, 77, "Казахстан - MVP доступен онлайн")
    c.setFont("Arial", 9)
    c.setFillColor(Color(1, 1, 1, 0.58))
    c.drawString(40, 58, "brand-wars.vercel.app")
    c.linkURL("https://brand-wars.vercel.app/ru", (40, 50, 180, 70))


def problem(c: canvas.Canvas):
    background(c)
    brand(c)
    title(c, "Рынок уже digital. Форматы - всё ещё плоские.")
    metric(c, "19,5 млн", "интернет-пользователей в Казахстане на конец 2025 года", 40, 365, 230)
    metric(c, "93,4%", "проникновение интернета", 300, 365, 180)
    metric(c, "75,4 млрд ₸", "объём интернет-рекламы в 2025 году", 520, 365, 230)

    card(c, 40, 115, 880, 145, fill=WHITE)
    c.setFont("Georgia-Bold", 20)
    c.setFillColor(INK)
    c.drawString(64, 220, "Проблема рекламодателя")
    y = 188
    y = bullet(c, "Соцсети и поиск концентрируют бюджеты, но конкуренция за внимание растёт.", 64, y, 390)
    y = bullet(c, "Баннер заканчивается вместе с кампанией и не создаёт собственного пространства бренда.", 64, y - 7, 390)
    y2 = 188
    y2 = bullet(c, "Малым компаниям нужен заметный формат с безопасным тестовым бюджетом.", 510, y2, 350)
    bullet(c, "Крупным брендам нужны события и механики, которыми аудитория хочет делиться.", 510, y2 - 7, 350)
    source(
        c,
        "Факт: DataReportal Digital 2026 Kazakhstan; ЦАРА, итоги рекламного рынка Казахстана за 2025 год.",
        "https://datareportal.com/reports/digital-2026-kazakhstan",
    )
    page_no(c, 2)


def solution(c: canvas.Canvas):
    background(c, NAVY)
    brand(c, dark=True)
    title(c, "Реклама превращается в место", "Не показ. Не баннер. Территория бренда в общей истории.", dark=True)
    image, x, y, w, h = crop_image(MAP, 480, 35, 440, 430, anchor=(0.5, 0.5))
    c.drawImage(image, x, y, w, h, mask="auto")
    c.setStrokeColor(Color(1, 1, 1, 0.2))
    c.roundRect(x, y, w, h, 16, fill=0, stroke=1)

    y = 348
    for heading, body in [
        ("24 категории", "У каждой сферы свой материк: от туризма и еды до IT, финансов и B2B."),
        ("Ограниченная земля", "Клетки конечны. Раннее размещение даёт понятное преимущество."),
        ("Живой мир", "Территории меняются, персонажи взаимодействуют, бренды создают события."),
        ("Friendly competition", "Без оружия: тематические предметы, юмор и безопасная коммуникация."),
    ]:
        c.setFont("Arial-Bold", 13)
        c.setFillColor(WHITE)
        c.drawString(40, y, heading)
        y = lines(c, body, 40, y - 20, 390, 10.5, 15, Color(1, 1, 1, 0.68))
        y -= 17
    page_no(c, 3, dark=True)


def product_flow(c: canvas.Canvas):
    background(c)
    brand(c)
    title(c, "От ссылки до места - меньше минуты", "Работающий трёхшаговый flow на production-сайте.")
    image1, *box1 = crop_image(AUTO, 40, 58, 430, 350, anchor=(0.5, 0.43))
    image2, *box2 = crop_image(CHARACTER, 490, 58, 430, 350, anchor=(0.5, 0.32))
    c.drawImage(image1, *box1, mask="auto")
    c.drawImage(image2, *box2, mask="auto")
    c.setStrokeColor(LINE)
    c.roundRect(40, 58, 430, 350, 14, fill=0, stroke=1)
    c.roundRect(490, 58, 430, 350, 14, fill=0, stroke=1)
    pill(c, "1. ССЫЛКА + АВТОКАТЕГОРИЯ", 55, 395)
    pill(c, "2. ПЕРСОНАЖ + БЮДЖЕТ", 505, 395, fill=TEAL_SOFT, color=TEAL)
    page_no(c, 4)


def mechanics(c: canvas.Canvas):
    background(c)
    brand(c)
    title(c, "Простая экономика для первого теста")
    steps = [
        ("1 000 ₸", "первое размещение", "Бренд получает стартовую клетку после оплаты и модерации."),
        ("+500 ₸", "следующая клетка", "Пошаговый рост вместо обязательного крупного бюджета."),
        ("лимит", "материк конечен", "После заполнения внимание смещается к дружеским соревнованиям."),
    ]
    for index, (value, label, body) in enumerate(steps):
        x = 40 + index * 300
        card(c, x, 220, 270, 205, fill=WHITE)
        c.setFont("Georgia-Bold", 30)
        c.setFillColor(ORANGE if index < 2 else TEAL)
        c.drawString(x + 22, 365, value)
        c.setFont("Arial-Bold", 12)
        c.setFillColor(INK)
        c.drawString(x + 22, 333, label)
        lines(c, body, x + 22, 297, 220, 10.5, 16, MUTED)
    c.setFont("Georgia-Bold", 18)
    c.setFillColor(INK)
    c.drawString(40, 164, "Почему это покупают")
    bullet(c, "Низкий риск первого запуска", 40, 130, 260)
    bullet(c, "Видимый накопительный результат", 330, 130, 280)
    bullet(c, "Повод вернуться и поделиться", 640, 130, 280)
    c.setFont("Arial", 7)
    c.setFillColor(MUTED)
    c.drawString(40, 35, "Цены - текущая продуктовая модель BrandWars.kz. Показатели эффективности ещё требуют пилотной валидации.")
    page_no(c, 5)


def brand_value(c: canvas.Canvas):
    background(c, NAVY)
    brand(c, dark=True)
    title(c, "Что получает рекламодатель", dark=True)
    items = [
        ("OWNED PRESENCE", "Постоянное узнаваемое место, а не исчезающий рекламный слот."),
        ("CATEGORY CONTEXT", "Бренд сразу попадает к релевантным соседям и аудитории своей сферы."),
        ("SHAREABLE STORY", "Рост территории, персонажи и события создают материал для соцсетей."),
        ("LOW-COST TEST", "Первый эксперимент стоит 1 000 ₸, масштабирование идёт шагами."),
        ("CUSTOM IDENTITY", "Имя представителя, тип персонажа, одежда и тематические предметы."),
        ("MEASURABLE LOOP", "Просмотры, переходы, dwell time, повторные расширения и стоимость привлечения."),
    ]
    for idx, (heading, body) in enumerate(items):
        col = idx % 2
        row = idx // 2
        x = 40 + col * 455
        y = 390 - row * 112
        c.setFillColor(Color(1, 1, 1, 0.08))
        c.roundRect(x, y - 72, 425, 88, 12, fill=1, stroke=0)
        c.setFont("Arial-Bold", 10)
        c.setFillColor(HexColor("#89D5CC") if col else HexColor("#F5A97F"))
        c.drawString(x + 18, y - 7, heading)
        lines(c, body, x + 18, y - 31, 385, 10.5, 15, Color(1, 1, 1, 0.72))
    page_no(c, 6, dark=True)


def evidence(c: canvas.Canvas):
    background(c)
    brand(c)
    title(c, "Игровой формат имеет проверяемую логику")
    card(c, 40, 245, 420, 190, fill=WHITE)
    pill(c, "АКАДЕМИЧЕСКОЕ ИССЛЕДОВАНИЕ", 60, 410, fill=TEAL_SOFT, color=TEAL)
    c.setFont("Georgia-Bold", 23)
    c.setFillColor(INK)
    c.drawString(60, 350, "N = 200")
    lines(
        c,
        "Эксперимент 2024 года показал: advergaming повышал когнитивную, эмоциональную и поведенческую вовлечённость относительно статичной рекламы.",
        60,
        316,
        360,
        11,
        17,
        MUTED,
    )

    card(c, 500, 245, 420, 190, fill=WHITE)
    pill(c, "КЕЙС PHILIPS ONEBLADE", 520, 410)
    metric(c, "55 000 ч", "игрового времени в branded Fortnite map", 520, 350, 165)
    metric(c, "+11%", "consideration", 700, 350, 90)
    metric(c, "+28%", "продажи YoY, мужчины 18-30", 805, 350, 95)

    c.setFont("Georgia-Bold", 18)
    c.setFillColor(INK)
    c.drawString(40, 185, "Вывод для BrandWars")
    lines(
        c,
        "Игровой контекст способен усиливать внимание и отношение к бренду. Но чужой кейс не является прогнозом: собственный uplift нужно доказать пилотами, контрольными группами и аналитикой.",
        40,
        150,
        850,
        12,
        18,
        MUTED,
    )
    source(
        c,
        "Источники: Journal of Interactive Advertising (2024), DOI 10.1080/15252019.2024.2335398; The Drum, Philips OneBlade case study.",
        "https://doi.org/10.1080/15252019.2024.2335398",
    )
    page_no(c, 7)


def business_model(c: canvas.Canvas):
    background(c)
    brand(c)
    title(c, "Модель дохода: вход дешёвый, глубина растёт")
    rows = [
        ("Размещение", "1 000 ₸", "Первичная клетка + модерация"),
        ("Расширение", "500 ₸ / клетка", "Повторная транзакция, пока есть пространство"),
        ("Кастомизация", "проектная цена", "Персонажи, здания, анимации, предметы"),
        ("Материк-партнёр", "проектная цена", "Категорийное спонсорство и брендирование"),
        ("События", "проектная цена", "Тематические недели, механики, спецпроекты"),
    ]
    y = 397
    for idx, (product, price, value) in enumerate(rows):
        fill = WHITE if idx % 2 == 0 else HexColor("#F0F2EF")
        c.setFillColor(fill)
        c.roundRect(40, y - 48, 880, 54, 8, fill=1, stroke=0)
        c.setFont("Arial-Bold", 11)
        c.setFillColor(INK)
        c.drawString(58, y - 16, product)
        c.setFillColor(ORANGE if idx < 2 else TEAL)
        c.drawString(260, y - 16, price)
        c.setFont("Arial", 10)
        c.setFillColor(MUTED)
        c.drawString(445, y - 16, value)
        y -= 62
    c.setFont("Arial", 7)
    c.setFillColor(MUTED)
    c.drawString(40, 47, "Проектные цены не являются утверждённым прайсом. Их нужно валидировать переговорами с рекламодателями.")
    page_no(c, 8)


def scenario(c: canvas.Canvas):
    background(c, NAVY)
    brand(c, dark=True)
    title(c, "Сценарий роста, а не обещание", "Иллюстрация масштаба при разных уровнях product-market fit.", dark=True)
    scenarios = [
        ("ПИЛОТ", "100", "5 000 ₸", "0,5 млн ₸", "50 интервью + 100 платящих брендов"),
        ("КАЗАХСТАН", "500", "15 000 ₸", "7,5 млн ₸", "Категории, агентства, регулярные события"),
        ("МАСШТАБ", "2 000", "25 000 ₸", "50 млн ₸", "Спонсоры, premium-механики, региональный рост"),
    ]
    for idx, (name, brands, arpa, revenue, condition) in enumerate(scenarios):
        x = 40 + idx * 300
        c.setFillColor(Color(1, 1, 1, 0.08))
        c.roundRect(x, 155, 270, 260, 14, fill=1, stroke=0)
        c.setFont("Arial-Bold", 10)
        c.setFillColor(HexColor("#F5A97F") if idx == 0 else HexColor("#89D5CC"))
        c.drawString(x + 22, 383, name)
        c.setFont("Georgia-Bold", 27)
        c.setFillColor(WHITE)
        c.drawString(x + 22, 333, brands)
        c.setFont("Arial", 9)
        c.setFillColor(Color(1, 1, 1, 0.56))
        c.drawString(x + 22, 313, "платящих брендов")
        c.setFont("Arial-Bold", 15)
        c.setFillColor(WHITE)
        c.drawString(x + 22, 265, revenue)
        c.setFont("Arial", 9)
        c.setFillColor(Color(1, 1, 1, 0.56))
        c.drawString(x + 22, 247, f"выручка при среднем чеке {arpa}")
        lines(c, condition, x + 22, 205, 225, 9.5, 14, Color(1, 1, 1, 0.7))
    c.setFont("Arial", 7)
    c.setFillColor(Color(1, 1, 1, 0.45))
    c.drawString(40, 74, "Расчёт: число платящих брендов x совокупный средний чек. Не включает комиссии, налоги и операционные расходы.")
    page_no(c, 9, dark=True)


def go_to_market(c: canvas.Canvas):
    background(c)
    brand(c)
    title(c, "Go-to-market: сначала плотность, потом география")
    phases = [
        ("0-3 мес.", "ПИЛОТ", ["4 сферы: travel, food, IT, beauty", "50 дизайн-партнёров", "Проверка оплаты и retention"]),
        ("3-6 мес.", "ПЛОТНОСТЬ", ["100-500 платящих брендов", "Еженедельные события", "Партнёрства с агентствами"]),
        ("6-12 мес.", "МОНЕТИЗАЦИЯ", ["Спонсорство материков", "Premium-кастомизация", "Дашборд доказуемого эффекта"]),
        ("12-24 мес.", "ЭКСПАНСИЯ", ["Другие города Казахстана", "Локализация под рынки СНГ", "Только после подтверждения PMF"]),
    ]
    c.setStrokeColor(LINE)
    c.setLineWidth(2)
    c.line(95, 315, 865, 315)
    for idx, (period, name, bullets) in enumerate(phases):
        x = 70 + idx * 220
        c.setFillColor(ORANGE if idx == 0 else TEAL)
        c.circle(x + 25, 315, 8, fill=1, stroke=0)
        c.setFont("Arial-Bold", 10)
        c.setFillColor(ORANGE if idx == 0 else TEAL)
        c.drawString(x, 347, period)
        c.setFont("Georgia-Bold", 14)
        c.setFillColor(INK)
        c.drawString(x, 280, name)
        y = 250
        for item in bullets:
            y = bullet(c, item, x, y, 185)
            y -= 8
    card(c, 40, 65, 880, 80, fill=ORANGE_SOFT, stroke=ORANGE_SOFT)
    c.setFont("Arial-Bold", 12)
    c.setFillColor(ORANGE)
    c.drawString(60, 114, "Принцип запуска")
    lines(c, "Не распылять пустую планету. Сначала сделать 4 материка плотными и интересными, затем открывать новые.", 60, 90, 820, 11, 16, INK)
    page_no(c, 10)


def metrics_slide(c: canvas.Canvas):
    background(c)
    brand(c)
    title(c, "Что должно доказать MVP")
    metrics = [
        ("Paid brands / month", "Есть ли реальный спрос, а не только интерес"),
        ("30-day repeat spend", "Возвращаются ли бренды расширять территорию"),
        ("Expansion revenue share", "Работает ли накопительная модель"),
        ("CAC payback", "Можно ли масштабировать привлечение"),
        ("Dwell time + CTR", "Даёт ли игровой формат больше внимания"),
        ("Organic share rate", "Создаёт ли продукт собственную дистрибуцию"),
    ]
    for idx, (name, why) in enumerate(metrics):
        col = idx % 3
        row = idx // 3
        x = 40 + col * 300
        y = 265 if row else 385
        c.setFont("Georgia-Bold", 15)
        c.setFillColor(INK)
        c.drawString(x, y, name)
        lines(c, why, x, y - 27, 255, 10, 15, MUTED)
        c.setStrokeColor(LINE)
        c.line(x, y - 77, x + 255, y - 77)
    card(c, 40, 55, 880, 82, fill=TEAL_SOFT, stroke=TEAL_SOFT)
    c.setFont("Arial-Bold", 12)
    c.setFillColor(TEAL)
    c.drawString(60, 105, "Правильная цель первых 90 дней")
    lines(c, "Не максимальная выручка. Доказательство того, что компании платят повторно, потому что территория и аудитория имеют ценность.", 60, 81, 820, 11, 16, INK)
    page_no(c, 11)


def status_slide(c: canvas.Canvas):
    background(c)
    brand(c)
    title(c, "Сегодня: работающий MVP и понятный следующий шаг")
    image, x, y, w, h = crop_image(CLAIM, 545, 75, 375, 360, anchor=(0.5, 0.45))
    c.drawImage(image, x, y, w, h, mask="auto")
    c.setStrokeColor(LINE)
    c.roundRect(x, y, w, h, 14, fill=0, stroke=1)
    y0 = 390
    done = [
        "Интерактивная вымышленная планета",
        "24 отраслевые категории",
        "Автоподбор категории по сайту",
        "Персонаж и цвет бренда",
        "Flow: ссылка - детали - оплата",
        "Production deployment на Vercel",
    ]
    for item in done:
        c.setFillColor(TEAL)
        c.circle(48, y0 - 4, 5, fill=1, stroke=0)
        c.setFont("Arial-Bold", 11)
        c.setFillColor(INK)
        c.drawString(64, y0 - 8, item)
        y0 -= 43
    c.setFillColor(ORANGE_SOFT)
    c.roundRect(40, 62, 455, 72, 12, fill=1, stroke=0)
    c.setFont("Arial-Bold", 11)
    c.setFillColor(ORANGE)
    c.drawString(60, 106, "Следующий milestone")
    lines(c, "10-20 платных пилотов, подтверждённая аналитика и первая повторная покупка клеток.", 60, 84, 400, 10.5, 15, INK)
    page_no(c, 12)


def ask_slide(c: canvas.Canvas):
    background(c, NAVY)
    brand(c, dark=True)
    pill(c, "ПРИГЛАШЕНИЕ К ПИЛОТУ", 40, 443, fill=Color(1, 1, 1, 0.1), color=WHITE)
    lines(
        c,
        "Станьте одним из первых\nбрендов на планете",
        40,
        365,
        700,
        34,
        43,
        WHITE,
        "Georgia-Bold",
    )
    lines(
        c,
        "Нам нужны рекламодатели, агентства и партнёры категорий, готовые вместе проверить новый формат.",
        40,
        246,
        650,
        14,
        21,
        Color(1, 1, 1, 0.72),
    )
    c.setFillColor(ORANGE)
    c.roundRect(40, 140, 252, 48, 10, fill=1, stroke=0)
    c.setFont("Arial-Bold", 12)
    c.setFillColor(WHITE)
    c.drawCentredString(166, 157, "Открыть BrandWars.kz")
    c.linkURL("https://brand-wars.vercel.app/ru", (40, 140, 292, 188))
    c.setFont("Arial", 9)
    c.setFillColor(Color(1, 1, 1, 0.52))
    c.drawString(40, 103, "brand-wars.vercel.app/ru")
    c.drawString(40, 84, "Размещение от 1 000 ₸")
    page_no(c, 13, dark=True)


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    for required in (MAP, CLAIM, AUTO, CHARACTER):
        if not required.exists():
            raise FileNotFoundError(required)

    c = canvas.Canvas(str(OUTPUT), pagesize=(W, H))
    c.setTitle("BrandWars.kz - Pitch Deck 2026")
    c.setAuthor("BrandWars.kz")
    slides = [
        cover,
        problem,
        solution,
        product_flow,
        mechanics,
        brand_value,
        evidence,
        business_model,
        scenario,
        go_to_market,
        metrics_slide,
        status_slide,
        ask_slide,
    ]
    for slide in slides:
        slide(c)
        c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
