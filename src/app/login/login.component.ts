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
  loading: boolean = false;
  isLoginVisible: boolean = true;
  errorMessage: string = '';

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
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%?&])[A-Za-z\d@$!%?&]+$/)
      ]]
    });
  }

async login() {
  if (this.loginForm.invalid) {
    this.markFormGroupTouched(this.loginForm);
    return;
  }

  this.errorMessage = '';
  this.loading = true;

  try {
    const { email, password } = this.loginForm.value;
    const response = await this.authService.login(email, password);

    if (!response) {
      this.errorMessage = 'Erreur inattendue lors de la connexion';
      return;
    }

    // Debug: Afficher les informations utilisateur
    console.log('Utilisateur connecté:', {
      uid: response.user.uid,
      role: response.role,
      email: response.user.email
    });

  } catch (error: any) {
    this.errorMessage = error.message;
    console.error('Erreur de connexion complète:', error);
  } finally {
    this.loading = false;
  }
}

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  toggleView() {
    this.isLoginVisible = !this.isLoginVisible;
  }
} 
