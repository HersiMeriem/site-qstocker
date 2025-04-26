import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'userFilter'
})
export class UserFilterPipe implements PipeTransform {
  
  /**
   * Filtre un tableau d'utilisateurs selon une requête et des champs spécifiques
   * @param users Tableau d'utilisateurs à filtrer
   * @param query Texte de recherche
   * @param fields Champs dans lesquels chercher
   * @returns Tableau filtré
   */
  transform(users: any[], query: string, fields: string[]): any[] {
    // Si pas d'utilisateurs ou pas de requête, retourne le tableau original
    if (!users || !query) {
      return users;
    }
    
    // Convertit la requête en minuscules pour une recherche insensible à la casse
    const lowerQuery = query.toLowerCase();
    
    // Filtre les utilisateurs
    return users.filter(user => {
      // Vérifie si au moins un des champs contient la requête
      return fields.some(field => {
        // Récupère la valeur du champ et vérifie s'il contient la requête
        const fieldValue = user[field]?.toString().toLowerCase();
        return fieldValue?.includes(lowerQuery);
      });
    });
  }
}