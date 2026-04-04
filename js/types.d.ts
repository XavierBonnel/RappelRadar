/**
 * Types TypeScript pour RappelRadar v2
 * 
 * Ce fichier déclare les interfaces utilisées dans l'application.
 * Il peut être référencé par des outils de type checking (ex: JSDoc avec @ts-check).
 */

export interface Recall {
  /** Code GTIN / EAN du produit */
  code: string;
  /** Nom du produit */
  name: string;
  /** Marque du produit */
  brand: string;
  /** Catégorie : Alimentaire, Médicaments, Cosmétiques, Jouets, Électronique, Vêtements, Maison */
  category: string;
  /** Distributeur(s) */
  distributor: string;
  /** Motif du rappel */
  reason: string;
  /** Niveau de sévérité : danger, preventif, information */
  severity: 'danger' | 'preventif' | 'information';
  /** Date de publication (format JJ/MM/AAAA) */
  date: string;
  /** URL de l'image du produit (Open Food Facts ou autre) */
  image: string;
  /** Source (ex: rappels.conso.gouv.fr) */
  source: string;
}

export interface RecallWithMeta extends Recall {
  /** Date d'ajout à la liste (ISO string) */
  addedAt?: string;
}

/** État global des filtres */
export interface FilterState {
  activeRisk: 'all' | 'danger' | 'preventif' | 'information';
  activeCategory: 'all' | 'Alimentaire' | 'Médicaments' | 'Cosmétiques' | 'Jouets' | 'Électronique' | 'Vêtements' | 'Maison';
  activeSort: 'date' | 'criticite' | 'categorie';
  activeDays: '7' | '30' | '90';
  searchTerm: string;
}