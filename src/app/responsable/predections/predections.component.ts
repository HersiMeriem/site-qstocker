import { Component, OnInit } from '@angular/core';
import { PredictionService } from 'src/app/services/prediction.service';
@Component({
  selector: 'app-predections',
  templateUrl: './predections.component.html',
  styleUrls: ['./predections.component.css']
})
export class PredectionsComponent implements OnInit {
  predictions: any[] = [];
  selectedProductId: string | null = null;
  filteredPredictions: any[] = [];
  uniqueProducts: {id: string, name: string}[] = [];

  constructor(private predictionService: PredictionService) {}

  ngOnInit(): void {
    this.predictionService.getPredictions().subscribe(preds => {
      this.predictions = preds;

      // Liste des produits distincts
      this.uniqueProducts = Array.from(
        new Set(preds.map(p => p.productId))
      ).map(id => {
        const p = preds.find(p => p.productId === id)!;
        return { id: id, name: p.productName };
      });

      if (this.uniqueProducts.length > 0) {
        this.selectedProductId = this.uniqueProducts[0].id;
        this.updateFilteredPredictions();
      }
    });
  }

  updateFilteredPredictions() {
    this.filteredPredictions = this.predictions
      .filter(p => p.productId === this.selectedProductId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
}
