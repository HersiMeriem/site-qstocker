import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  setTheme(theme: string) {
    throw new Error('Method not implemented.');
  }
  private isDarkMode = false;

  constructor() {
    // Vérifier si un thème est déjà stocké dans le localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.isDarkMode = true;
      document.body.classList.add('dark-mode');
    }
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark'); // Sauvegarder le thème dans le localStorage
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light'); // Sauvegarder le thème dans le localStorage
    }
  }

  isDarkModeEnabled(): boolean {
    return this.isDarkMode;
  }
}