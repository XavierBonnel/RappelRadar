"use strict";
// ===================================================================
// RappelRadar — app.js
// Fusion rappel-radar (design) + webapp-alerte-conso (API + routing)
// ===================================================================

// ── CONSTANTES ──────────────────────────────────────────────────────
const STORAGE_KEY   = "rappelradar_liste";
const RAPPEL_API_URL = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records";
const API_TIMEOUT   = 8000;

// ── ÉTAT GLOBAL ─────────────────────────────────────────────────────
let recallsData    = [];
let recallsLoading = false;
let recallsUsedMock = false;
let prevPage = "#accueil";

let activeRisk     = "all";
let activeCategory = "all";
let activeSort     = "date";
let activeDays     = "30";

let searchTerm = "";
let activeDistributorName = null;

// ── UTILITAIRE DEBOUNCE ──────────────────────────────────────────────
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ── MOCK DATA (dates mises à jour pour rendre les filtres testables) ─
const MOCK_RECALLS = [
  {
    code: "3271234567890",
    name: "Lait demi-écrémé UHT 1L",
    brand: "U",
    category: "Alimentaire",
    distributor: "U Express, Super U",
    reason: "Anomalie sur la date de péremption — plusieurs lots retirés par mesure de précaution. Ne consommez pas les produits portant le code indiqué sur l'emballage.",
    severity: "preventif",
    date: "23/04/2026",
    image: "https://images.openfoodfacts.org/images/products/325/622/000/5921/front_fr.264.400.jpg",
    source: "rappel.conso.gouv.fr"
  },
  {
    code: "3489771003485",
    name: "Filets de poulet rôtis aux herbes de Provence",
    brand: "Leclerc",
    category: "Alimentaire",
    distributor: "E.Leclerc",
    reason: "Risque de présence de Listeria monocytogenes. Ne consommez pas ce produit et rapportez-le en magasin.",
    severity: "danger",
    date: "21/04/2026",
    image: "https://images.openfoodfacts.org/images/products/348/977/100/3485/front_fr.276.400.jpg",
    source: "rappel.conso.gouv.fr"
  },
  {
    code: "3268840001055",
    name: "Compote de pommes sans sucre ajouté",
    brand: "Mademoiselle Desserts",
    category: "Alimentaire",
    distributor: "Biocoop",
    reason: "Conditionnement défectueux — risque de moisissures. Les lots indiqués sont concernés.",
    severity: "preventif",
    date: "16/04/2026",
    image: "https://images.openfoodfacts.org/images/products/326/884/000/1055/front_fr.276.400.jpg",
    source: "rappel.conso.gouv.fr"
  },
  {
    code: "3175900012210",
    name: "Gommage corps exfoliant corps entier",
    brand: "Le Petit Marseillais",
    category: "Cosmétiques",
    distributor: "Carrefour",
    reason: "Risque microbiologique détecté lors des contrôles DGCCRF. Cessez l'utilisation et rapportez le produit.",
    severity: "danger",
    date: "10/04/2026",
    image: "https://images.openfoodfacts.org/images/products/317/590/001/2210/front_fr.276.400.jpg",
    source: "rappel.conso.gouv.fr"
  },
  {
    code: "3564700953294",
    name: "Barres chocolatées au lait pack x6",
    brand: "Carrefour",
    category: "Alimentaire",
    distributor: "Carrefour",
    reason: "Traces de polyéthylène — ne pas consommer. Rappel officiel DGCCRF.",
    severity: "danger",
    date: "01/04/2026",
    image: "https://images.openfoodfacts.org/images/products/356/470/095/3294/front_fr.276.400.jpg",
    source: "rappel.conso.gouv.fr"
  },
  {
    code: "3306949165722",
    name: "Doudoune garçon 4-6 ans avec capuche",
    brand: "Kiabi",
    category: "Vêtements",
    distributor: "Kiabi",
    reason: "Cordons de capuche — risque de strangulation pour les enfants. Retrait du marché européen.",
    severity: "danger",
    date: "25/03/2026",
    image: "",
    source: "rappel.conso.gouv.fr"
  },
  {
    code: "3401593201071",
    name: "Puzzle éducatif en bois 100 pièces",
    brand: "Janod",
    category: "Jouets",
    distributor: "JouéClub",
    reason: "Petites pièces détachables — risque d'étouffement pour les enfants de 0 à 3 ans.",
    severity: "danger",
    date: "10/03/2026",
    image: "",
    source: "rappel.conso.gouv.fr"
  },
  {
    code: "8806098193941",
    name: "Chargeur rapide USB-C 25W officiel",
    brand: "Samsung",
    category: "Électronique",
    distributor: "Boulanger",
    reason: "Risque de surchauffe et de brûlure. Rappel officiel DGCCRF.",
    severity: "danger",
    date: "20/02/2026",
    image: "",
    source: "rappel.conso.gouv.fr"
  },
  {
    code: "3760171840029",
    name: "Crème hydratante Visage Rose Mosquée",
    brand: "L'Atelier des 3 Fontaines",
    category: "Cosmétiques",
    distributor: "Nocibé",
    reason: "Non-conformité cosmétique — présence de substances non autorisées.",
    severity: "information",
    date: "15/02/2026",
    image: "https://images.openfoodfacts.org/images/products/376/017/184/0029/front_fr.276.400.jpg",
    source: "rappel.conso.gouv.fr"
  },
  {
    code: "3228887000508",
    name: "Yaourt à la grecque nature 4x125g",
    brand: "Casino",
    category: "Alimentaire",
    distributor: "Casino",
    reason: "Anomalie de fermentation détectée sur certains lots. Par précaution, ne pas consommer.",
    severity: "preventif",
    date: "10/01/2026",
    image: "https://images.openfoodfacts.org/images/products/322/888/700/0508/front_fr.276.400.jpg",
    source: "rappel.conso.gouv.fr"
  }
];

// ── TERMES GÉNÉRIQUES À EXCLURE DU CLASSEMENT ────────────────────────
const DISTRIBUTOR_BLACKLIST = [
  "boucherie", "boulangerie", "charcuterie", "épicerie", "poissonnerie",
  "primeur", "traiteur", "sandwicherie", "supérette", "fromagerie",
  "épicerie fine", "cave", "caviste", "rôtisserie", "rotisserie",
  "crêperie", "creperie", "pizzeria", "restaurant", "snack", "kebab",
  "pâtisserie", "patisserie", "confiserie", "torréfacteur"
];

