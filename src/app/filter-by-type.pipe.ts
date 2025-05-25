// filter-by-type.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { Activity } from '../models/activity.model';

@Pipe({
  name: 'filterByType'
})
export class FilterByTypePipe implements PipeTransform {
  transform(activities: Activity[], type: string): Activity[] {
    if (!activities) return [];
    if (type === 'all') return activities;
    return activities.filter(activity => activity.type === type);
  }
}