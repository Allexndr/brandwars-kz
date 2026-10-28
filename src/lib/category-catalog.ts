export const ENTRY_PRICE_KZT = 1000;
export const TERRITORY_CELL_PRICE_KZT = 500;

export type CategoryDefinition = {
  slug: string;
  nameRu: string;
  nameKk: string;
  continentRu: string;
  continentKk: string;
  color: string;
  keywords: string[];
};

export const CATEGORY_CATALOG: CategoryDefinition[] = [
  {
    slug: "travel",
    nameRu: "Туризм и путешествия",
    nameKk: "Туризм және саяхат",
    continentRu: "Травелия",
    continentKk: "Травелия",
    color: "#38BDF8",
    keywords: ["travel", "tour", "hotel", "flight", "авиа", "тур", "отель", "билет", "avia", "aviabilet", "turizm", "otel", "trip", "fly", "ticket", "saya"],
  },
  {
    slug: "food",
    nameRu: "Еда и рестораны",
    nameKk: "Тағам және мейрамханалар",
    continentRu: "Гастроленд",
    continentKk: "Гастроленд",
    color: "#F97316",
    keywords: ["food", "restaurant", "cafe", "еда", "ресторан", "кафе", "доставка еды", "eda", "restoran", "kafe", "dostavka", "pizza", "sushi", "kofe", "tamak"],
  },
  {
    slug: "retail",
    nameRu: "Магазины и маркетплейсы",
    nameKk: "Дүкендер және маркетплейстер",
    continentRu: "Торговый архипелаг",
    continentKk: "Сауда архипелагы",
    color: "#F59E0B",
    keywords: ["shop", "store", "market", "retail", "магазин", "товар", "маркетплейс", "magazin", "tovar", "mall", "bazar", "dukan"],
  },
  {
    slug: "beauty",
    nameRu: "Красота и уход",
    nameKk: "Сұлулық және күтім",
    continentRu: "Бьюти-республика",
    continentKk: "Бьюти-республика",
    color: "#EC4899",
    keywords: ["beauty", "cosmetic", "salon", "космет", "салон", "красот", "уход", "krasota", "kosmet", "spa", "nail", "barber", "sulu"],
  },
  {
    slug: "fashion",
    nameRu: "Одежда и мода",
    nameKk: "Киім және сән",
    continentRu: "Модалия",
    continentKk: "Модалия",
    color: "#C026D3",
    keywords: ["fashion", "clothes", "wear", "одеж", "мода", "обув", "fashion", "odezhda", "moda", "style", "boutique", "kiim"],
  },
  {
    slug: "health",
    nameRu: "Здоровье и медицина",
    nameKk: "Денсаулық және медицина",
    continentRu: "Виталис",
    continentKk: "Виталис",
    color: "#10B981",
    keywords: ["health", "clinic", "medical", "doctor", "клиник", "медиц", "врач", "здоров", "zdorov", "klinik", "med", "stomat", "dental", "apteka", "pharm", "densaulyq"],
  },
  {
    slug: "fitness",
    nameRu: "Спорт и фитнес",
    nameKk: "Спорт және фитнес",
    continentRu: "Атлетика",
    continentKk: "Атлетика",
    color: "#22C55E",
    keywords: ["sport", "fitness", "gym", "спорт", "фитнес", "зал", "тренер", "fitnes", "yoga", "crossfit", "trener"],
  },
  {
    slug: "education",
    nameRu: "Образование и курсы",
    nameKk: "Білім және курстар",
    continentRu: "Академия",
    continentKk: "Академия",
    color: "#EAB308",
    keywords: ["education", "course", "school", "academy", "курс", "школ", "обуч", "универс", "obraz", "kurs", "shkola", "edu", "bilim", "mektep", "universit"],
  },
  {
    slug: "finance",
    nameRu: "Финансы и финтех",
    nameKk: "Қаржы және финтех",
    continentRu: "Финополис",
    continentKk: "Финополис",
    color: "#14B8A6",
    keywords: ["bank", "finance", "fintech", "payment", "банк", "финанс", "оплат", "кредит", "finans", "kredit", "invest", "insur", "strah", "qarjy", "kaspi"],
  },
  {
    slug: "real-estate",
    nameRu: "Недвижимость и строительство",
    nameKk: "Жылжымайтын мүлік және құрылыс",
    continentRu: "Доминион",
    continentKk: "Доминион",
    color: "#A16207",
    keywords: ["real estate", "property", "build", "недвиж", "строит", "квартир", "дом", "nedvizh", "krisha", "kvartir", "realty", "estate", "zhilye"],
  },
  {
    slug: "auto",
    nameRu: "Авто и транспорт",
    nameKk: "Авто және көлік",
    continentRu: "Мотория",
    continentKk: "Мотория",
    color: "#64748B",
    keywords: ["auto", "car", "motor", "авто", "машин", "транспорт", "такси", "avto", "kolesa", "mashina", "taxi", "drive", "kolik"],
  },
  {
    slug: "logistics",
    nameRu: "Логистика и доставка",
    nameKk: "Логистика және жеткізу",
    continentRu: "Карголенд",
    continentKk: "Карголенд",
    color: "#D97706",
    keywords: ["logistic", "delivery", "cargo", "достав", "логист", "курьер", "груз", "dostavk", "logist", "kurier", "courier", "express", "post"],
  },
  {
    slug: "code",
    nameRu: "IT и разработка",
    nameKk: "IT және әзірлеу",
    continentRu: "Кодверс",
    continentKk: "Кодверс",
    color: "#06B6D4",
    keywords: ["software", "developer", "website", "app", "разработ", "сайт", "программ", "crm", "dev", "studio", "digital", "saas", "code", "web"],
  },
  {
    slug: "ai-agents",
    nameRu: "AI и автоматизация",
    nameKk: "AI және автоматтандыру",
    continentRu: "Агентория",
    continentKk: "Агентория",
    color: "#8B5CF6",
    keywords: ["ai", "agent", "automation", "нейро", "искусствен", "автоматиза", "бот", "neuro", "gpt", "llm", "assistant", "chatbot"],
  },
  {
    slug: "telecom",
    nameRu: "Связь и телеком",
    nameKk: "Байланыс және телеком",
    continentRu: "Сигналия",
    continentKk: "Сигналия",
    color: "#2563EB",
    keywords: ["telecom", "mobile", "internet", "связ", "телеком", "интернет", "оператор", "svyaz", "beeline", "tele2"],
  },
  {
    slug: "security",
    nameRu: "Безопасность",
    nameKk: "Қауіпсіздік",
    continentRu: "Щитоград",
    continentKk: "Қалқанқала",
    color: "#475569",
    keywords: ["security", "cyber", "guard", "безопас", "охран", "защит", "кибер", "bezopas", "ohrana", "vpn", "antivirus"],
  },
  {
    slug: "marketing",
    nameRu: "Маркетинг и реклама",
    nameKk: "Маркетинг және жарнама",
    continentRu: "Маркетленд",
    continentKk: "Маркетленд",
    color: "#EF4444",
    keywords: ["marketing", "advert", "agency", "маркет", "реклам", "smm", "агентство", "reklama", "seo", "brand"],
  },
  {
    slug: "media",
    nameRu: "Медиа и контент",
    nameKk: "Медиа және контент",
    continentRu: "Медиасфера",
    continentKk: "Медиасфера",
    color: "#FB7185",
    keywords: ["media", "content", "video", "медиа", "контент", "видео", "новост", "news", "blog", "podcast", "tv", "radio"],
  },
  {
    slug: "games",
    nameRu: "Игры и развлечения",
    nameKk: "Ойындар және ойын-сауық",
    continentRu: "Игровые острова",
    continentKk: "Ойын аралдары",
    color: "#7C3AED",
    keywords: ["game", "play", "entertainment", "игр", "развлеч", "киберспорт", "igra", "esport", "gaming", "oiyn"],
  },
  {
    slug: "events",
    nameRu: "События и праздники",
    nameKk: "Іс-шаралар және мерекелер",
    continentRu: "Фестивалия",
    continentKk: "Фестивалия",
    color: "#DB2777",
    keywords: ["event", "party", "wedding", "событ", "празд", "свадьб", "ивент", "prazdnik", "svadba", "toi", "fest"],
  },
  {
    slug: "home",
    nameRu: "Дом и интерьер",
    nameKk: "Үй және интерьер",
    continentRu: "Уютория",
    continentKk: "Жайлылық",
    color: "#84CC16",
    keywords: ["home", "furniture", "interior", "мебел", "интерьер", "ремонт", "дом", "mebel", "remont", "interier", "uyut", "decor"],
  },
  {
    slug: "agro",
    nameRu: "Агро и продукты",
    nameKk: "Агро және өнімдер",
    continentRu: "Агролия",
    continentKk: "Агролия",
    color: "#65A30D",
    keywords: ["agro", "farm", "food production", "агро", "ферм", "сельхоз", "продукт", "ferma", "eco", "organic", "auyl"],
  },
  {
    slug: "b2b",
    nameRu: "B2B и услуги для бизнеса",
    nameKk: "B2B және бизнес қызметтері",
    continentRu: "Деловой союз",
    continentKk: "Іскерлік одақ",
    color: "#0F766E",
    keywords: ["b2b", "business", "consult", "бизнес", "консалт", "аутсорс", "услуг", "outsourc", "buhgalt", "jurist", "legal", "hr"],
  },
  {
    slug: "other",
    nameRu: "Другие бренды",
    nameKk: "Басқа брендтер",
    continentRu: "Новые земли",
    continentKk: "Жаңа жерлер",
    color: "#78716C",
    keywords: [],
  },
];

export function suggestCategory(text: string): CategoryDefinition {
  const normalized = text.toLowerCase();
  let best = CATEGORY_CATALOG[CATEGORY_CATALOG.length - 1];
  let score = 0;

  for (const category of CATEGORY_CATALOG) {
    const matches = category.keywords.reduce(
      (total, keyword) => total + (normalized.includes(keyword) ? 1 : 0),
      0,
    );
    if (matches > score) {
      score = matches;
      best = category;
    }
  }

  return best;
}
