import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {
  email: string = '';
  loading: boolean = false;
  message: string = '';
  isError: boolean = false;

  constructor(private authService: AuthService, private router: Router) {}

  async resetPassword() {
    if (!this.email) {
      this.message = "❌ Veuillez entrer une adresse email valide.";
      this.isError = true;
      return;
    }

    this.loading = true;
    this.message = '';

    try {
      await this.authService.resetPassword(this.email);
      this.message = "✅ Un email de réinitialisation a été envoyé à votre adresse.";
      this.isError = false;
    } catch (error: any) {
      this.message = `❌ Erreur : ${error.message || "Un problème est survenu."}`;
      this.isError = true;
    } finally {
      this.loading = false;
    }
  }

  goToLogin() {
    this.router.navigate(['']);
  }
}