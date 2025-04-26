import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root', // Cela garantit que le service est fourni dans l'injecteur racine
})
export class TranslationService {
  getLanguageChanges() {
    throw new Error('Method not implemented.');
  }
  translate(arg0: string): string {
    throw new Error('Method not implemented.');
  }
  private currentLanguage = new BehaviorSubject<string>('en');

  constructor() {}

  setLanguage(language: string): void {
    this.currentLanguage.next(language);
  }

  getTranslation(key: string): string {
    const translations: { [key: string]: { [lang: string]: string } } = {
      title: { en: 'Admin Settings', fr: 'Paramètres Admin', es: 'Configuración Admin' },
      themeLabel: { en: 'Theme', fr: 'Thème', es: 'Tema' },
      notificationsLabel: { en: 'Enable Notifications', fr: 'Activer les notifications', es: 'Habilitar notificaciones' },
      languageLabel: { en: 'Language', fr: 'Langue', es: 'Idioma' },
      emailNotificationsLabel: { en: 'Email Notifications', fr: 'Notifications par e-mail', es: 'Notificaciones por correo' },
      saveButton: { en: 'Save Settings', fr: 'Enregistrer les paramètres', es: 'Guardar configuración' },
      activityLogTitle: { en: 'Activity Log', fr: 'Journal des activités', es: 'Registro de actividades' }
    };
    return translations[key]?.[this.currentLanguage.value] || key;
  }
}