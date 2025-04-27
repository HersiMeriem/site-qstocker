export interface Product {
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
  discount?: number;
  promotion?: Promotion | null; // Ajout de null comme type possible
  postPromoStatus?: 'active' | 'inactive' | null;
}

interface Promotion {
  startDate: string; // ou Date
  endDate: string;   // ou Date
  discountPercentage: number;
}
