import { Component, OnInit } from '@angular/core';
import { AiService } from 'src/app/core/services/ai.service';
import { InventoryService } from 'src/app/core/services/inventory.service';
import { Inventory } from 'src/app/core/models/inventory.model';

interface PredictionItem extends Inventory {
  forecast?: Array<{
    date: string;
    predictedStock: number;
  }>;
}

@Component({
  selector: 'app-ai-dashboard',
  templateUrl: './ai-dashboard.component.html',
  styleUrls: ['./ai-dashboard.component.css']
})
export class AiDashboardComponent implements OnInit {
  predictions: PredictionItem[] = []; // Typage fort
  isLoading = false;
  viewMode: 'table'|'chart' = 'chart';

  constructor(
    private aiService: AiService,
    private inventoryService: InventoryService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadPredictions();
  }

  async loadPredictions(): Promise<void> {
    this.isLoading = true;
    try {
      const inventory = await this.inventoryService.getInventory().toPromise();
      if (inventory) {
        this.predictions = await this.aiService.predictStockDemand(inventory);
      }
    } catch (error) {
      console.error('Prediction error:', error);
    } finally {
      this.isLoading = false;
    }
  }
}