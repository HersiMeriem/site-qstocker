// financial.models.ts
export interface FinancialData {
    totalRevenue: number;
    netProfit: number;
    totalExpenses: number;
    cashFlow: number;
    cashIn: number;
    cashOut: number;
    revenueTrend: number;
    expensesByCategory: ExpenseCategory[];
    revenueDetails: RevenueDetail[];
    detailedExpenses: DetailedExpense[];
    kpis: KPI[];
  }
  
  export interface ExpenseCategory {
    category: string;
    amount: number;
    percentage: number;
    trend: number;
  }
  
  export interface RevenueDetail {
    source: string;
    amount: number;
    percentage: number;
    trend: number;
  }
  
  export interface DetailedExpense {
    type: string;
    amount: number;
    date: string;
    responsible: string;
  }
  
  export interface KPI {
    name: string;
    current: number;
    previous: number;
    trend: number;
    target: number;
    achievement: number;
    format: string;
  }
  
  export interface Department {
    id: string;
    name: string;
    revenue?: number;
    profit?: number;
  }