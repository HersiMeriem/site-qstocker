import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PromptDialogComponent } from './prompt-dialog.component';

describe('PromptDialogComponent', () => {
  let component: PromptDialogComponent;
  let fixture: ComponentFixture<PromptDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PromptDialogComponent]
    });
    fixture = TestBed.createComponent(PromptDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
