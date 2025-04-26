import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service'; 
import { Router } from '@angular/router'; 
import { ThemeService } from '../../theme.service';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {

  profilePhoto$ = this.profileService.profilePhoto$;
  constructor(private authService: AuthService, private router: Router, private themeService: ThemeService,private profileService: ProfileService) {
    this.isDarkMode = this.themeService.isDarkModeEnabled();

   }

  logout() {
    this.authService.logout().then(() => {
      this.router.navigate(['/login']); 
    }).catch((error: any) => {
      console.error('Erreur lors de la déconnexion :', error);
    });
  }

  

  isDarkMode = false;

  toggleTheme(): void {
    this.themeService.toggleTheme();
    this.isDarkMode = this.themeService.isDarkModeEnabled();
  }
}