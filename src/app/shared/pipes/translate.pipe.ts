import { Pipe, PipeTransform, OnDestroy } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';
import { Subscription } from 'rxjs';

@Pipe({
  name: 'translate',
  pure: false
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private lastValue: string = '';
  private langSubscription: Subscription;
  lastKey!: string;

  constructor(private translationService: TranslationService) {
    this.langSubscription = this.translationService.getLanguageChanges().subscribe(() => {
      this.lastValue = '';
      this.lastKey = '';
    });
  }

  transform(key: string): string {
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.lastValue = this.translationService.translate(key);
    }
    return this.lastValue;
  }

  ngOnDestroy(): void {
    this.langSubscription.unsubscribe();
  }
}