// ── MAPPING DISTRIBUTEURS → LOGOS ────────────────────────────────────
const DISTRIBUTOR_MAP = [
  { keys: ["leclerc", "e.leclerc", "e leclerc"],                            domain: "e.leclerc",          name: "E.Leclerc" },
  { keys: ["carrefour", "market carrefour", "carrefour market",
           "carrefour city", "carrefour express", "carrefour contact"],     domain: "carrefour.fr",       name: "Carrefour" },
  { keys: ["intermarché", "intermarche", "netto"],                          domain: "intermarche.com",    name: "Intermarché" },
  { keys: ["système u", "systeme u", "super u", "u express",
           "hyper u", "marché u", "utile", "super-u"],                      domain: "magasins-u.com",     name: "Système U" },
  { keys: ["auchan", "simply market", "auchan supermarché"],                domain: "auchan.fr",          name: "Auchan" },
  { keys: ["lidl"],                                                         domain: "lidl.fr",            name: "Lidl" },
  { keys: ["aldi"],                                                         domain: "aldi.fr",            name: "Aldi" },
  { keys: ["casino", "leader price", "géant casino", "geant casino",
           "spar", "vival", "petit casino"],                                domain: "groupe-casino.fr",   name: "Casino" },
  { keys: ["cora"],                                                         domain: "cora.fr",            name: "Cora" },
  { keys: ["colruyt"],                                                      domain: "colruyt.fr",         name: "Colruyt" },
  { keys: ["monoprix"],                                                     domain: "monoprix.fr",        name: "Monoprix" },
  { keys: ["franprix"],                                                     domain: "franprix.fr",        name: "Franprix" },
  { keys: ["biocoop"],                                                      domain: "biocoop.fr",         name: "Biocoop" },
  { keys: ["bio c'bon", "bio c bon"],                                       domain: "bio-c-bon.eu",       name: "Bio c' Bon" },
  { keys: ["naturalia"],                                                    domain: "naturalia.fr",       name: "Naturalia" },
  { keys: ["thiriet"],                                                      domain: "thiriet.com",        name: "Thiriet" },
  { keys: ["picard"],                                                       domain: "picard.fr",          name: "Picard" },
  { keys: ["metro", "metro cash & carry"],                                  domain: "metro.fr",           name: "Metro" },
  { keys: ["boulanger"],                                                    domain: "boulanger.com",      name: "Boulanger" },
  { keys: ["fnac"],                                                         domain: "fnac.com",           name: "Fnac" },
  { keys: ["darty"],                                                        domain: "darty.com",          name: "Darty" },
  { keys: ["nocibé", "nocibe"],                                             domain: "nocibe.fr",          name: "Nocibé" },
  { keys: ["sephora"],                                                      domain: "sephora.fr",         name: "Sephora" },
  { keys: ["kiabi"],                                                        domain: "kiabi.com",          name: "Kiabi" },
  { keys: ["decathlon"],                                                    domain: "decathlon.fr",       name: "Decathlon" },
  { keys: ["amazon"],                                                       domain: "amazon.fr",          name: "Amazon" },
  { keys: ["jouéclub", "joueclub", "joué club"],                            domain: "joueclub.fr",        name: "JouéClub" },
  { keys: ["king jouet", "king-jouet"],                                     domain: "king-jouet.com",     name: "King Jouet" },
  { keys: ["picwic"],                                                       domain: "picwictoys.com",     name: "Picwic Toys" },
  { keys: ["ikea"],                                                         domain: "ikea.com",           name: "IKEA" },
  { keys: ["action"],                                                       domain: "action.com",         name: "Action" },
  { keys: ["maisons du monde"],                                             domain: "maisonsdumonde.com", name: "Maisons du Monde" },
  { keys: ["leroy merlin"],                                                 domain: "leroymerlin.fr",     name: "Leroy Merlin" },
  { keys: ["bricomarché", "bricomarche"],                                   domain: "bricomarche.com",    name: "Bricomarché" },
  { keys: ["castorama"],                                                    domain: "castorama.fr",       name: "Castorama" },
  { keys: ["brico dépôt", "brico depot"],                                   domain: "bricodepot.fr",      name: "Brico Dépôt" },
  { keys: ["jardiland"],                                                    domain: "jardiland.com",      name: "Jardiland" },
  { keys: ["la grande épicerie", "grande épicerie"],                        domain: "lagrandeepicerie.com", name: "La Grande Épicerie" },
  { keys: ["cultura"],                                                      domain: "cultura.com",        name: "Cultura" },
  { keys: ["leclerc drive", "e.leclerc drive"],                             domain: "leclercdrive.fr",    name: "E.Leclerc Drive" },
];

function matchDistributor(name) {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  for (let i = 0; i < DISTRIBUTOR_MAP.length; i++) {
    const d = DISTRIBUTOR_MAP[i];
    if (d.keys.some(function(k) { return n.includes(k); })) return d;
  }
  return null;
}

function logoSrc(match) {
  if (match.logoUrl) return match.logoUrl;
  return 'https://www.google.com/s2/favicons?domain=' + match.domain + '&sz=256';
}

function distributorLogoHTML(distributorName, size) {
  if (!distributorName) return "";
  const match = matchDistributor(distributorName);
  if (!match) return "";
  const s = size || 18;
  const src = logoSrc(match);
  const fallback = 'https://www.google.com/s2/favicons?domain=' + match.domain + '&sz=256';
  const onerr = match.logoUrl
    ? 'this.onerror=null;this.src=\'' + fallback + '\''
    : 'this.style.display=\'none\'';
  return '<img src="' + src + '" alt="' + htmlEncode(match.name) + '" class="dist-logo" ' +
    'width="' + s + '" height="' + s + '" onerror="' + onerr + '">';
}

// ===================================================================
// UTILS
// ===================================================================

function htmlEncode(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function categoryIcon(cat) {
  const m = {
    "Alimentaire":  "🍎",
    "Médicaments":  "💊",
    "Cosmétiques":  "💄",
    "Jouets":       "🧸",
    "Électronique": "⚡",
    "Vêtements":    "👕",
    "Maison":       "🏠"
  };
  return m[cat] || "📦";
}

function normalizeCategory(cat) {
  if (!cat) return "Autre";
  const c = cat.toLowerCase();
  if (/aliment|boisson|épicerie|viande|poisson|fruits|légume|fromage|lait|charcuterie/.test(c)) return "Alimentaire";
  if (/médicament|pharma|ansm/.test(c)) return "Médicaments";
  if (/cosmétique|hygiène|soin|beauté|maquillage|parfum/.test(c)) return "Cosmétiques";
  if (/jouet|enfant|puériculture|bébé|jeu/.test(c)) return "Jouets";
  if (/électron|électrique|appareil|informatique|high-tech|téléphone|chargeur/.test(c)) return "Électronique";
  if (/vêtement|textile|habillement|mode|habit|lingerie/.test(c)) return "Vêtements";
  if (/maison|ménager|cuisine|mobilier/.test(c)) return "Maison";
  return cat;
}

function computeSeverity(risque) {
  const r = (risque || "").toLowerCase();
  if (/chimique|microbiologique|matière étrangère|dangereux/.test(r)) return "danger";
  if (/préventif|précaution/.test(r)) return "preventif";
  return "information";
}

function severityBadge(severity) {
  if (severity === "danger")      return '<span class="badge badge-danger">🔴 Critique</span>';
  if (severity === "preventif")   return '<span class="badge badge-preventif">🟠 Important</span>';
  return '<span class="badge badge-information">🟢 Info</span>';
}

function severityBadgeLarge(severity) {
  if (severity === "danger")    return '<span class="badge-lg sev-danger">🚨 Danger critique</span>';
  if (severity === "preventif") return '<span class="badge-lg sev-preventif">🟧 Rappel préventif</span>';
  return '<span class="badge-lg sev-information">ℹ️ Information</span>';
}

function isNew(dateStr) {
  try {
    const parts = dateStr.split("/");
    const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    const now = new Date();
    return (now - d) < 7 * 24 * 60 * 60 * 1000;
  } catch (e) { return false; }
}

function relativeDate(dateStr) {
  try {
    const parts = dateStr.split("/");
    const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7)  return "Il y a " + diffDays + "j";
    if (diffDays < 30) return "Il y a " + Math.floor(diffDays / 7) + " sem.";
    return "Il y a " + Math.floor(diffDays / 30) + " mois";
  } catch (e) { return dateStr; }
}

