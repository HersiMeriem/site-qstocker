export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string | null;
  originalPrice?: number; 
  
  

}

export interface Sale {
  id: string;
  invoiceNumber: string;
  items: SaleItem[];
  subTotal: number;
  discount: number;
  discountAmount: number;
  totalAmount: number; // Gardez seulement totalAmount comme montant total
  paymentMethod: string;
  userId: string;
  date: string;
  clientId?: string;  
  customerName: string; 
  customerId: string; 
  location?: string;
}

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
  status: 'active' | 'inactive' | 'promotion'| 'out-of-stock';
  discount?: number;
  promotion?: Promotion; 
  seuil?: number;
}

interface Promotion {
  startDate: string; // ou Date
  endDate: string;   // ou Date
  discountPercentage: number;
}