import { Pipe, PipeTransform } from '@angular/core';
import { Product } from '../models/product';

@Pipe({
  name: 'filtee'
})
export class FilteePipe implements PipeTransform {
  transform(products: Product[], searchText: string): Product[] {
    if (!products) return [];
    if (!searchText) return products;

    return products.filter(product => {
      return product.name.toLowerCase().includes(searchText.toLowerCase());
    });
  }
}