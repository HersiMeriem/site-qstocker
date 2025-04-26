import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'sum' })
export class SumPipe implements PipeTransform {
  transform(items: any[], field: string): number {
    return items?.reduce((a, b) => a + (b[field] || 0), 0) || 0;
  }
}