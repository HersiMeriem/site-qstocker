export interface StockItem {
  idProduit: string;
  nomProduit: string;
  quantite: number;
  prixUnitaireHT: number;
  prixDeVente: number;
  dateMiseAJour: string;
  historiquePrix?: Array<{
    date: string;
    prix: number;
    quantiteAjoutee: number;
  }>;
  qrCode?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  editingPrice?: boolean;
  originalPrice?: number;
  status: 'active' | 'inactive' | 'promotion';
  discount?: number;
  promotion?: Promotion | boolean; 
  seuil?: number;
}

interface Promotion {
  startDate: string; // ou Date
  endDate: string;   // ou Date
  discountPercentage: number;
}