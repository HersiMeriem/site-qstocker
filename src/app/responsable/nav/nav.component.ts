import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service'; 
import { Router } from '@angular/router'; 
import { ProfileImageService } from '../../services/profile-image.service';
import { Subscription } from 'rxjs';
@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.css']
})
export class NavComponent {
profileImageUrl: string = 'assets/images/responsable.png';
private imageSubscription: Subscription = new Subscription();
  constructor(private authService: AuthService, private router: Router,  private profileImageService: ProfileImageService ) { }

// Ajoutez ngOnInit et ngOnDestroy
ngOnInit() {
  this.imageSubscription = this.profileImageService.currentProfileImage.subscribe(imageUrl => {
    this.profileImageUrl = imageUrl;
  });
}

ngOnDestroy() {
  if (this.imageSubscription) {
    this.imageSubscription.unsubscribe();
  }
}
    // Déconnexion
    logout() {
      this.authService.logout().then(() => {
        this.router.navigate(['/login']); // Rediriger vers la page de connexion
      }).catch(error => {
        console.error("Erreur lors de la déconnexion :", error);
        alert("❌ Une erreur s'est produite lors de la déconnexion.");
      });
    }
  
// meriem
  handleNotificationClick(event: MouseEvent) {
    event.stopPropagation(); // Empêche la propagation de l'événement
    // Vous pouvez ajouter d'autres logiques ici si nécessaire
  }
}