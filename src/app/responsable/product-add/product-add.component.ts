import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Product } from 'src/app/models/product';
import { ProductService } from 'src/app/services/product.service';
import { QrCodeService } from 'src/app/services/qr-code.service';
import { Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { StockService } from 'src/app/services/stock.service';

@Component({
  selector: 'app-product-add',
  templateUrl: './product-add.component.html',
  styleUrls: ['./product-add.component.css']
})
export class ProductAddComponent {
  productForm: FormGroup = this.fb.group({}); 
  errorMessage: string | null = null;
  isLoading = false;
  qrCodeImage: string | null = null;
  imagePreview: string | null = null;
  showFileError = false;
  currentStockQuantity: number = 0;
  showCustomTypeField = false;
  private readonly ID_PATTERN = /^PRD-\d{3,5}$/i;
  private readonly NAME_MIN_LENGTH = 2;
  private readonly NAME_MAX_LENGTH = 50;
  showCustomVolumeField = false;
  private readonly VOLUME_PATTERN = /^\d+ml$/i;

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private qrCodeService: QrCodeService,
    private stockService: StockService,
    private router: Router
  ) {
    this.initializeForm();
    this.setupQRAutoGeneration();
  }

  ngOnInit(): void {
    this.setupStockSync();
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as { isPromo?: boolean };
    
    if (state?.isPromo) {
      this.productForm.patchValue({
        status: 'promotion',
        promotion: {
          discountPercentage: 10,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      });
    }
  }

  private initializeForm(): void {
    this.productForm = this.fb.group({
      id: ['', [
        Validators.required,
        Validators.pattern(this.ID_PATTERN)
      ]],
      name: ['', [
        Validators.required,
        Validators.minLength(this.NAME_MIN_LENGTH),
        Validators.maxLength(this.NAME_MAX_LENGTH)
      ]],
      type: ['', Validators.required],
      customType: [''],
      category: ['', Validators.required],
      volume: ['50ml', Validators.required],
      customVolume: [''],
      stockQuantity: [0, [
        Validators.required,
        Validators.min(0)
      ]],
      status: ['active', Validators.required],
      discountPercentage: [null, [
        Validators.min(1),
        Validators.max(100)
      ]],
      promotionStart: [''],
      promotionEnd: [''],
      info: ['', Validators.required]
    });
  
    // Gestion dynamique des validations pour les promotions
    this.productForm.get('status')?.valueChanges.subscribe(status => {
      const discountControl = this.productForm.get('discountPercentage');
      const startControl = this.productForm.get('promotionStart');
      const endControl = this.productForm.get('promotionEnd');
  
      if (status === 'promotion') {
        discountControl?.setValidators([
          Validators.required,
          Validators.min(1),
          Validators.max(100)
        ]);
        startControl?.setValidators([Validators.required]);
        endControl?.setValidators([Validators.required]);
      } else {
        discountControl?.clearValidators();
        startControl?.clearValidators();
        endControl?.clearValidators();
      }
  
      discountControl?.updateValueAndValidity();
      startControl?.updateValueAndValidity();
      endControl?.updateValueAndValidity();
    });
  
    // Validation croisée des dates de promotion
    this.productForm.get('promotionStart')?.valueChanges.subscribe(() => {
      this.validatePromotionDates();
    });
  
    this.productForm.get('promotionEnd')?.valueChanges.subscribe(() => {
      this.validatePromotionDates();
    });
  }
  
  private validatePromotionDates(): void {
    const start = this.productForm.get('promotionStart')?.value;
    const end = this.productForm.get('promotionEnd')?.value;
  
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
  
      if (startDate >= endDate) {
        this.productForm.get('promotionEnd')?.setErrors({ dateRange: true });
      } else {
        this.productForm.get('promotionEnd')?.setErrors(null);
      }
    }
  }

  onVolumeChange(): void {
    this.showCustomVolumeField = this.productForm.get('volume')?.value === 'other';
    if (this.showCustomVolumeField) {
      this.productForm.get('customVolume')?.setValidators([
        Validators.required,
        Validators.pattern(this.VOLUME_PATTERN)
      ]);
    } else {
      this.productForm.get('customVolume')?.clearValidators();
    }
    this.productForm.get('customVolume')?.updateValueAndValidity();
  }
  
  formatCustomVolume(): void {
    const customVolumeControl = this.productForm.get('customVolume');
    if (customVolumeControl) {
      let value = customVolumeControl.value;
      const numbers = value.replace(/[^0-9]/g, '');
      if (numbers && !value.toLowerCase().endsWith('ml')) {
        customVolumeControl.setValue(numbers + 'ml');
      }
    }
  }

  onTypeChange(): void {
    this.showCustomTypeField = this.productForm.get('type')?.value === 'other';
    if (this.showCustomTypeField) {
      this.productForm.get('customType')?.setValidators([Validators.required]);
    } else {
      this.productForm.get('customType')?.clearValidators();
    }
    this.productForm.get('customType')?.updateValueAndValidity();
  }

  private setupQRAutoGeneration(): void {
    this.productForm.get('name')?.valueChanges.subscribe(value => {
      if (value?.length >= this.NAME_MIN_LENGTH && this.productForm.get('id')?.valid) {
        this.generateQRCode(value);
      }
    });
  }

  formatProductId(): void {
    const idControl = this.productForm.get('id');
    if (idControl) {
      let value = idControl.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      idControl.setValue(value, { emitEvent: false });
    }
  }

  async generateQRCode(productName: string): Promise<void> {
    try {
      const qrData = JSON.stringify({
        id: this.productForm.value.id,
        name: productName,
        timestamp: new Date().toISOString()
      });
      this.qrCodeImage = await this.qrCodeService.generateQRCode(qrData);
    } catch (error) {
      console.error('Erreur génération QR Code:', error);
      this.errorMessage = "Échec de la génération du QR Code";
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.showFileError = false;

    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => this.imagePreview = reader.result as string;
      reader.readAsDataURL(file);
    } else {
      this.showFileError = true;
      this.imagePreview = null;
    }
  }

  private setupStockSync(): void {
    this.productForm.get('id')?.valueChanges.subscribe(async (productId) => {
      if (productId && this.productForm.get('id')?.valid) {
        try {
          const stockItem = await firstValueFrom(this.stockService.getProduct(productId));
          this.currentStockQuantity = stockItem?.quantite || 0;
          this.productForm.get('stockQuantity')?.setValue(this.currentStockQuantity);
        } catch (error) {
          console.error('Erreur lors de la récupération du stock:', error);
          this.currentStockQuantity = 0;
          this.productForm.get('stockQuantity')?.setValue(0);
        }
      }
    });
  } 

  async addProduct(): Promise<void> {
    this.errorMessage = null;
    this.markFormAsTouched();
  
    if (this.productForm.value.type === 'other' && !this.productForm.value.customType) {
      this.errorMessage = 'Veuillez saisir le type de parfum manuellement';
      return;
    }
  
    if (this.productForm.invalid) {
      this.errorMessage = this.getFormErrors();
      return;
    }
  
    if (!this.imagePreview || !this.qrCodeImage) {
      this.errorMessage = 'Veuillez compléter tous les médias requis';
      return;
    }
  
    try {
      this.isLoading = true;
      const product = this.prepareProduct();
      
      const existingStock = await firstValueFrom(
        this.stockService.getProduct(product.id).pipe(
          catchError(() => of(null))
      ));
  
      if (existingStock) {
        const newQuantity = existingStock.quantite + product.stockQuantity;
        await this.stockService.updateStockQuantity(product.id, newQuantity);
      } else {
        await this.stockService.ajouterAuStock({
          productId: product.id,
          productName: product.name,
          quantity: product.stockQuantity,
          unitPrice: this.calculateUnitPrice(product),
          qrCode: product.qrCode || null,
          imageUrl: product.imageUrl || null,
          description: product.description || null
        });
      }
  
      await this.productService.addProduct(product);
      this.handleSuccess();
    } catch (error: any) {
      console.error('Erreur complète:', error);
      this.errorMessage = 'Une erreur est survenue lors de l\'ajout du produit';
      if (error.message) {
        this.errorMessage += `: ${error.message}`;
      }
    } finally {
      this.isLoading = false;
    }
  }
  
  private calculateUnitPrice(product: Product): number {
    return 0;
  }
  
  private prepareProduct(): Product {
    const type = this.productForm.value.type === 'other' 
      ? this.productForm.value.customType 
      : this.productForm.value.type;
  
    const volume = this.productForm.value.volume === 'other'
      ? this.productForm.value.customVolume
      : this.productForm.value.volume;
  
    return {
      ...this.productForm.value,
      id: this.productForm.value.id.toUpperCase(),
      type: type,
      volume: volume,
      description: this.productForm.value.info,
      imageUrl: this.imagePreview!,
      qrCode: this.qrCodeImage!,
      stockQuantity: parseInt(this.productForm.value.stockQuantity),
      createdAt: new Date().toISOString()
    };
  }

  private handleSuccess(): void {
    this.router.navigate(['/products'], {
      state: {
        success: true,
        message: 'Produit ajouté avec succès !'
      }
    });
    this.resetForm();
  }

  private markFormAsTouched(): void {
    Object.values(this.productForm.controls).forEach(control => control.markAsTouched());
  }

  private getFormErrors(): string {
    const errors: string[] = [];
    const controls = this.productForm.controls;
  
    if (controls['id']?.errors) {
      errors.push('- Format ID invalide (PRD-0000)');
    }
    
    if (controls['name']?.errors) {
      errors.push(`- Nom invalide (${this.NAME_MIN_LENGTH}-${this.NAME_MAX_LENGTH} caractères)`);
    }
    
    if (controls['type']?.errors) {
      errors.push('- Type de parfum requis');
    }
    
    if (controls['customType']?.errors) {
      errors.push('- Type personnalisé requis');
    }
    
    if (controls['category']?.errors) {
      errors.push('- Public cible requis');
    }
    
    if (controls['stockQuantity']?.errors) {
      errors.push('- Quantité en stock invalide');
    }
    
    if (controls['info']?.errors) {
      errors.push('- Description requise');
    }
    
    if (controls['volume']?.errors) {
      errors.push('- Volume requis');
    }
    
    if (controls['customVolume']?.errors) {
      if (controls['customVolume']?.errors?.['required']) {
        errors.push('- Volume personnalisé requis');
      }
      if (controls['customVolume']?.errors?.['pattern']) {
        errors.push('- Format de volume invalide (doit être comme 75ml)');
      }
    }
  
    return 'Erreurs de validation :\n' + errors.join('\n');
  }

  resetForm(): void {
    this.productForm.reset({
      volume: '50ml',
      status: 'active',
      stockQuantity: 0
    });
    this.imagePreview = null;
    this.qrCodeImage = null;
    this.showFileError = false;
    this.showCustomTypeField = false;
    this.showCustomVolumeField = false;
    this.markFormAsTouched();
  }

  showValidation(controlName: string): boolean {
    const control = this.productForm.get(controlName);
    return !!control?.invalid && (control?.dirty || control?.touched);
  }

  getValidationMessage(controlName: string): string {
    const control = this.productForm.get(controlName);
    
    if (control?.hasError('required')) return 'Ce champ est obligatoire';
    if (control?.hasError('pattern')) return 'Format ID invalide';
    if (control?.hasError('minlength')) return `Minimum ${control.errors?.['minlength'].requiredLength} caractères`;
    if (control?.hasError('maxlength')) return `Maximum ${control.errors?.['maxlength'].requiredLength} caractères`;
    if (control?.hasError('min')) return 'La valeur doit être positive';

    return 'Valeur invalide';
  }
}