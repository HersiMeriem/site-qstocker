import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of } from 'rxjs';
import { Expense } from '../models/expense';
import { MaterialPurchase } from '../models/material-purchase';

@Injectable({
  providedIn: 'root'
})
export class FinancialService {
  private apiUrl = 'http://localhost:3000/api/financial'; // Adaptez à votre API

  constructor(private http: HttpClient) { }

  getFinancialData(period: string, startDate?: string, endDate?: string): Observable<any> {
    const params: any = { period };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    return this.http.get(`${this.apiUrl}/dashboard`, { params });
  }

  getExpenses(period: string, startDate?: string, endDate?: string): Observable<Expense[]> {
    const params: any = { period };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    return this.http.get<Expense[]>(`${this.apiUrl}/expenses`, { params });
  }

  getMaterialPurchases(period: string, startDate?: string, endDate?: string): Observable<MaterialPurchase[]> {
    const params: any = { period };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    return this.http.get<MaterialPurchase[]>(`${this.apiUrl}/material-purchases`, { params });
  }

  addExpense(expense: Expense): Observable<Expense> {
    return this.http.post<Expense>(`${this.apiUrl}/expenses`, expense);
  }

  getRevenueBreakdown(period: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/revenue/${period}`);
  }

  generateFinancialReport(params: any): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/generate-report`, params, {
      responseType: 'blob'
    });
  }

  getAdvancedStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/advanced-stats`);
   }

   deleteExpense(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/expenses/${id}`);
  }

  getStockFinancialData(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stock-dashboard`);
  }
}