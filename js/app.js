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
let recallsData    = [];   // Données chargées depuis l'API
let recallsLoading = false;
let recallsUsedMock = false;
let prevPage = "#accueil";

// Filtres actifs
let activeRisk     = "all";   // all | danger | preventif | information
let activeCategory = "all";   // all | Alimentaire | Médicaments | Cosmétiques | Jouets | Électronique | Vêtements | Maison
let activeSort     = "date";  // date | criticite | categorie
let activeDays     = "30";    // 7 | 30 | 90

// Recherche
let searchTerm = "";

// ── UTILITAIRE DEBOUNCE ──────────────────────────────────────────────
/**
 * Fonction debounce simple
 * @param {Function} fn - Fonction à débouncer
 * @param {number} delay - Délai en ms
 * @returns {Function} Fonction débouncée
 */
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ── MOCK DATA (10 rappels représentatifs) ───────────────────────────
const MOCK_RECALLS = [
  {
    code: "3271234567890",
    name: "Lait demi-écrémé UHT 1L",
    brand: "U",
    category: "Alimentaire",
    distributor: "U Express, Super U",
    reason: "Anomalie sur la date de péremption — plusieurs lots retirés par mesure de précaution. Ne consommez pas les produits portant le code indiqué sur l'emballage.",
    severity: "preventif",
    date: "20/03/2026",
    image: "https://images.openfoodfacts.org/images/products/325/622/000/5921/front_fr.264.400.jpg",
    source: "rappels.conso.gouv.fr"
  },
  {
    code: "3489771003485",
    name: "Filets de poulet rôtis aux herbes de Provence",
    brand: "Leclerc",
    category: "Alimentaire",
    distributor: "E.Leclerc",
    reason: "Risque de présence de Listeria monocytogenes. Ne consommez pas ce produit et rapportez-le en magasin.",
    severity: "danger",
    date: "18/03/2026",
    image: "https://images.openfoodfacts.org/images/products/348/977/100/3485/front_fr.276.400.jpg",
    source: "rappels.conso.gouv.fr"
  },
  {
    code: "3268840001055",
    name: "Compote de pommes sans sucre ajouté",
    brand: "Mademoiselle Desserts",
    category: "Alimentaire",
    distributor: "Biocoop",
    reason: "Conditionnement défectueux — risque de moisissures. Les lots indiqués sont concernés.",
    severity: "preventif",
    date: "15/03/2026",
    image: "https://images.openfoodfacts.org/images/products/326/884/000/1055/front_fr.276.400.jpg",
    source: "rappels.conso.gouv.fr"
  },
  {
    code: "3175900012210",
    name: "Gommage corps exfoliant corps entier",
    brand: "Le Petit Marseillais",
    category: "Cosmétiques",
    distributor: "Carrefour",
    reason: "Risque microbiologique détecté lors des contrôles DGCCRF. Cessez l'utilisation et rapportez le produit.",
    severity: "danger",
    date: "12/03/2026",
    image: "https://images.openfoodfacts.org/images/products/317/590/001/2210/front_fr.276.400.jpg",
    source: "rappels.conso.gouv.fr"
  },
  {
    code: "3564700953294",
    name: "Barres chocolatées au lait pack x6",
    brand: "Carrefour",
    category: "Alimentaire",
    distributor: "Carrefour",
    reason: "Traces de polyéthylène — ne pas consommer. Rappel officiel DGCCRF.",
    severity: "danger",
    date: "10/03/2026",
    image: "https://images.openfoodfacts.org/images/products/356/470/095/3294/front_fr.276.400.jpg",
    source: "rappels.conso.gouv.fr"
  },
  {
    code: "3306949165722",
    name: "Doudoune garçon 4-6 ans avec capuche",
    brand: "Kiabi",
    category: "Vêtements",
    distributor: "Kiabi",
    reason: "Cordons de capuche — risque de strangulation pour les enfants. Retrait du marché européen.",
    severity: "danger",
    date: "08/03/2026",
    image: "",
    source: "rappels.conso.gouv.fr"
  },
  {
    code: "3401593201071",
    name: "Puzzle éducatif en bois 100 pièces",
    brand: "Janod",
    category: "Jouets",
    distributor: "JouéClub",
    reason: "Petites pièces détachables — risque d'étouffement pour les enfants de 0 à 3 ans.",
    severity: "danger",
    date: "05/03/2026",
    image: "",
    source: "rappels.conso.gouv.fr"
  },
  {
    code: "8806098193941",
    name: "Chargeur rapide USB-C 25W officiel",
    brand: "Samsung",
    category: "Électronique",
    distributor: "Boulanger",
    reason: "Risque de surchauffe et de brûlure. Rappel officiel DGCCRF.",
    severity: "danger",
    date: "01/03/2026",
    image: "",
    source: "rappels.conso.gouv.fr"
  },
  {
    code: "3760171840029",
    name: "Crème hydratante Visage Rose Mosquée",
    brand: "L'Atelier des 3 Fontaines",
    category: "Cosmétiques",
    distributor: "Nocibé",
    reason: "Non-conformité cosmétique — présence de substances non autorisées.",
    severity: "information",
    date: "25/02/2026",
    image: "https://images.openfoodfacts.org/images/products/376/017/184/0029/front_fr.276.400.jpg",
    source: "rappels.conso.gouv.fr"
  },
  {
    code: "3228887000508",
    name: "Yaourt à la grecque nature 4x125g",
    brand: "Casino",
    category: "Alimentaire",
    distributor: "Casino",
    reason: "Anomalie de fermentation détectée sur certains lots. Par précaution, ne pas consommer.",
    severity: "preventif",
    date: "22/02/2026",
    image: "https://images.openfoodfacts.org/images/products/322/888/700/0508/front_fr.276.400.jpg",
    source: "rappels.conso.gouv.fr"
  }
];

