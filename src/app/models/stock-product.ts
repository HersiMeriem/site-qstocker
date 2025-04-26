// models/stock-product.model.ts
export interface StockProduct {
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
    
    qrCode?: string;
    imageUrl?: string;
    description?: string;
    type?: string;
    category?: string;
  }