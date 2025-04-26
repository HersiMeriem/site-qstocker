import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

@Component({
  selector: 'app-toggle-switch',
  template: `
    <div class="toggle-switch" [class.active]="value" (click)="toggle()">
      <div class="toggle-slider"></div>
      <span class="toggle-label">{{ value ? onLabel : offLabel }}</span>
    </div>
  `,
  styleUrls: ['./toggle-switch.component.css'],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => ToggleSwitchComponent),
    multi: true
  }]
})
export class ToggleSwitchComponent implements ControlValueAccessor {
  @Input() onLabel = 'On';
  @Input() offLabel = 'Off';
  @Output() change = new EventEmitter<boolean>();
  
  value = false;
  disabled = false;
  private onChange: (val: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  toggle(): void {
    if (!this.disabled) {
      this.value = !this.value;
      this.onChange(this.value);
      this.onTouched();
      this.change.emit(this.value);
    }
  }

  writeValue(value: boolean): void {
    this.value = value;
  }

  registerOnChange(fn: (val: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}