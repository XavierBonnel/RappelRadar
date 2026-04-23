# 📡 RappelRadar

Application web permettant de consulter et suivre les rappels de produits officiels en France, publiés par la DGCCRF via le portail [rappel.conso.gouv.fr](https://rappel.conso.gouv.fr).

## Fonctionnalités

- **Alertes en temps réel** — consultation des rappels produits via l'API RappelConso (données économie.gouv.fr), avec fallback sur données de démonstration hors connexion
- **Filtres avancés** — par niveau de risque (danger, préventif, information), catégorie de produit, période (7j / 30j / 90j) et tri (date, criticité, catégorie)
- **Recherche** — par nom de produit, marque, code-barres ou distributeur
- **Fiche détail produit** — photo, motif du rappel, code-barres, dates, distributeur avec logo
- **Ma liste** — sauvegarde locale de produits à surveiller (localStorage)
- **Podium distributeurs** — classement des enseignes du moins au plus rappelé, cliquable pour filtrer les produits associés
- **Logos distributeurs** — reconnaissance automatique de plus de 40 enseignes françaises avec affichage de leur logo
- **Notifications navigateur** — alertes push opt-in

## Stack technique

Vanilla JavaScript, HTML5, CSS3 — aucune dépendance, aucun framework, aucun bundler.

- Routing hash-based (`#accueil`, `#alertes`, `#maliste`, `#produit`, `#apropos`)
- Injection HTML via `innerHTML` (SPA mono-fichier)
- Persistance via `localStorage`
- API : `data.economie.gouv.fr` — dataset RappelConso v2

## Lancer le projet

Aucune installation requise. Il suffit d'ouvrir `index.html` dans un navigateur, ou de servir le dossier avec n'importe quel serveur statique :

```bash
npx serve .
# ou
python3 -m http.server 8080
```

## Sources de données

- [RappelConso](https://rappel.conso.gouv.fr) — portail officiel des rappels de produits
- [DGCCRF](https://www.economie.gouv.fr/dgccrf) — Direction Générale de la Concurrence, de la Consommation et de la Répression des Fraudes
- API publique : `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records`
