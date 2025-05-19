import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { AngularFireDatabase } from '@angular/fire/compat/database';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  @ViewChild('registerForm') registerForm!: NgForm;
  @Output() goToLogin = new EventEmitter<void>();

  // Données du formulaire
  Name: string = '';
  email: string = '';
  password: string = '';
  
  // États du composant
  showPassword: boolean = false;
  loading: boolean = false;
  
  // Validation
  hasMinLength: boolean = false;
  hasUpperCase: boolean = false;
  hasNumber: boolean = false;
  hasSpecialChar: boolean = false;
  
  // Messages d'erreur
  emailError: string = '';
  passwordError: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private db: AngularFireDatabase
  ) {}

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  validatePassword(): void {
    this.hasMinLength = this.password?.length >= 8;
    this.hasUpperCase = /[A-Z]/.test(this.password);
    this.hasNumber = /[0-9]/.test(this.password);
    this.hasSpecialChar = /[^A-Za-z0-9]/.test(this.password);
    
    // Gardez la logique d'erreur pour la soumission
    if (this.registerForm?.submitted) {
      if (!this.password) {
        this.passwordError = "Le mot de passe est obligatoire";
      } else if (!this.hasMinLength || !this.hasUpperCase || !this.hasNumber || !this.hasSpecialChar) {
        this.passwordError = "Le mot de passe ne respecte pas les exigences";
      } else {
        this.passwordError = '';
      }
    }
  }

  validateEmail(): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Ne pas valider si le formulaire n'a pas été soumis
    if (!this.registerForm?.submitted) return;
    
    if (!this.email) {
      this.emailError = "L'email est obligatoire";
    } else if (!emailRegex.test(this.email)) {
      this.emailError = "Veuillez entrer une adresse email valide";
    } else {
      this.emailError = '';
    }
  }

  validateForm(): boolean {
    let isValid = true;
    
    // Validation email
    this.validateEmail();
    if (this.emailError) {
      isValid = false;
    }
    
    // Validation mot de passe
    this.validatePassword();
    if (!this.password) {
      this.passwordError = "Le mot de passe est obligatoire";
      isValid = false;
    } else if (!this.hasMinLength || !this.hasUpperCase || !this.hasNumber || !this.hasSpecialChar) {
      this.passwordError = "Le mot de passe ne respecte pas les exigences";
      isValid = false;
    }
    
    return isValid;
  }
  async register(): Promise<void> {
    // Marquer le formulaire comme soumis
    this.registerForm.form.markAllAsTouched();
    
    // Réinitialiser les erreurs
    this.emailError = '';
    this.passwordError = '';
  
    // Validation initiale des champs requis
    if (!this.email) {
      this.emailError = "L'email est obligatoire";
    }
    
    if (!this.password) {
      this.passwordError = "Le mot de passe est obligatoire";
    }
    
    // Si champs requis vides, on ne va pas plus loin
    if (!this.email || !this.password) {
      return;
    }
    
    // Validation complète du formulaire
    this.validateEmail();
    this.validatePassword();
    
    if (this.emailError || this.passwordError) {
      return;
    }
  
    this.loading = true;
    
    try {
      const userCredential = await this.authService.register(this.email, this.password);
      
      if (userCredential) {
        await this.db.object(`users/${userCredential.uid}`).set({
          name: this.Name,
          email: this.email,
          role: 'responsable',
          status: 'pending',
          createdAt: new Date().toISOString()
        });
        
        this.router.navigate(['/']);
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        this.emailError = "Cet email est déjà utilisé. Veuillez vous connecter.";
      } else if (error.code === 'auth/weak-password') {
        this.passwordError = "Le mot de passe est trop faible";
      } else {
        this.emailError = "Une erreur est survenue lors de l'inscription";
      }
    } finally {
      this.loading = false;
    }
  }
 
} 

