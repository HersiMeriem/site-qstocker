import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  loading: boolean = false;
  isLoginVisible: boolean = true;

  constructor(private authService: AuthService, private router: Router) {}

  async login() {
    if (!this.email || !this.password) {
      alert("❌ Veuillez entrer un email et un mot de passe.");
      return;
    }

    this.loading = true;
    try {
      const response = await this.authService.login(this.email, this.password) as unknown as { user: any; role: string };

      if (!response || !response.user) throw new Error("❌ Échec de la connexion.");

      console.log("✅ Utilisateur connecté :", response.user.email);
      console.log("🔍 Rôle détecté :", response.role);

      if (response.role === 'admin') {
        this.router.navigate(['/admin']);
      } else if (response.role === 'responsable') {
        this.router.navigate(['/responsable']);
      } else {
        alert("❌ Rôle inconnu. Contactez l'administrateur.");
      }
    } catch (error: any) {
      alert(`❌ Erreur : ${error.message || "Un problème est survenu."}`);
    } finally {
      this.loading = false;
    }
  }

  toggleView() {
    this.isLoginVisible = !this.isLoginVisible;
  }
}