// ===================================================================
// UTILS
// ===================================================================

/** Encode HTML pour prévenir les injections */
function htmlEncode(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Retourne l'emoji catégorie */
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

/** Normalise une catégorie brute de l'API vers nos catégories affichables */
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

/** Détermine la sévérité depuis le champ risques_encourus */
function computeSeverity(risque) {
  const r = (risque || "").toLowerCase();
  if (/chimique|microbiologique|matière étrangère|dangereux/.test(r)) return "danger";
  if (/préventif|précaution/.test(r)) return "preventif";
  return "information";
}

/** Badge HTML sévérité (petit) */
function severityBadge(severity) {
  if (severity === "danger")      return '<span class="badge badge-danger">🔴 Critique</span>';
  if (severity === "preventif")   return '<span class="badge badge-preventif">🟠 Important</span>';
  return '<span class="badge badge-information">🟢 Info</span>';
}

/** Badge HTML sévérité (grand, page détail) */
function severityBadgeLarge(severity) {
  if (severity === "danger")    return '<span class="badge-lg sev-danger">🚨 Danger critique</span>';
  if (severity === "preventif") return '<span class="badge-lg sev-preventif">🟧 Rappel préventif</span>';
  return '<span class="badge-lg sev-information">ℹ️ Information</span>';
}

/** Retourne "Nouveau" si la date est dans les 7 derniers jours */
function isNew(dateStr) {
  try {
    const parts = dateStr.split("/");
    const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    const now = new Date();
    return (now - d) < 7 * 24 * 60 * 60 * 1000;
  } catch (e) { return false; }
}

/** Retourne une date relative lisible */
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

/** Parse une date au format JJ/MM/AAAA */
function parseFrDate(dateStr) {
  try {
    const p = dateStr.split("/");
    return new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
  } catch (e) { return new Date(0); }
}

/** Génère le HTML image avec fallback emoji */
function imgHTML(src, name, cls) {
  if (!src) return '<span>' + categoryIcon(name) + '</span>';
  const safe = htmlEncode(src);
  const safeName = htmlEncode(name);
  return '<img src="' + safe + '" alt="' + safeName + '" onerror="this.parentNode.innerHTML=\'<span>📦</span>\'">';
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
  // Met à jour le titre de la topnav (utilité sur mobile)
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
    // Filtre jours
    const d = parseFrDate(p.date);
    if (d < cutoff) return false;

    // Filtre risque
    if (activeRisk !== "all" && p.severity !== activeRisk) return false;

    // Filtre catégorie
    if (activeCategory !== "all" && p.category !== activeCategory) return false;

    // Recherche texte
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

// Raccourcis pour les handlers de chips/sort
function setRisk(val) {
  activeRisk = val;
  const { page, query } = getCurrentPage();
  if (page === "alertes") el_reRenderAlertes();
}

function setCategory(val) {
  activeCategory = val;
  const { page, query } = getCurrentPage();
  if (page === "alertes") el_reRenderAlertes();
}

function setSort(val) {
  activeSort = val;
  const { page, query } = getCurrentPage();
  if (page === "alertes") el_reRenderAlertes();
}

function setDays(val) {
  activeDays = val;
  const { page, query } = getCurrentPage();
  if (page === "alertes") el_reRenderAlertes();
}

/** Re-rend uniquement la liste des cards (évite de redessiner toute la page) */
function el_reRenderAlertes() {
  const grid = document.getElementById("alertesGrid");
  const count = document.getElementById("alertesCount");
  if (!grid) return;

  const filtered = applySort(applyFilters(getActiveData()));
  grid.innerHTML = filtered.length > 0
    ? filtered.map(function(p) { return productCardHTML(p); }).join("")
    : '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Aucun rappel trouvé</div><div class="empty-state-desc">Aucun rappel ne correspond à vos critères de filtrage.</div></div>';

  if (count) count.textContent = filtered.length + " résultat" + (filtered.length !== 1 ? "s" : "");
}

// ===================================================================
// HERO STATS — calcul dynamique
// ===================================================================

function computeStats(data) {
  const src = data.length > 0 ? data : MOCK_RECALLS;
  const now = new Date();
  const cutoff30  = new Date(now - 30 * 86400000);
  const cutoff7   = new Date(now - 7 * 86400000);

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
// HTML — PRODUCT CARD (design rappel-radar)
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

  return (
    '<div class="product-card ' + sevCls + '" data-code="' + htmlEncode(p.code) + '">' +
      '<div class="product-img">' + imgHTML(p.image, categoryIcon(p.category), "product-img") + '</div>' +
      '<div class="product-info">' +
        '<div class="product-meta">' + sevBadge + newBadge + catBadge + '</div>' +
        '<div class="product-name">' + htmlEncode(p.name) + '</div>' +
        '<div class="product-brand">' + htmlEncode(p.brand) + (p.distributor ? " · " + htmlEncode(p.distributor) : "") + '</div>' +
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
          '<button class="btn-detail" onclick="navigateTo(\'#produit?id=' + encodedCode + '\')">Voir →</button>' +
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
    // Attache les listeners dynamiques après injection HTML
    bindPageListeners(page);
  } catch (err) {
    console.error("[RappelRadar] Erreur rendu page '" + page + "':", err);
    el.innerHTML = '<div style="padding:20px;color:var(--accent)">Erreur de rendu. Voir la console.</div>';
  }
}

// ── PAGE ACCUEIL ────────────────────────────────────────────────────
function renderAccueil() {
  const stats = computeStats(recallsData);
  const recent = (recallsData.length > 0 ? recallsData : MOCK_RECALLS).slice(0, 6);
  const recentCards = recent.map(scrollCardHTML).join("");

  return (
    // Hero Stats
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
      // Scan banner
      '<div class="scan-banner">' +
        '<div class="scan-icon">📷</div>' +
        '<div class="scan-text">' +
          '<h3>Vérifier un produit que vous avez acheté</h3>' +
          '<p>Saisissez le nom, la marque ou le numéro de lot pour une vérification immédiate.</p>' +
        '</div>' +
        '<button class="btn-scan" onclick="focusNavSearch()">Scanner un produit</button>' +
      '</div>' +

      // Rappels récents
      '<div class="section-header">' +
        '<div>' +
          '<div class="section-title">Rappels récents</div>' +
          '<div class="section-subtitle">Les 6 derniers rappels publiés</div>' +
        '</div>' +
        '<a href="#alertes" class="btn btn-outline btn-sm">Voir tous →</a>' +
      '</div>' +
      '<div class="scroll-row">' + recentCards + '</div>' +

      // Demo notice si mock
      (recallsUsedMock ? '<div class="demo-notice" style="margin-top:24px"><span class="demo-notice-icon">⚠️</span>Données de démonstration — l\'API n\'a pas pu être chargée.</div>' : '') +

      // Trust badges
      '<div class="trust-badges">' +
        '<a class="trust-badge" href="https://rappels.conso.gouv.fr" target="_blank" rel="noopener">' +
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

  // Chips risque
  const riskChips = [
    { val: "all",         label: "Tous",        cls: "" },
    { val: "danger",      label: "🔴 Critique",  cls: "danger" },
    { val: "preventif",   label: "🟠 Important", cls: "warning" },
    { val: "information", label: "🟢 Info",      cls: "low" }
  ].map(function(c) {
    const act = activeRisk === c.val ? " active" : "";
    return '<button class="chip ' + c.cls + act + '" onclick="setRisk(\'' + c.val + '\')">' + c.label + '</button>';
  }).join("");

  // Chips catégorie
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
    return '<button class="chip' + act + '" onclick="setCategory(\'' + htmlEncode(c.val) + '\')">' + c.label + '</button>';
  }).join("");

  // Boutons tri
  const sortBtns = [
    { val: "date",      label: "📅 Plus récent" },
    { val: "criticite", label: "🔴 Criticité" },
    { val: "categorie", label: "🏷️ Catégorie" }
  ].map(function(s) {
    const act = activeSort === s.val ? " active" : "";
    return '<button class="sort-btn' + act + '" onclick="setSort(\'' + s.val + '\')">' + s.label + '</button>';
  }).join("");

  // Boutons jours
  const daysBtns = ["7", "30", "90"].map(function(d) {
    const act = activeDays === d ? " active" : "";
    return '<button class="days-btn' + act + '" onclick="setDays(\'' + d + '\')">' + d + 'j</button>';
  }).join("");

  const gridItems = filtered.length > 0
    ? filtered.map(productCardHTML).join("")
    : '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Aucun rappel trouvé</div><div class="empty-state-desc">Aucun rappel ne correspond à vos critères.</div></div>';

  return (
    '<div class="toolbar">' +
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
  // Décode le paramètre id
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
  // Fallback mock
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
            '<p style="font-size:13.5px;color:var(--text-muted)">' + htmlEncode(product.distributor || "Non précisé") + '</p>' +
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
            '<a href="https://rappels.conso.gouv.fr" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="text-decoration:none">🏛️ rappels.conso.gouv.fr ↗</a>' +
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
        '<p>Les informations sont issues de la base officielle <strong>RappelConso</strong> gérée par la DGCCRF, disponible sur <a href="https://rappels.conso.gouv.fr" target="_blank" rel="noopener" class="apropos-link">rappels.conso.gouv.fr</a>.</p>' +
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

/** Mappe un enregistrement API vers notre format interne */
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
    source:      "rappels.conso.gouv.fr"
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

  // Met à jour le bouton sans re-render complet
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
  // Re-render la page détail pour mettre à jour le bouton
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

/** Donne le focus à la barre de recherche principale */
function focusNavSearch() {
  const input = document.getElementById("navSearchInput");
  if (input) input.focus();
}

// ===================================================================
// LIGHTBOX ZOOM (identique à consoalert)
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

  // Animation CSS inline
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
// LISTENERS DYNAMIQUES (après injection HTML)
// ===================================================================

function bindPageListeners(page) {
  if (page === "accueil" || page === "alertes") {
    // Listener search nav (sync avec la barre en haut)
    const navInput = document.getElementById("navSearchInput");
    // Already bound globally
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

  // ── Burger menu ──
  const menuBtn = document.getElementById("menuToggle");
  if (menuBtn) menuBtn.addEventListener("click", openSidebarMobile);

  const closeBtn = document.getElementById("sidebarClose");
  if (closeBtn) closeBtn.addEventListener("click", closeSidebarMobile);

  const overlay = document.getElementById("sidebarOverlay");
  if (overlay) overlay.addEventListener("click", closeSidebarMobile);

  // Fermeture sidebar au clic extérieur
  document.addEventListener("click", function(e) {
    if (!e.target.closest("#sidebar") && !e.target.closest("#menuToggle")) {
      closeSidebarMobile();
    }
  });

  // Fermeture sidebar avec Échap
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") closeSidebarMobile();
  });

  // ── Barre de recherche nav ──
  const navInput = document.getElementById("navSearchInput");
  if (navInput) {
    const handleSearchInput = debounce(function() {
      searchTerm = navInput.value;
      // Si on est sur la page alertes, on re-filtre en live
      const { page } = getCurrentPage();
      if (page === "alertes") el_reRenderAlertes();
    }, 300);
    navInput.addEventListener("input", handleSearchInput);
    navInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && navInput.value.trim()) {
        searchTerm = navInput.value.trim();
        activeCategory = "all";
        activeRisk = "all";
        navigateTo("#alertes");
      }
    });
  }

  // ── Bouton "Activer les alertes" ──
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

  // ── Fallback image globale ──
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