function parseFrDate(dateStr) {
  try {
    const p = dateStr.split("/");
    return new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
  } catch (e) { return new Date(0); }
}

function imgHTML(src, name, cls) {
  if (!src) return '<span>' + categoryIcon(name) + '</span>';
  const safe = htmlEncode(src);
  const safeName = htmlEncode(name);
  return '<img src="' + safe + '" alt="' + safeName + '" onerror="this.parentNode.innerHTML=\'<span>📦</span>\'">';
}

// ===================================================================
// DISTRIBUTOR RANKING
// ===================================================================

function computeDistributorRanking(data) {
  const counts = {};
  data.forEach(function(p) {
    if (!p.distributor) return;
    const parts = p.distributor.split(/[,;]/).map(function(s) { return s.trim(); }).filter(Boolean);
    parts.forEach(function(d) {
      const dLower = d.toLowerCase();
      if (DISTRIBUTOR_BLACKLIST.some(function(b) {
        return dLower === b || dLower === b + "s" ||
               dLower.startsWith(b + " ") || dLower.startsWith(b + "s ");
      })) return;
      const match = matchDistributor(d);
      const key = match ? match.name : d;
      if (!counts[key]) counts[key] = { name: key, count: 0, match: match, raw: d };
      counts[key].count++;
    });
  });
  return Object.values(counts)
    .sort(function(a, b) { return b.count - a.count; })
    .slice(0, 5);
}

function renderDistributorPodium(ranking) {
  if (!ranking || ranking.length === 0) return "";

  const medals = ["🥇", "🥈", "🥉"];
  const maxCount = ranking[0].count;

  // Affichage ascendant : du moins rappelé (gauche 🥇) au plus rappelé (droite)
  const displayItems = ranking.slice().reverse();

  const items = displayItems.map(function(item, i) {
    const medal = medals[i] || ("#" + (i + 1));
    const isFirst = i === 0;
    const pct = Math.max(18, Math.round((item.count / maxCount) * 100));
    const logoEl = (function() {
      if (!item.match || !item.match.domain) return "";
      const src = logoSrc(item.match);
      const fallback = 'https://www.google.com/s2/favicons?domain=' + item.match.domain + '&sz=256';
      const onerr = item.match.logoUrl
        ? 'this.onerror=null;this.src=\'' + fallback + '\''
        : 'this.style.display=\'none\'';
      return '<img src="' + src + '" alt="' + htmlEncode(item.name) + '" class="podium-logo-img" onerror="' + onerr + '">';
    })();
    const safeName = htmlEncode(item.name).replace(/'/g, "&#39;");

    return (
      '<div class="podium-item' + (isFirst ? " podium-first" : "") + '" ' +
           'onclick="filterByDistributor(\'' + safeName + '\')" title="Voir les rappels ' + safeName + '">' +
        '<div class="podium-medal">' + medal + '</div>' +
        '<div class="podium-logo-wrap">' + logoEl + '</div>' +
        '<div class="podium-name">' + htmlEncode(item.name) + '</div>' +
        '<div class="podium-bar-wrap">' +
          '<div class="podium-bar" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<div class="podium-count">' + item.count + ' rappel' + (item.count > 1 ? 's' : '') + '</div>' +
      '</div>'
    );
  }).join("");

  return (
    '<div class="distributor-podium">' +
      '<div class="section-header">' +
        '<div>' +
          '<div class="section-title">🏆 Classement distributeurs</div>' +
          '<div class="section-subtitle">Du moins au plus de rappels officiels · cliquez pour filtrer</div>' +
        '</div>' +
      '</div>' +
      '<div class="podium-grid">' + items + '</div>' +
    '</div>'
  );
}

function filterByDistributor(name) {
  activeDistributorName = name;
  searchTerm = "";
  const navInput = document.getElementById("navSearchInput");
  if (navInput) navInput.value = "";
  navigateTo("#alertes");
}

function clearDistributorFilter() {
  activeDistributorName = null;
  const row = document.getElementById("distFilterRow");
  if (row) row.style.display = "none";
  el_reRenderAlertes();
}

// ===================================================================
// WATCHLIST (localStorage)
// ===================================================================

function getListe() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch (e) { return []; }
}

function saveListe(liste) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(liste));
}

function addToListe(product) {
  const liste = getListe();
  if (!liste.some(function(p) { return p.code === product.code; })) {
    liste.unshift(Object.assign({}, product, { addedAt: new Date().toISOString() }));
    saveListe(liste);
  }
  updateListeBadge();
}

function removeFromListe(code) {
  saveListe(getListe().filter(function(p) { return p.code !== code; }));
  updateListeBadge();
}

function isInListe(code) {
  return getListe().some(function(p) { return p.code === code; });
}

function updateListeBadge() {
  const badge = document.getElementById("listeBadge");
  if (!badge) return;
  const c = getListe().length;
  badge.textContent = c;
  badge.style.display = c > 0 ? "" : "none";
}

// ===================================================================
// SIDEBAR MOBILE
// ===================================================================

function openSidebarMobile() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebarOverlay").classList.add("visible");
  document.body.style.overflow = "hidden";
}

function closeSidebarMobile() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("visible");
  document.body.style.overflow = "";
}

// ===================================================================
// NAVIGATION / ROUTER
// ===================================================================

function navigateTo(hash) {
  location.hash = hash;
}

function setActiveNav(page) {
  document.querySelectorAll(".sidebar-item").forEach(function(item) {
    item.classList.remove("active");
    if (item.getAttribute("data-page") === page) item.classList.add("active");
  });
}

const PAGE_TITLES = {
  accueil: "Accueil",
  alertes: "Alertes rappels",
  maliste: "Ma liste",
  produit: "Détail produit",
  apropos: "À propos"
};

function getCurrentPage() {
  const hash = location.hash || "#accueil";
  const hashStr = hash.replace("#", "");
  const parts = hashStr.split("?");
  return { page: parts[0] || "accueil", query: parts.slice(1).join("?") };
}

function router() {
  const { page, query } = getCurrentPage();
  if (page !== "produit") prevPage = location.hash;
  renderPage(page, query);
  setActiveNav(page);
  window.scrollTo(0, 0);
  closeSidebarMobile();
}

// ===================================================================
// FILTRES & TRI
// ===================================================================

function getActiveData() {
  return recallsData.length > 0 ? recallsData : MOCK_RECALLS;
}

