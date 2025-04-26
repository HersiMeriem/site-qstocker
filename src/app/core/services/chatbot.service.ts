import { Injectable } from '@angular/core';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import { InventoryService } from './inventory.service';
import { Inventory } from '../models/inventory.model';

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private model: any;
  private inventoryData: Inventory[] = []; // Typage fort

  constructor(private inventoryService: InventoryService) {}

  async initialize(): Promise<void> {
    this.model = await use.load();
    const inventory = await this.inventoryService.getInventory().toPromise();
    if (inventory) {
      this.inventoryData = inventory;
    }
  }

  async processQuestion(question: string): Promise<string> {
    if (!this.model) await this.initialize();
    
    if (this.isStockQuery(question)) {
      return this.handleStockQuery(question);
    }
    return "Je n'ai pas compris votre question. Posez-moi une question sur les stocks ou les prévisions.";
  }

  private isStockQuery(text: string): boolean {
    const stockKeywords = ['stock', 'inventaire', 'quantité', 'disponible'];
    return stockKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    ); // Parenthèse manquante ajoutée
  }

  private handleStockQuery(query: string): string {
    const queryLower = query.toLowerCase();
    const matchingItems = this.inventoryData.filter(item =>
      item.name.toLowerCase().includes(queryLower) ||
      item.id.toLowerCase().includes(queryLower)
    );

    if (matchingItems.length === 0) {
      return "Aucun article trouvé correspondant à votre recherche.";
    }

    return `J'ai trouvé ${matchingItems.length} article(s) correspondant(s) :\n` +
      matchingItems.map(item => 
        `- ${item.name} (ID: ${item.id}) : ${item.currentStock} en stock`
      ).join('\n');
  }
}