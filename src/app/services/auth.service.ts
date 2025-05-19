import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(
    private afAuth: AngularFireAuth,
    private router: Router,
    private db: AngularFireDatabase
  ) {}

async login(email: string, password: string): Promise<{ user: any; role: string } | null> {
  try {
    const userCredential = await this.afAuth.signInWithEmailAndPassword(email, password);
    
    if (!userCredential.user) throw new Error('Identifiants incorrects');

    // Force le rafraîchissement du token pour les custom claims
    await userCredential.user.getIdToken(true);
    const idToken = await userCredential.user.getIdTokenResult();
    const role = idToken.claims['role'] as string;

    // Vérification dans la base de données
    const uid = userCredential.user.uid;
    const snapshot = await this.db.object(`users/${uid}`).query.ref.once('value');
    const userData = snapshot.val();

    if (!userData) throw new Error("Compte non trouvé dans la base de données");
    
    // Vérification du statut
    if (userData.status !== 'approved') {
      throw new Error("Votre compte est en attente d'approbation par l'administrateur");
    }

    // Vérification cohérence des rôles
    if (role !== userData.role) {
      console.warn('Incohérence de rôle:', { claimsRole: role, dbRole: userData.role });
      // Forcer la synchronisation
      await userCredential.user.getIdToken(true);
    }

    // Redirection basée sur le rôle
    switch(userData.role) {
      case 'admin': 
        await this.router.navigate(['/admin']);
        break;
      case 'responsable': 
        await this.router.navigate(['/responsable']);
        break;
      default:
        throw new Error("Rôle non autorisé");
    }

    return { user: userCredential.user, role: userData.role };

  } catch (error: any) {
    console.error('Erreur de connexion:', error);
    
    let message = 'Échec de la connexion';
    switch(error.code) {
      case 'auth/invalid-login-credentials':
        message = 'Email ou mot de passe incorrect';
        break;
      case 'auth/too-many-requests':
        message = 'Trop de tentatives, réessayez plus tard';
        break;
      default:
        message = error.message || 'Erreur lors de la connexion';
    }
    
    throw new Error(message);
  }
}

  async register(email: string, password: string, additionalData: any = {}): Promise<any> {
    try {
      const userCredential = await this.afAuth.createUserWithEmailAndPassword(email, password);

      if (!userCredential.user) {
        throw new Error("❌ Échec de l'inscription.");
      }

      const uid = userCredential.user.uid;

      // Ajout des données utilisateur dans la base de données
      await this.db.object(`users/${uid}`).set({
        email,
        role: 'responsable',
        status: 'pending',
        ...additionalData
      });

      alert("✅ Compte créé avec succès, en attente d'approbation.");
      return userCredential.user;

    } catch (error: any) {
      alert(`❌ Erreur : ${error.message}`);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.afAuth.signOut();
      this.router.navigate(['/login']);
    } catch (error: any) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  }

  getCurrentUser() {
    return this.afAuth.authState;
  }

  async resetPassword(email: string): Promise<void> {
    try {
      if (!email) {
        throw new Error("❌ Veuillez entrer une adresse email valide.");
      }

      await this.afAuth.sendPasswordResetEmail(email);
      alert("✅ Un email de réinitialisation a été envoyé à votre adresse.");
    } catch (error: any) {
      alert(`❌ Erreur : ${error.message}`);
    }
  }

  // Méthodes supplémentaires pour la gestion de profil
  async updateUserProfile(uid: string, data: any): Promise<void> {
    try {
      await this.db.object(`users/${uid}`).update(data);
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      throw error;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error('Aucun utilisateur connecté');
      }
      
      // Re-authentification
      const credential = await this.afAuth.signInWithEmailAndPassword(user.email!, currentPassword);
      await credential.user?.updatePassword(newPassword);
    } catch (error: any) {
      console.error('Erreur lors du changement de mot de passe:', error);
      throw error;
    }
  }

async getCurrentUserId(): Promise<string | null> {
  const user = await this.afAuth.currentUser;
  return user?.uid || null;
}

get currentUserValue() {
  return this.afAuth.currentUser;
} 


async getUserData(uid: string): Promise<any> {
  const snapshot = await this.db.object(`users/${uid}`).query.ref.once('value');
  return snapshot.val();
} 

}