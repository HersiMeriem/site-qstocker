import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {
  email: string = ''; // Champ pour l'email
  loading: boolean = false; // Indicateur de chargement
  message: string = ''; // Message de succès ou d'erreur
  isError: boolean = false; // Indicateur d'erreur

  constructor(private authService: AuthService, private router: Router) {}

  // Fonction pour réinitialiser le mot de passe
  async resetPassword() {
    if (!this.email) {
      this.message = "❌ Veuillez entrer une adresse email valide.";
      this.isError = true;
      return;
    }

    this.loading = true; // Activer le spinner de chargement
    this.message = ''; // Réinitialiser le message

    try {
      // Appeler le service AuthService pour réinitialiser le mot de passe
      await this.authService.resetPassword(this.email);
      this.message = "✅ Un email de réinitialisation a été envoyé à votre adresse.";
      this.isError = false;
    } catch (error: any) {
      this.message = `❌ Erreur : ${error.message || "Un problème est survenu."}`;
      this.isError = true;
    } finally {
      this.loading = false; // Désactiver le spinner de chargement
    }
  }

  // Rediriger vers la page de connexion
  goToLogin() {
    this.router.navigate(['']);
  }
}