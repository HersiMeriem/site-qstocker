
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'totalUnpaid' })
export class TotalUnpaidPipe implements PipeTransform {
  transform(commandes: any[]): number {
    return commandes?.filter(c => 
      c.paymentStatus === 'En attente' || c.paymentStatus === 'En retard'
    ).reduce((a, b) => a + (b.totalTTC || 0), 0) || 0;
  }
}