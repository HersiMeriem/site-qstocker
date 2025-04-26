import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  darkMode: WritableSignal<boolean> = signal(false);
  language: WritableSignal<string> = signal('fr');

  constructor() {
    this.loadSettings();
  }

  toggleDarkMode(): void {
    this.darkMode.update(value => !value);
    this.saveSettings();
  }

  setLanguage(lang: string): void {
    this.language.set(lang);
    this.saveSettings();
  }

  private saveSettings(): void {
    localStorage.setItem('darkMode', JSON.stringify(this.darkMode()));
    localStorage.setItem('language', this.language());
  }

  private loadSettings(): void {
    const darkMode = localStorage.getItem('darkMode');
    const language = localStorage.getItem('language');
    
    if (darkMode !== null) this.darkMode.set(JSON.parse(darkMode));
    if (language !== null) this.language.set(language);
  }
}
