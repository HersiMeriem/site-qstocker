import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  isLoginVisible = true;
  errorMessage = '';
  fieldErrors: { email?: string; password?: string } = {};

  constructor(
    private authService: AuthService, 
    private router: Router,
    private fb: FormBuilder
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
      ]]
    });
  }

  async login() {
    // Réinitialisation des messages d'erreur
    this.errorMessage = '';
    this.fieldErrors = {};

    // Vérification de la validité du formulaire
    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      this.setFieldErrors();
      return;
    }

    this.loading = true;

    try {
      const { email, password } = this.loginForm.value;
      const response = await this.authService.login(email, password);

      if (!response) {
        this.errorMessage = 'Une erreur est survenue lors de la connexion';
        return;
      }

      // Redirection après connexion réussie
      this.router.navigate(['/dashboard']);

    } catch (error: any) {
      this.handleLoginError(error);
    } finally {
      this.loading = false;
    }
  }

  private setFieldErrors(): void {
    const emailControl = this.loginForm.get('email');
    const passwordControl = this.loginForm.get('password');

    if (emailControl?.errors?.['required']) {
      this.fieldErrors.email = 'L\'email est obligatoire';
    } else if (emailControl?.errors?.['email']) {
      this.fieldErrors.email = 'L\'adresse email est invalide';
    }

    if (passwordControl?.errors?.['required']) {
      this.fieldErrors.password = 'Le mot de passe est obligatoire';
    } else if (passwordControl?.errors?.['minlength']) {
      this.fieldErrors.password = 'Minimum 8 caractères requis';
    }
  }

  private handleLoginError(error: any): void {
    console.error('Erreur de connexion:', error);
    
    switch (error.code) {
      case 'auth/user-not-found':
        this.fieldErrors.email = 'Aucun compte associé à cet email';
        break;
      case 'auth/wrong-password':
        this.fieldErrors.password = 'Mot de passe incorrect';
        break;
      case 'auth/too-many-requests':
        this.errorMessage = 'Trop de tentatives. Veuillez réessayer plus tard.';
        break;
      default:
        this.errorMessage = error.message || 'Une erreur est survenue lors de la connexion';
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  toggleView(): void {
    this.isLoginVisible = !this.isLoginVisible;
    this.errorMessage = '';
    this.fieldErrors = {};
    this.loginForm.reset();
  }
}