import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Prediction } from '../models/prediction';

@Injectable({ providedIn: 'root' })
export class PredictionService {
  private dbUrl = 'https://qstockerpfe-default-rtdb.firebaseio.com/predictions.json';

  constructor(private http: HttpClient) {}

  getPredictions() {
    return this.http.get<{[key: string]: any}>(this.dbUrl).pipe(
      map(data => {
        const predictions: Prediction[] = [];
        if (!data) return predictions;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const productId in data) {
          const productData = data[productId];
          const productName = productData.productName || `Produit ${productId}`;
          
          for (const dateStr in productData) {
            if (dateStr !== 'productName') {
              const predDate = new Date(dateStr);
              if (predDate >= today) {
                predictions.push({
                  productId: productId,
                  productName: productName,
                  date: dateStr,
                  predicted_quantity: productData[dateStr]
                });
              }
            }
          }
        }
        
        // Trier par date
        return predictions.sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
      })
    );
  }

  runManualPrediction() {
    return this.http.post('https://your-cloud-function-url/runPrediction', {});
  }
}