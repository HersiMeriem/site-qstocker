import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  getUserProfile: any;
  currentUserValue: any;


  showError: any;
  showSuccess: any;
  updateUserProfile: any;
  updatePassword(oldPassword: any, newPassword: any) {
    throw new Error('Method not implemented.');
  }
  reauthenticateUser(arg0: string, oldPassword: string) {
    throw new Error('Method not implemented.');
  }
  getCurrentUserId // ✅ Déconnexion
    () {
    throw new Error('Method not implemented.');
  }
  changePassword(currentPassword: string, newPassword: string) {
    throw new Error('Method not implemented.');
  }
  constructor(
    private afAuth: AngularFireAuth,
    private router: Router,
    private db: AngularFireDatabase,
    
  ) {}

  async login(email: string, password: string) {
    try {
      const userCredential = await this.afAuth.signInWithEmailAndPassword(email, password);

      if (!userCredential.user) {
        throw new Error('❌ Connexion échouée.');
      }

      const uid = userCredential.user.uid;

      // ✅ Vérifier que l'utilisateur existe dans Firebase Database
      const userRef = this.db.object(`users/${uid}`);
      const userSnapshot = await firstValueFrom(userRef.valueChanges());

      if (!userSnapshot) {
        throw new Error("❌ Utilisateur introuvable en base de données.");
      }

      const userData = userSnapshot as any; // ✅ Accès aux données utilisateur

      // ✅ Vérification du statut d'approbation
      if (userData.status !== 'approved') {
        throw new Error("❌ Votre compte est en attente d'approbation.");
      }

      // ✅ Vérification du rôle utilisateur
      const role = userData.role;
      if (!role) {
        throw new Error("❌ Aucun rôle trouvé. Contactez l'administrateur.");
      }

      // ✅ Redirection selon le rôle
      if (role === 'admin') {
        this.router.navigate(['/admin']);
      } else if (role === 'responsable') {
        this.router.navigate(['/responsable']);
      } else {
        throw new Error("❌ Rôle inconnu. Contactez l'administrateur.");
      }

      return { user: userCredential.user, role };

    } catch (error: any) {
      alert(`❌ Erreur : ${error.message}`);
      return null;
    }
  }

  // ✅ Inscription avec statut "pending" dans Firebase Database
  async register(email: string, password: string) {
    try {
      const userCredential = await this.afAuth.createUserWithEmailAndPassword(email, password);

      if (!userCredential.user) {
        throw new Error("❌ Échec de l'inscription.");
      }

      const uid = userCredential.user.uid;

      // ✅ Ajouter l'utilisateur à Firebase Database avec le statut "pending"
      await this.db.object(`users/${uid}`).set({
        email,
        role: 'responsable',
        status: 'pending' // En attente d'approbation par l'admin
      });

      alert("✅ Compte créé avec succès, en attente d'approbation.");
      return userCredential.user;

    } catch (error: any) {
      alert(`❌ Erreur : ${error.message}`);
      return null; // ✅ Ajout d'un `return` pour éviter l'erreur TS7030
    }
  }

  // ✅ Déconnexion
  logout() {
    return this.afAuth.signOut();

  }

  // ✅ Obtenir l'utilisateur connecté
  getCurrentUser() {
    return this.afAuth.authState;
  }

  // ✅ Réinitialisation du mot de passe
  async resetPassword(email: string) {
    try {
      if (!email) {
        throw new Error("❌ Veuillez entrer une adresse email valide.");
      }

      // Envoyer un email de réinitialisation du mot de passe
      await this.afAuth.sendPasswordResetEmail(email);
      alert("✅ Un email de réinitialisation a été envoyé à votre adresse.");
    } catch (error: any) {
      alert(`❌ Erreur : ${error.message}`);
    }
  }
}

