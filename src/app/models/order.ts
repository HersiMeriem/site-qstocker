export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  customerNotes?: string;
  items: CartItem[];
  totalAmount: number;
  shippingFee: number;
  grandTotal: number;
  orderDate: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod: string;
  userId: string;
}


export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productImage?: string;
  brand?: string;
  category?: string;
  stock?: number;
  sellingPrice?: number;
}