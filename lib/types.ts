export interface Recall {
  id: string;
  title: string;
  date: string; // ISO string, e.g., "2024-03-15"
  brand: string;
  risk: 'low' | 'medium' | 'high';
  category: string;
  description: string;
  affectedProducts?: string[];
  reportedDate?: string;
  country?: string;
}