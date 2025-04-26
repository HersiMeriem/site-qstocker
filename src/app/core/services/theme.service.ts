import { Injectable, Renderer2, RendererFactory2, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

export type Theme = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private renderer: Renderer2;
  private currentTheme = new BehaviorSubject<Theme>('light');
  public currentTheme$ = this.currentTheme.asObservable();

  constructor(
    rendererFactory: RendererFactory2,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.initializeTheme();
  }

  private initializeTheme(): void {
    const savedTheme = localStorage.getItem('theme') as Theme;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else if (systemDark) {
      this.setTheme('system');
    } else {
      this.setTheme('light');
    }
  }

  getCurrentTheme(): Theme {
    return this.currentTheme.value;
  }

  setTheme(theme: Theme): void {
    this.currentTheme.next(theme);
    localStorage.setItem('theme', theme);
    this.updateThemeClass(theme);
  }

  private updateThemeClass(theme: Theme): void {
    const body = this.document.body;
    const themeClasses = ['light-theme', 'dark-theme'];

    themeClasses.forEach(themeClass => 
      this.renderer.removeClass(body, themeClass)
    );

    const effectiveTheme = theme === 'system' 
      ? this.getSystemTheme() 
      : theme;

    this.renderer.addClass(body, `${effectiveTheme}-theme`);
  }

  private getSystemTheme(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? 'dark' 
      : 'light';
  }

  watchSystemThemeChanges(): void {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (this.currentTheme.value === 'system') {
        this.updateThemeClass('system');
      }
    });
  }
}