import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'arrayFromNumber',
})
export class ArrayFromNumberPipe implements PipeTransform {
  transform(value: number): number[] {
    return new Array(value).fill(0).map((_, index) => index + 1);
  }
}