function applyFilters(data) {
  const daysNum = parseInt(activeDays, 10) || 30;
  const cutoff  = new Date(Date.now() - daysNum * 86400000);
  const term    = searchTerm.trim().toLowerCase();

  return data.filter(function(p) {
    const d = parseFrDate(p.date);
    if (d < cutoff) return false;
    if (activeRisk !== "all" && p.severity !== activeRisk) return false;
    if (activeCategory !== "all" && p.category !== activeCategory) return false;
    if (activeDistributorName) {
      const parts = (p.distributor || "").split(/[,;]/).map(function(s) { return s.trim(); });
      const matched = parts.some(function(d) {
        const m = matchDistributor(d);
        return m && m.name === activeDistributorName;
      });
      if (!matched) return false;
    }
    if (term) {
      const haystack = [p.name, p.brand, p.code, p.category, p.distributor]
        .map(function(s) { return (s || "").toLowerCase(); }).join(" ");
      if (haystack.indexOf(term) === -1) return false;
    }
    return true;
  });
}

function applySort(data) {
  const copy = data.slice();
  if (activeSort === "date") {
    copy.sort(function(a, b) { return parseFrDate(b.date) - parseFrDate(a.date); });
  } else if (activeSort === "criticite") {
    const order = { danger: 0, preventif: 1, information: 2 };
    copy.sort(function(a, b) { return (order[a.severity] || 2) - (order[b.severity] || 2); });
  } else if (activeSort === "categorie") {
    copy.sort(function(a, b) { return (a.category || "").localeCompare(b.category || ""); });
  }
  return copy;
}

function setRisk(val) {
  activeRisk = val;
  const { page } = getCurrentPage();
  if (page === "alertes") el_reRenderAlertes();
}

function setCategory(val) {
  activeCategory = val;
  const { page } = getCurrentPage();
  if (page === "alertes") el_reRenderAlertes();
}

function setSort(val) {
  activeSort = val;
  const { page } = getCurrentPage();
  if (page === "alertes") el_reRenderAlertes();
}

function setDays(val) {
  activeDays = val;
  const { page } = getCurrentPage();
  if (page === "alertes") el_reRenderAlertes();
}

/** Met à jour les classes active sur tous les boutons de filtre sans re-render la toolbar */
function syncFilterUI() {
  document.querySelectorAll("[data-sort-val]").forEach(function(btn) {
    btn.classList.toggle("active", btn.getAttribute("data-sort-val") === activeSort);
  });
  document.querySelectorAll("[data-days-val]").forEach(function(btn) {
    btn.classList.toggle("active", btn.getAttribute("data-days-val") === activeDays);
  });
  document.querySelectorAll("[data-risk-val]").forEach(function(btn) {
    btn.classList.toggle("active", btn.getAttribute("data-risk-val") === activeRisk);
  });
  document.querySelectorAll("[data-cat-val]").forEach(function(btn) {
    btn.classList.toggle("active", btn.getAttribute("data-cat-val") === activeCategory);
  });
}

/** Re-rend uniquement la grille des cards + met à jour l'état des boutons de filtre */
function el_reRenderAlertes() {
  const grid  = document.getElementById("alertesGrid");
  const count = document.getElementById("alertesCount");
  if (!grid) return;

  const filtered = applySort(applyFilters(getActiveData()));
  grid.innerHTML = filtered.length > 0
    ? filtered.map(function(p) { return productCardHTML(p); }).join("")
    : '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Aucun rappel trouvé</div><div class="empty-state-desc">Aucun rappel ne correspond à vos critères de filtrage.</div></div>';

  if (count) count.textContent = filtered.length + " résultat" + (filtered.length !== 1 ? "s" : "");

  syncFilterUI();
}

// ===================================================================
// HERO STATS — calcul dynamique
// ===================================================================

function computeStats(data) {
  const src = data.length > 0 ? data : MOCK_RECALLS;
  const now = new Date();
  const cutoff30 = new Date(now - 30 * 86400000);
  const cutoff7  = new Date(now - 7 * 86400000);

  let critiques  = 0;
  let preventifs = 0;
  let mois       = 0;
  let semaine    = 0;

  src.forEach(function(p) {
    const d = parseFrDate(p.date);
    if (p.severity === "danger")    critiques++;
    if (p.severity === "preventif") preventifs++;
    if (d >= cutoff30) mois++;
    if (d >= cutoff7)  semaine++;
  });

  return { critiques, preventifs, mois, semaine };
}

// ===================================================================
// HTML — PRODUCT CARD
// ===================================================================

