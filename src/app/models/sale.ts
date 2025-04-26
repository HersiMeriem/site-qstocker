export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string | null;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  items: SaleItem[];
  subTotal: number;
  discount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  userId: string;
  date: string;
  clientId?: string;  
  customerName: string; 
  customerId: string;  
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
  originalPrice: number;
  editingPrice?: boolean;
  seuil?: number;
  demandPrevue?: number;
  status?: 'active' | 'inactive' | 'promotion';
  discount?: number;
}