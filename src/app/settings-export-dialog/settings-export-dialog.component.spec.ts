import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsExportDialogComponent } from './settings-export-dialog.component';

describe('SettingsExportDialogComponent', () => {
  let component: SettingsExportDialogComponent;
  let fixture: ComponentFixture<SettingsExportDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SettingsExportDialogComponent]
    });
    fixture = TestBed.createComponent(SettingsExportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