function productCardHTML(p) {
  const sevCls = "sev-" + (p.severity || "information");
  const newBadge = isNew(p.date) ? '<span class="badge badge-new">Nouveau</span>' : "";
  const sevBadge = severityBadge(p.severity);
  const catBadge = '<span class="badge badge-type">' + categoryIcon(p.category) + " " + htmlEncode(p.category) + '</span>';
  const inW = isInListe(p.code);
  const watchCls = "btn-watch" + (inW ? " active" : "");
  const watchTxt = inW ? "⭐" : "☆";
  const encodedCode = encodeURIComponent(p.code);
  const reasonShort = p.reason ? (p.reason.length > 80 ? p.reason.slice(0, 80) + "…" : p.reason) : "";

  const distLogo = p.distributor ? distributorLogoHTML(p.distributor, 16) : "";
  const distHTML = p.distributor
    ? htmlEncode(p.brand) + ' · ' + (distLogo ? distLogo + ' ' : '') + htmlEncode(p.distributor)
    : htmlEncode(p.brand);

  return (
    '<div class="product-card ' + sevCls + '" data-code="' + htmlEncode(p.code) + '">' +
      '<div class="product-img" onclick="navigateTo(\'#produit?id=' + encodedCode + '\')" title="Voir le détail">' +
        imgHTML(p.image, categoryIcon(p.category), "product-img") +
      '</div>' +
      '<div class="product-info">' +
        '<div class="product-meta">' + sevBadge + newBadge + catBadge + '</div>' +
        '<div class="product-name clickable" onclick="navigateTo(\'#produit?id=' + encodedCode + '\')">' + htmlEncode(p.name) + '</div>' +
        '<div class="product-brand">' + distHTML + '</div>' +
        '<div class="product-tags">' +
          (reasonShort ? '<span class="tag">' + htmlEncode(reasonShort) + '</span>' : "") +
        '</div>' +
      '</div>' +
      '<div class="product-right">' +
        '<div class="product-date">' +
          '<strong>' + relativeDate(p.date) + '</strong>' +
          htmlEncode(p.date) +
        '</div>' +
        '<div class="card-actions">' +
          '<button class="' + watchCls + '" onclick="handleWatchToggle(event,\'' + encodedCode + '\')" title="' + (inW ? "Retirer de ma liste" : "Ajouter à ma liste") + '">' + watchTxt + '</button>' +
          '<button class="btn-detail" onclick="event.stopPropagation();navigateTo(\'#produit?id=' + encodedCode + '\')">Voir →</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

// ===================================================================
// HTML — SCROLL CARD (accueil, rappels récents)
// ===================================================================

function scrollCardHTML(p) {
  const sevCls = "sev-" + (p.severity || "information");
  const encodedCode = encodeURIComponent(p.code);
  return (
    '<div class="scroll-card ' + sevCls + '" onclick="navigateTo(\'#produit?id=' + encodedCode + '\')">' +
      '<div class="scroll-card-img">' + imgHTML(p.image, categoryIcon(p.category)) + '</div>' +
      '<div class="scroll-card-body">' +
        '<div class="scroll-card-name">' + htmlEncode(p.name) + '</div>' +
        '<div class="scroll-card-brand">' + htmlEncode(p.brand) + '</div>' +
        '<div class="scroll-card-footer">' +
          severityBadge(p.severity) +
          '<span class="scroll-card-date">' + htmlEncode(p.date) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

// ===================================================================
// PAGES — RENDUS HTML
// ===================================================================

function renderPage(page, query) {
  const el = document.getElementById("pageContent");
  if (!el) return;
  try {
    switch (page) {
      case "accueil": el.innerHTML = renderAccueil(); break;
      case "alertes": el.innerHTML = renderAlertes(); break;
      case "maliste": el.innerHTML = renderMaliste(); break;
      case "produit": el.innerHTML = renderProduit(query); break;
      case "apropos": el.innerHTML = renderApropos(); break;
      default:        el.innerHTML = renderAccueil(); break;
    }
    bindPageListeners(page);
  } catch (err) {
    console.error("[RappelRadar] Erreur rendu page '" + page + "':", err);
    el.innerHTML = '<div style="padding:20px;color:var(--accent)">Erreur de rendu. Voir la console.</div>';
  }
}

// ── PAGE ACCUEIL ────────────────────────────────────────────────────
function renderAccueil() {
  const stats = computeStats(recallsData);
  const data = recallsData.length > 0 ? recallsData : MOCK_RECALLS;
  const recent = data.slice(0, 6);
  const recentCards = recent.map(scrollCardHTML).join("");
  const ranking = computeDistributorRanking(data);
  const podiumHTML = renderDistributorPodium(ranking);

  return (
    '<div class="hero-stats">' +
      '<div class="stats-inner">' +
        '<div class="stats-title">' +
          '<h1><span class="live-dot"></span>Rappels produits actifs</h1>' +
          '<p>Sources : RappelConso (DGCCRF) · Mis à jour en temps réel</p>' +
        '</div>' +
        '<div class="stats-counters">' +
          '<div class="stat-pill danger"><div class="num" id="statCritiques">' + stats.critiques + '</div><div class="label">Critiques</div></div>' +
          '<div class="stat-pill warning"><div class="num" id="statPreventifs">' + stats.preventifs + '</div><div class="label">Préventifs</div></div>' +
          '<div class="stat-pill info"><div class="num" id="statMois">' + stats.mois + '</div><div class="label">Ce mois</div></div>' +
          '<div class="stat-pill"><div class="num" id="statSemaine">' + stats.semaine + '</div><div class="label">7 derniers j.</div></div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="main-wrap">' +
      podiumHTML +

      '<div class="section-header" style="margin-top:28px">' +
        '<div>' +
          '<div class="section-title">Rappels récents</div>' +
          '<div class="section-subtitle">Les 6 derniers rappels publiés</div>' +
        '</div>' +
        '<a href="#alertes" class="btn btn-outline btn-sm">Voir tous →</a>' +
      '</div>' +
      '<div class="scroll-row">' + recentCards + '</div>' +

      (recallsUsedMock ? '<div class="demo-notice" style="margin-top:24px"><span class="demo-notice-icon">⚠️</span>Données de démonstration — l\'API n\'a pas pu être chargée.</div>' : '') +

      '<div class="trust-badges">' +
        '<a class="trust-badge" href="https://rappel.conso.gouv.fr" target="_blank" rel="noopener">' +
          '<span class="trust-badge-icon">🏛️</span>Source officielle RappelConso' +
        '</a>' +
        '<div class="trust-badge"><span class="trust-badge-icon">⚡</span>Données temps réel</div>' +
        '<div class="trust-badge"><span class="trust-badge-icon">🚫💶</span>100% gratuit</div>' +
      '</div>' +
    '</div>'
  );
}

// ── PAGE ALERTES ────────────────────────────────────────────────────
function renderAlertes() {
  const filtered = applySort(applyFilters(getActiveData()));
  const demoNotice = recallsUsedMock
    ? '<div class="demo-notice"><span class="demo-notice-icon">⚠️</span>Données de démonstration.</div>'
    : "";

  if (recallsLoading) {
    return (
      '<div class="main-wrap">' +
        '<div class="section-header"><div class="section-title">Alertes Rappels</div></div>' +
        '<div class="loading"><div class="spinner"></div><div class="loading-text">Chargement des rappels…</div></div>' +
      '</div>'
    );
  }

  const riskChips = [
    { val: "all",         label: "Tous",        cls: "" },
    { val: "danger",      label: "🔴 Critique",  cls: "danger" },
    { val: "preventif",   label: "🟠 Important", cls: "warning" },
    { val: "information", label: "🟢 Info",      cls: "low" }
  ].map(function(c) {
    const act = activeRisk === c.val ? " active" : "";
    return '<button class="chip ' + c.cls + act + '" data-risk-val="' + c.val + '" onclick="setRisk(\'' + c.val + '\')">' + c.label + '</button>';
  }).join("");

  const catChips = [
    { val: "all",          label: "Tout" },
    { val: "Alimentaire",  label: "🍎 Alimentaire" },
    { val: "Médicaments",  label: "💊 Médicaments" },
    { val: "Jouets",       label: "🧸 Jouets" },
    { val: "Cosmétiques",  label: "💄 Cosmétiques" },
    { val: "Électronique", label: "⚡ Électronique" },
    { val: "Vêtements",    label: "👕 Vêtements" },
    { val: "Maison",       label: "🏠 Maison" }
  ].map(function(c) {
    const act = activeCategory === c.val ? " active" : "";
    return '<button class="chip' + act + '" data-cat-val="' + htmlEncode(c.val) + '" onclick="setCategory(\'' + htmlEncode(c.val) + '\')">' + c.label + '</button>';
  }).join("");

  const sortBtns = [
    { val: "date",      label: "📅 Plus récent" },
    { val: "criticite", label: "🔴 Criticité" },
    { val: "categorie", label: "🏷️ Catégorie" }
  ].map(function(s) {
    const act = activeSort === s.val ? " active" : "";
    return '<button class="sort-btn' + act + '" data-sort-val="' + s.val + '" onclick="setSort(\'' + s.val + '\')">' + s.label + '</button>';
  }).join("");

  const daysBtns = ["7", "30", "90"].map(function(d) {
    const act = activeDays === d ? " active" : "";
    return '<button class="days-btn' + act + '" data-days-val="' + d + '" onclick="setDays(\'' + d + '\')">' + d + 'j</button>';
  }).join("");

  const gridItems = filtered.length > 0
    ? filtered.map(productCardHTML).join("")
    : '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Aucun rappel trouvé</div><div class="empty-state-desc">Aucun rappel ne correspond à vos critères.</div></div>';

  return (
    '<div class="toolbar">' +
      (activeDistributorName
        ? '<div class="toolbar-row" id="distFilterRow">' +
            '<span class="toolbar-label">Enseigne :</span>' +
            '<button class="chip active dist-chip" onclick="clearDistributorFilter()">' +
              htmlEncode(activeDistributorName) + ' <span class="dist-chip-x">✕</span>' +
            '</button>' +
          '</div>'
        : '<div id="distFilterRow" style="display:none"></div>') +
      '<div class="toolbar-row">' +
        '<span class="toolbar-label">Risque :</span>' +
        '<div class="chips">' + riskChips + '</div>' +
      '</div>' +
      '<div class="toolbar-row">' +
        '<span class="toolbar-label">Catégorie :</span>' +
        '<div class="chips">' + catChips + '</div>' +
      '</div>' +
      '<div class="toolbar-row2">' +
        '<div class="sort-group">' +
          '<span class="toolbar-label">Trier :</span>' +
          sortBtns +
        '</div>' +
        '<div class="days-group">' + daysBtns + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="main-wrap">' +
      demoNotice +
      '<div class="results-count"><strong id="alertesCount">' + filtered.length + ' résultat' + (filtered.length !== 1 ? 's' : '') + '</strong></div>' +
      '<div class="product-list" id="alertesGrid">' + gridItems + '</div>' +
      '<div class="load-more"><button class="btn-load" onclick="loadMoreRecalls()">Charger plus de rappels</button></div>' +
    '</div>'
  );
}

// ── PAGE MA LISTE ────────────────────────────────────────────────────
function renderMaliste() {
  const liste = getListe();

  if (liste.length === 0) {
    return (
      '<div class="liste-wrap">' +
        '<div class="section-header"><div class="section-title">Ma liste de surveillance</div></div>' +
        '<div class="empty-state">' +
          '<div class="empty-state-icon">⭐</div>' +
          '<div class="empty-state-title">Votre liste est vide</div>' +
          '<div class="empty-state-desc">Ajoutez des rappels en cliquant sur l\'étoile ⭐ sur n\'importe quelle fiche produit.</div>' +
          '<a href="#alertes" class="btn btn-primary btn-lg">Parcourir les rappels</a>' +
        '</div>' +
      '</div>'
    );
  }

  const allData = getActiveData();
  const cards = liste.map(function(p) {
    const isRecalled = allData.some(function(r) { return r.code === p.code; });
    const addedDate  = new Date(p.addedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const encodedCode = encodeURIComponent(p.code);
    const imgEl = imgHTML(p.image, categoryIcon(p.category));
    const statusHTML = isRecalled
      ? '<span class="status-recall">🚨 RAPPELÉ</span>'
      : '<span class="status-ok">✅ Aucun rappel</span>';
    return (
      '<div class="liste-card">' +
        '<div class="liste-card-img" onclick="navigateTo(\'#produit?id=' + encodedCode + '\')">' + imgEl + '</div>' +
        '<div class="liste-card-info" onclick="navigateTo(\'#produit?id=' + encodedCode + '\')">' +
          '<div class="liste-card-name">' + htmlEncode(p.name) + '</div>' +
          '<div class="liste-card-brand">' + htmlEncode(p.brand) + ' · ' + categoryIcon(p.category) + ' ' + htmlEncode(p.category) + '</div>' +
          '<div class="liste-card-added">Ajouté le ' + addedDate + '</div>' +
        '</div>' +
        '<div class="liste-card-actions">' +
          statusHTML +
          '<button class="remove-btn" onclick="handleRemoveFromListe(\'' + encodedCode + '\')" title="Retirer">✕</button>' +
        '</div>' +
      '</div>'
    );
  }).join("");

  const n = liste.length;
  return (
    '<div class="liste-wrap">' +
      '<div class="section-header">' +
        '<div>' +
          '<div class="section-title">Ma liste de surveillance</div>' +
          '<div class="section-subtitle">' + n + ' produit' + (n > 1 ? 's suivis' : ' suivi') + '</div>' +
        '</div>' +
        '<a href="#alertes" class="btn btn-primary btn-sm">+ Ajouter</a>' +
      '</div>' +
      '<div class="liste-grid">' + cards + '</div>' +
    '</div>'
  );
}

// ── PAGE DÉTAIL PRODUIT ──────────────────────────────────────────────
function renderProduit(query) {
  const params = {};
  if (query) {
    query.split("&").forEach(function(pair) {
      const kv = pair.split("=");
      if (kv[0]) params[kv[0]] = decodeURIComponent(kv.slice(1).join("="));
    });
  }
  const code = params.id || "";
  const allData = getActiveData();
  let product = null;
  for (let i = 0; i < allData.length; i++) {
    if (allData[i].code === code) { product = allData[i]; break; }
  }
  if (!product) {
    for (let i = 0; i < MOCK_RECALLS.length; i++) {
      if (MOCK_RECALLS[i].code === code) { product = MOCK_RECALLS[i]; break; }
    }
  }

  if (!product) {
    return (
      '<div class="detail-wrap">' +
        '<button class="back-btn" onclick="history.back()">← Retour</button>' +
        '<div class="empty-state">' +
          '<div class="empty-state-icon">🔍</div>' +
          '<div class="empty-state-title">Produit introuvable</div>' +
          '<div class="empty-state-desc">Ce produit n\'est pas dans notre base de rappels actuelle.</div>' +
          '<a href="#accueil" class="btn btn-primary">Retour à l\'accueil</a>' +
        '</div>' +
      '</div>'
    );
  }

  const inListe = isInListe(product.code);
  const encodedCode = encodeURIComponent(product.code);
  const listeBtnCls = inListe ? "btn btn-danger-out" : "btn btn-primary";
  const listeBtnTxt = inListe ? "Retirer de ma liste ✕" : "⭐ Ajouter à ma liste";

  const imgEl = product.image
    ? '<img class="detail-img" src="' + htmlEncode(product.image) + '" alt="' + htmlEncode(product.name) + '" onclick="openZoom(\'' + htmlEncode(product.image) + '\',\'' + htmlEncode(product.name) + '\')" title="Cliquer pour agrandir" onerror="this.parentNode.innerHTML=\'<span class=detail-img-placeholder>📦</span>\'">'
    : '<span class="detail-img-placeholder">' + categoryIcon(product.category) + '</span>';

  const distMatch = product.distributor ? matchDistributor(product.distributor) : null;
  const distLogoLarge = distMatch && distMatch.domain
    ? (function() {
        const src = logoSrc(distMatch);
        const fallback = 'https://www.google.com/s2/favicons?domain=' + distMatch.domain + '&sz=256';
        const onerr = distMatch.logoUrl ? 'this.onerror=null;this.src=\'' + fallback + '\'' : 'this.style.display=\'none\'';
        return '<img src="' + src + '" alt="' + htmlEncode(distMatch.name) + '" class="dist-logo-detail" onerror="' + onerr + '">';
      })()
    : "";

  return (
    '<div class="detail-wrap">' +
      '<button class="back-btn" onclick="history.back()">← Retour</button>' +
      '<div class="detail-card">' +
        '<div class="detail-img-wrap">' + imgEl + '</div>' +
        '<div class="detail-body">' +
          '<div class="detail-brand">' + htmlEncode(product.brand) + '</div>' +
          '<h1 class="detail-name">' + htmlEncode(product.name) + '</h1>' +
          '<div class="detail-meta">' +
            '<span class="badge badge-type">' + categoryIcon(product.category) + ' ' + htmlEncode(product.category) + '</span>' +
            severityBadgeLarge(product.severity) +
          '</div>' +

          '<div class="detail-section">' +
            '<div class="detail-section-title">Code-barres / Référence</div>' +
            '<div class="barcode-row"><span>📊</span> ' + htmlEncode(product.code) + '</div>' +
          '</div>' +

          '<div class="detail-section">' +
            '<div class="detail-section-title">Distributeur</div>' +
            '<div class="detail-distributor">' +
              distLogoLarge +
              '<span>' + htmlEncode(product.distributor || "Non précisé") + '</span>' +
            '</div>' +
          '</div>' +

          '<div class="detail-section">' +
            '<div class="detail-section-title">Motif du rappel</div>' +
            '<div class="detail-reason">' + htmlEncode(product.reason) + '</div>' +
          '</div>' +

          '<div class="detail-section">' +
            '<div class="detail-section-title">Dates</div>' +
            '<div class="detail-dates">' +
              '<div class="detail-date-item">' +
                '<span class="detail-date-label">Date de publication</span>' +
                '<span class="detail-date-value">' + htmlEncode(product.date) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="detail-section">' +
            '<div class="detail-section-title">Source officielle</div>' +
            '<a href="https://rappel.conso.gouv.fr" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="text-decoration:none">🏛️ rappel.conso.gouv.fr ↗</a>' +
          '</div>' +

          '<div class="detail-actions">' +
            '<button class="' + listeBtnCls + '" id="listeToggleBtn" onclick="handleToggleListe(\'' + encodedCode + '\')">' + listeBtnTxt + '</button>' +
            '<button class="btn btn-outline" onclick="handleShare(\'' + encodedCode + '\')">📤 Partager</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

// ── PAGE À PROPOS ────────────────────────────────────────────────────
function renderApropos() {
  return (
    '<div class="apropos-wrap">' +
      '<div class="section-header"><div class="section-title">À propos de RappelRadar</div></div>' +

      '<div class="apropos-card">' +
        '<h3>Qu\'est-ce que RappelRadar ?</h3>' +
        '<p>RappelRadar est une application gratuite dédiée à la sécurité des consommateurs français. Elle regroupe tous les rappels officiels de produits publiés en France, avec des filtres par type de risque, catégorie et période.</p>' +
      '</div>' +

      '<div class="apropos-card">' +
        '<h3>Sources des données</h3>' +
        '<p>Les informations sont issues de la base officielle <strong>RappelConso</strong> gérée par la DGCCRF, disponible sur <a href="https://rappel.conso.gouv.fr" target="_blank" rel="noopener" class="apropos-link">rappel.conso.gouv.fr</a>.</p>' +
      '</div>' +

      '<div class="apropos-card">' +
        '<h3>API utilisée</h3>' +
        '<p>Données via l\'API publique RappelConso v2 : <a href="https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records" target="_blank" rel="noopener" class="apropos-link" style="word-break:break-all">data.economie.gouv.fr</a></p>' +
      '</div>' +

      '<div class="apropos-card">' +
        '<h3>Confidentialité</h3>' +
        '<p>Votre liste de surveillance est stockée uniquement dans votre navigateur (localStorage). Aucune donnée personnelle n\'est transmise à des serveurs externes.</p>' +
      '</div>' +

      '<div class="apropos-card">' +
        '<h3>Fonctionnalités</h3>' +
        '<ul>' +
          '<li>Consultation des rappels en temps réel</li>' +
          '<li>Filtres par risque, catégorie et période</li>' +
          '<li>Liste de surveillance personnelle</li>' +
          '<li>Page détail avec zoom image</li>' +
          '<li>Fonctionnement 100% hors-ligne (fallback mock)</li>' +
        '</ul>' +
      '</div>' +
    '</div>'
  );
}

// ===================================================================
// API RAPPELCONSO
// ===================================================================

let apiOffset = 0;
const API_LIMIT = 100;

function loadRecalls() {
  recallsLoading = true;
  recallsData    = [];
  recallsUsedMock = false;
  apiOffset = 0;

  const { page, query } = getCurrentPage();
  renderPage(page, query);

  const controller  = new AbortController();
  const timeoutId   = setTimeout(function() { controller.abort(); }, API_TIMEOUT);
  const url = RAPPEL_API_URL + "?limit=" + API_LIMIT + "&offset=0&order_by=-date_publication";

  fetch(url, { signal: controller.signal })
    .then(function(res) {
      clearTimeout(timeoutId);
      recallsLoading = false;
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function(json) {
      const results = json && json.results;
      if (results && results.length > 0) {
        recallsData = results.map(mapApiRecord);
        recallsUsedMock = false;
        apiOffset = results.length;
      } else {
        recallsUsedMock = true;
      }
      const { page: p2, query: q2 } = getCurrentPage();
      renderPage(p2, q2);
    })
    .catch(function(err) {
      clearTimeout(timeoutId);
      recallsLoading  = false;
      recallsUsedMock = true;
      console.warn("[RappelRadar] API indisponible, données mock utilisées :", err.message);
      const { page: p2, query: q2 } = getCurrentPage();
      renderPage(p2, q2);
    });
}

function loadMoreRecalls() {
  if (recallsUsedMock) return;
  const controller = new AbortController();
  const timeoutId  = setTimeout(function() { controller.abort(); }, API_TIMEOUT);
  const url = RAPPEL_API_URL + "?limit=" + API_LIMIT + "&offset=" + apiOffset + "&order_by=-date_publication";

  const btn = document.querySelector(".btn-load");
  if (btn) { btn.textContent = "Chargement…"; btn.disabled = true; }

  fetch(url, { signal: controller.signal })
    .then(function(res) {
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function(json) {
      const results = json && json.results;
      if (results && results.length > 0) {
        recallsData = recallsData.concat(results.map(mapApiRecord));
        apiOffset += results.length;
        el_reRenderAlertes();
      }
      const b = document.querySelector(".btn-load");
      if (b) { b.textContent = "Charger plus de rappels"; b.disabled = false; }
    })
    .catch(function(err) {
      clearTimeout(timeoutId);
      console.warn("[RappelRadar] Erreur chargement supplémentaire :", err.message);
      const b = document.querySelector(".btn-load");
      if (b) { b.textContent = "Charger plus de rappels"; b.disabled = false; }
    });
}

function mapApiRecord(r) {
  var codes = r.identification_produits;
  var code  = Array.isArray(codes) ? (codes[0] || "").trim() : (codes || "").trim();

  var risque   = r.risques_encourus || "";
  var severity = computeSeverity(risque);

  var dateStr = r.date_publication || "";
  var formattedDate = dateStr;
  if (dateStr) {
    try {
      var d = new Date(dateStr);
      formattedDate = ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear();
    } catch (e) { formattedDate = dateStr; }
  }

  var imageRaw = r.liens_vers_les_images || r.image_url || r.image || "";
  var image = String(imageRaw).split("|")[0].trim();

  return {
    code:        code,
    name:        r.modeles_ou_references || r.title || "",
    brand:       r.marque_produit || r.brand || "",
    category:    normalizeCategory(r.categorie_produit || r.category || ""),
    distributor: r.distributeurs || r.distributeur || "",
    reason:      r.motif_rappel || r.reason || risque || "",
    severity:    severity,
    date:        formattedDate,
    image:       image,
    source:      "rappel.conso.gouv.fr"
  };
}

// ===================================================================
// EVENT HANDLERS
// ===================================================================

function handleWatchToggle(event, encodedCode) {
  event.stopPropagation();
  const code = decodeURIComponent(encodedCode);
  if (isInListe(code)) {
    removeFromListe(code);
  } else {
    const all = getActiveData();
    let product = null;
    for (let i = 0; i < all.length; i++) {
      if (all[i].code === code) { product = all[i]; break; }
    }
    if (!product) {
      for (let i = 0; i < MOCK_RECALLS.length; i++) {
        if (MOCK_RECALLS[i].code === code) { product = MOCK_RECALLS[i]; break; }
      }
    }
    if (product) addToListe(product);
  }

  const btn = event.currentTarget;
  const inW = isInListe(code);
  btn.classList.toggle("active", inW);
  btn.textContent = inW ? "⭐" : "☆";
  btn.title = inW ? "Retirer de ma liste" : "Ajouter à ma liste";
}

function handleRemoveFromListe(encodedCode) {
  const code = decodeURIComponent(encodedCode);
  removeFromListe(code);
  const { page, query } = getCurrentPage();
  renderPage(page, query);
}

function handleToggleListe(encodedCode) {
  const code = decodeURIComponent(encodedCode);
  if (isInListe(code)) {
    removeFromListe(code);
  } else {
    const all = getActiveData();
    let product = null;
    for (let i = 0; i < all.length; i++) {
      if (all[i].code === code) { product = all[i]; break; }
    }
    if (!product) {
      for (let i = 0; i < MOCK_RECALLS.length; i++) {
        if (MOCK_RECALLS[i].code === code) { product = MOCK_RECALLS[i]; break; }
      }
    }
    if (product) addToListe(product);
  }
  const { page, query } = getCurrentPage();
  renderPage(page, query);
}

function handleShare(encodedCode) {
  const code = decodeURIComponent(encodedCode);
  const text = "RappelRadar — Rappel produit : " + code;
  if (navigator.share) {
    navigator.share({ title: "RappelRadar", text: text, url: location.href }).catch(function() {});
  } else {
    navigator.clipboard.writeText(location.href).then(function() {
      alert("Lien copié !");
    }).catch(function() {
      alert("Impossible de copier le lien.");
    });
  }
}

function focusNavSearch() {
  const input = document.getElementById("navSearchInput");
  if (input) input.focus();
}

// ===================================================================
// LIGHTBOX ZOOM
// ===================================================================

function openZoom(src, name) {
  const existing = document.getElementById("zoomOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "zoomOverlay";
  overlay.style.cssText = [
    "position:fixed", "inset:0",
    "background:rgba(0,0,0,0.88)", "z-index:9999",
    "display:flex", "align-items:center", "justify-content:center",
    "cursor:zoom-out",
    "animation:fadeInZoom .2s ease"
  ].join(";");

  if (!document.getElementById("zoomStyle")) {
    const st = document.createElement("style");
    st.id = "zoomStyle";
    st.textContent = "@keyframes fadeInZoom{from{opacity:0}to{opacity:1}}";
    document.head.appendChild(st);
  }

  const img = document.createElement("img");
  img.src    = src;
  img.alt    = name || "";
  img.style.cssText = [
    "max-width:92vw", "max-height:92vh",
    "object-fit:contain",
    "border-radius:12px",
    "box-shadow:0 20px 60px rgba(0,0,0,.6)"
  ].join(";");

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.cssText = [
    "position:absolute", "top:16px", "right:16px",
    "background:rgba(255,255,255,0.15)",
    "border:none", "color:#fff",
    "font-size:20px",
    "width:40px", "height:40px", "border-radius:50%",
    "cursor:pointer",
    "display:flex", "align-items:center", "justify-content:center"
  ].join(";");

  overlay.appendChild(img);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);

  function closeZoom() { overlay.remove(); }

  overlay.addEventListener("click", function(e) {
    if (e.target === overlay || e.target === closeBtn) closeZoom();
  });

  document.addEventListener("keydown", function escHandler(e) {
    if (e.key === "Escape") { closeZoom(); document.removeEventListener("keydown", escHandler); }
  });
}

// ===================================================================
// LISTENERS DYNAMIQUES
// ===================================================================

function bindPageListeners(page) {
  if (page === "accueil" || page === "alertes") {
    // navSearchInput déjà lié globalement
  }
}

// ===================================================================
// INIT
// ===================================================================

window.addEventListener("hashchange", router);

document.addEventListener("DOMContentLoaded", function() {
  updateListeBadge();
  router();
  loadRecalls();

  const menuBtn = document.getElementById("menuToggle");
  if (menuBtn) menuBtn.addEventListener("click", openSidebarMobile);

  const closeBtn = document.getElementById("sidebarClose");
  if (closeBtn) closeBtn.addEventListener("click", closeSidebarMobile);

  const overlay = document.getElementById("sidebarOverlay");
  if (overlay) overlay.addEventListener("click", closeSidebarMobile);

  document.addEventListener("click", function(e) {
    if (!e.target.closest("#sidebar") && !e.target.closest("#menuToggle")) {
      closeSidebarMobile();
    }
  });

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") closeSidebarMobile();
  });

  const navInput = document.getElementById("navSearchInput");
  if (navInput) {
    const handleSearchInput = debounce(function() {
      searchTerm = navInput.value;
      if (searchTerm) {
        activeDistributorName = null;
        const row = document.getElementById("distFilterRow");
        if (row) row.style.display = "none";
      }
      const { page } = getCurrentPage();
      if (page === "alertes") el_reRenderAlertes();
    }, 300);
    navInput.addEventListener("input", handleSearchInput);
    navInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && navInput.value.trim()) {
        searchTerm = navInput.value.trim();
        activeDistributorName = null;
        activeCategory = "all";
        activeRisk = "all";
        navigateTo("#alertes");
      }
    });
  }

  const btnNotif = document.getElementById("btnNotif");
  if (btnNotif) {
    btnNotif.addEventListener("click", function() {
      if ("Notification" in window) {
        Notification.requestPermission().then(function(perm) {
          if (perm === "granted") {
            btnNotif.textContent = "🔔 Alertes activées";
            btnNotif.style.background = "rgba(46,213,115,0.15)";
            btnNotif.style.color = "var(--green)";
            btnNotif.style.borderColor = "rgba(46,213,115,0.3)";
          }
        });
      } else {
        alert("Les notifications ne sont pas supportées par ce navigateur.");
      }
    });
  }

  document.addEventListener("error", function(e) {
    if (e.target && e.target.tagName === "IMG") {
      const p = e.target.parentNode;
      if (p) {
        const span = document.createElement("span");
        span.textContent = "📦";
        span.style.cssText = "font-size:30px;opacity:0.3;";
        p.replaceChild(span, e.target);
      }
    }
  }, true);

  console.log("[RappelRadar] Initialisation terminée");
});
