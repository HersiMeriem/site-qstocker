import { Component, OnInit } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { SnapshotAction } from '@angular/fire/compat/database';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css'],
})
export class UserManagementComponent implements OnInit {
  getPendingUsers(): any[] {
    throw new Error('Method not implemented.');
  }
  users: any[] = []; 
  filteredUsers: any[] = []; 
  searchQuery: string = ''; 

  constructor(private db: AngularFireDatabase) {}

  ngOnInit() {
    this.getUsers();
  }

  // Récupérer tous les utilisateurs
  getUsers() {
    this.db
      .list('users')
      .snapshotChanges()
      .subscribe((users: SnapshotAction<any>[]) => {
        this.users = users.map((user) => {
          const userData = user.payload.val() as any;
          return { uid: user.key, ...userData };
        });
        console.log('Utilisateurs récupérés :', this.users); // Debug
        this.filteredUsers = this.users; // Initialiser les utilisateurs filtrés
      });
  }

  // Appliquer la recherche
  applySearch() {
    console.log('Recherche en cours :', this.searchQuery); // Debug
    if (!this.searchQuery) {
      this.filteredUsers = this.users; // Si la recherche est vide, afficher tous les utilisateurs
      console.log('Aucune recherche, affichage de tous les utilisateurs :', this.filteredUsers); // Debug
      return;
    }
  
    this.filteredUsers = this.users.filter(
      (user) =>
        (user.name && user.name.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
        (user.email && user.email.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
        (user.status && user.status.toLowerCase().includes(this.searchQuery.toLowerCase()))
    );
    console.log('Utilisateurs filtrés :', this.filteredUsers); // Debug
  }
  // Approuver un utilisateur
  approveUser(uid: string) {
    this.db
      .object(`users/${uid}/status`)
      .set('approved')
      .then(() => {
        alert('✅ Utilisateur approuvé !');
      })
      .catch((error) => alert(`❌ Erreur : ${error.message}`));
  }

  // Refuser un utilisateur
  rejectUser(uid: string) {
    this.db
      .object(`users/${uid}`)
      .remove()
      .then(() => {
        alert('❌ Utilisateur supprimé !');
      })
      .catch((error) => alert(`❌ Erreur : ${error.message}`));
  }

  // Bloquer un utilisateur
  blockUser(uid: string) {
    this.db
      .object(`users/${uid}/status`)
      .set('blocked')
      .then(() => {
        alert('✅ Utilisateur bloqué !');
      })
      .catch((error) => alert(`❌ Erreur : ${error.message}`));
  }

  // Débloquer un utilisateur
  unblockUser(uid: string) {
    this.db
      .object(`users/${uid}/status`)
      .set('approved')
      .then(() => {
        alert('✅ Utilisateur débloqué !');
      })
      .catch((error) => alert(`❌ Erreur : ${error.message}`));
  }


}