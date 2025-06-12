export interface Product {
  id: string;
  name: string;
  brand: string;
  perfumeType: string;
  olfactiveFamily: string;
  origin: string;
  category: string;
  description: string;
  qrCode: string;       
  qrCodeImage?: string; 
  imageUrl?: string;
  unitPrice: number;
  costPrice: number;
  volume: string;
  type: string; 
  stockQuantity: number;
  manufactureDate: string;
  createdAt: string;
  updatedAt?: string;
  originalPrice?: number;
  status: 'active' | 'inactive' | 'promotion' | 'out-of-stock';
  discount?: number;
  promotion?: Promotion | null;
  postPromoStatus?: 'active' | 'inactive' | null;
  isAuthentic?: boolean;
}

interface Promotion {
  startDate: string;
  endDate: string;
  discountPercentage: number;
}