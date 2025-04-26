import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { AppService } from './app.service';
import { RouterOutlet } from '@angular/router';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {


  title(title: any) {
    throw new Error('Method not implemented.');
  }
  userEmail: string | null = null;

  constructor(private authService: AuthService,private appService: AppService) {

  }


  ngOnInit() {
    this.authService.getCurrentUser().subscribe(user => {
      console.log("🟢 Utilisateur détecté :", user);
      this.userEmail = user ? user.email : null;
    });
    this.appService.initializeScheduledChecks();
  }

  logout() {
    this.authService.logout().then(() => {
      console.log('🔴 Déconnexion réussie');
      this.userEmail = null;
    });
  }


}
