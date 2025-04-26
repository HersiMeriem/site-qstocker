import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate'
})
export class TruncatePipe implements PipeTransform {
  transform(
    value: string, 
    limit: number = 25, 
    completeWords: boolean = false, 
    ellipsis: string = '...',
    forceEllipsis: boolean = false
  ): string {
    if (!value) return '';

    if (value.length <= limit) {
      return forceEllipsis ? value + ellipsis : value;
    }

    if (completeWords) {
      const lastSpaceIndex = value.substr(0, limit).lastIndexOf(' ');
      limit = lastSpaceIndex !== -1 ? lastSpaceIndex : limit;
    }

    return `${value.substr(0, limit)}${ellipsis}`;
  }
}