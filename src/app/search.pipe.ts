import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'search',
})
export class SearchPipe implements PipeTransform {
  transform(users: any[], searchQuery: string): any[] {
    if (!users || !searchQuery) {
      return users;
    }
    return users.filter(
      (user) =>
        (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.status && user.status.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }
}