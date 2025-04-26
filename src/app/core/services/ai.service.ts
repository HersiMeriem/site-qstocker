import { Injectable } from '@angular/core';
import { format, addDays } from 'date-fns';
import { Inventory } from '../models/inventory.model';
import { InventoryService } from './inventory.service';
import * as tf from '@tensorflow/tfjs';
interface PredictionResult extends Inventory {
  forecast: ForecastItem[];
}

interface ForecastItem {
  date: string;
  predictedStock: number;
}

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private model: tf.LayersModel | null = null;

  constructor() {}

  async initializeModel(): Promise<void> {
    try {
      this.model = await tf.loadLayersModel('assets/models/stock-model.json');
    } catch (error) {
      console.error('Failed to load model:', error);
      throw error;
    }
  }

  async predictStockDemand(items: Inventory[], days: number = 7): Promise<PredictionResult[]> {
    if (!this.model) {
      await this.initializeModel();
    }

    if (!items || items.length === 0) {
      throw new Error('Items array cannot be empty');
    }

    // Préparation des données d'entrée
    const inputData = items.map(item => [
      item.currentStock,
      item.monthlySales.reduce((sum: any, val: any) => sum + val, 0) / item.monthlySales.length,
      item.leadTime
    ]);

    const inputTensor = tf.tensor3d([inputData]);
    const outputTensor = this.model!.predict(inputTensor) as tf.Tensor;
    const predictions = await outputTensor.array() as number[][][];

    // Formatage des résultats
    return items.map((item, index) => {
      const forecast: ForecastItem[] = [];
      const currentDate = new Date();

      for (let i = 0; i < days; i++) {
        forecast.push({
          date: format(addDays(currentDate, i + 1), 'yyyy-MM-dd'),
          predictedStock: Math.round(predictions[0][index][i])
        });
      }

      return {
        ...item,
        forecast
      };
    });
  }
}