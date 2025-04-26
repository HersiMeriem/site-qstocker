export interface MaterialPurchase {
    id: string;
    date: string;
    items: {
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }[];
    supplier: string;
    paymentMethod: string;
    totalAmount: number;
    invoiceNumber?: string;
  }