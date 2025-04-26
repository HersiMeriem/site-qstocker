export interface Product {
price: string|number;
quantite: any;
prixDeVente: string|number;
imageBase64: string;
  nomProduit: any;
  id: string;
  name: string;
  type: string;
  category: string;
  description: string;
  qrCode: string;
  imageUrl: string;
  unitPrice: number;
  costPrice: number;
  volume: string;
  stockQuantity: number;
  manufactureDate: string;
  createdAt: string;
  updatedAt?: string; 
  status: 'active' | 'inactive' | 'promotion';
  discount?: number; // Remise directe (optionnelle)
  promotion?: Promotion; // Détails de la promotion (optionnelle)
  postPromoStatus?: 'active' | 'inactive'; 

}

interface Promotion {
  startDate: string; // ou Date
  endDate: string;   // ou Date
  discountPercentage: number;
}
