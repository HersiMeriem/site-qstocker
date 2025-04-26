import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service'; 
import { Router } from '@angular/router'; 

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.css']
})
export class NavComponent {

  constructor(private authService: AuthService, private router: Router) { }


    // Déconnexion
    logout() {
      this.authService.logout().then(() => {
        this.router.navigate(['/login']); // Rediriger vers la page de connexion
      }).catch(error => {
        console.error("Erreur lors de la déconnexion :", error);
        alert("❌ Une erreur s'est produite lors de la déconnexion.");
      });
    }
  

}