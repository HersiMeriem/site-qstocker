import { Component, EventEmitter, Output } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { AngularFireDatabase } from '@angular/fire/compat/database';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  email: string = '';
  password: string = '';
  loading: boolean = false;
  Name: string = '';

  @Output() goToLogin = new EventEmitter<void>();

  constructor(
    private authService: AuthService,
    private router: Router,
    private db: AngularFireDatabase
  ) {}

  async register() {
    if (!this.email || !this.password || !this.Name) {
      alert("❌ Veuillez remplir tous les champs.");
      return;
    }

    this.loading = true;
    try {
      const userCredential = await this.authService.register(this.email, this.password);
      if (!userCredential) {
        throw new Error("❌ Échec de l'inscription.");
      }

      const uid = userCredential.uid;
      
      await this.db.object(`users/${uid}`).set({
        email: this.email,
        name: this.Name,
        role: 'responsable',
        status: 'pending'
      });

      alert("✅ Compte créé avec succès ! En attente d'approbation.");
      this.router.navigate(['/']);  
    } catch (error: any) {
      alert(`❌ Erreur : ${error.message}`);
    } finally {
      this.loading = false;
    }
  }
}