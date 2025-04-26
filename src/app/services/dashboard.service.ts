import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { StockService } from './stock.service';
import { SaleService } from './sale.service';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(
    private stockService: StockService,
    private saleService: SaleService
  ) {}

  getKPIs(): Observable<any> {
    return this.stockService.getStock().pipe(
      map(stock => {
        let totalStockCost = 0;
        let totalUnsoldValue = 0;
        let criticalValue = 0;

        for (const item of stock) {
          totalStockCost += item.quantite * item.prixUnitaireHT;
          if (item.quantite > item.seuil * 2 || item.quantite <= item.seuil) {
            criticalValue += item.quantite * item.prixUnitaireHT;
          }
          if (item.quantite > 20) {
            totalUnsoldValue += item.quantite * item.prixUnitaireHT;
          }
        }

        return {
          'coût total du stock': totalStockCost,
          'produits périmés / invendus': totalUnsoldValue,
          'stocks critiques': criticalValue,
          'valeur pertes contrefaçons': 120.75,
          'économies logistiques': 320.30
        };
      })
    );
  }
}
