import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { map, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private afAuth: AngularFireAuth,
    private db: AngularFireDatabase,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
  return new Promise((resolve) => {
    this.afAuth.authState.pipe(take(1)).subscribe(async user => {
      if (user) {
        try {
          // Obtenir les rôles requis depuis les données de route
          const requiredRoles = route.data['roles'] as Array<string>;

          // Récupérer le rôle de l'utilisateur connecté
          const userRole = await this.getUserRole(user.uid);

          console.log('Rôle requis:', requiredRoles, 'Rôle utilisateur:', userRole);

          if (!requiredRoles || requiredRoles.length === 0) {
            // Si aucun rôle requis, autoriser l'accès
            resolve(true);
          } else if (requiredRoles.includes(userRole)) {
            // Si le rôle de l'utilisateur est autorisé
            resolve(true);
          } else {
            // Rôle non autorisé
            this.router.navigate(['/unauthorized']);
            resolve(false);
          }

        } catch (error) {
          console.error('Erreur lors de la vérification du rôle:', error);
          this.router.navigate(['/unauthorized']);
          resolve(false);
        }
      } else {
        // Utilisateur non connecté
        this.router.navigate(['/']);
        resolve(false);
      }
    });
  });
}


  private async getUserRole(uid: string): Promise<string> {
    try {
      const snapshot = await this.db.object(`users/${uid}/role`).valueChanges().pipe(take(1)).toPromise();
      return snapshot as string;
    } catch (e) {
      console.error('Error fetching user role', e);
      return '';
    }
  }
}
