import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'statusLabel'
})
export class StatusLabelPipe implements PipeTransform {
  transform(value: string): string {
    const statusMap: {[key: string]: string} = {
      'active': 'Actif',
      'inactive': 'Inactif',
      'promotion': 'En promotion',
      'out_of_stock': 'Rupture de stock',
      'new': 'Nouveau'
    };
    return statusMap[value] || value;
  }
}