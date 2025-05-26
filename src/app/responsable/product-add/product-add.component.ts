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
  showCustomCategoryField = false;
  logoImagePreview: string | null = null;
  showLogoFileError = false;
  showCustomOlfactiveFamilyField = false;
  private readonly ID_PATTERN = /^PRD-\d{3,5}$/i;
  private readonly NAME_MIN_LENGTH = 2;
  private readonly NAME_MAX_LENGTH = 50;
  showCustomVolumeField = false;
  private readonly VOLUME_PATTERN = /^\d+ml$/i;
  packagingImagePreview: string | null = null;
  showPackagingFileError = false;

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
      brand: ['', Validators.required],
      perfumeType: ['', Validators.required],
      olfactiveFamily: ['', Validators.required],
      customOlfactiveFamily: [''],
      origin: ['', Validators.required],
      category: ['', Validators.required],
      customCategory: [''],
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
      info: ['', Validators.required],
      isAuthentic: [true, Validators.required],
      logoImageUrl: [''],
      packagingImageUrl: ['']
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

  onCategoryChange(): void {
    this.showCustomCategoryField = this.productForm.get('category')?.value === 'other';
    if (this.showCustomCategoryField) {
      this.productForm.get('customCategory')?.setValidators([Validators.required]);
    } else {
      this.productForm.get('customCategory')?.clearValidators();
    }
    this.productForm.get('customCategory')?.updateValueAndValidity();
  }

  onOlfactiveFamilyChange(): void {
    this.showCustomOlfactiveFamilyField = this.productForm.get('olfactiveFamily')?.value === 'other';
    if (this.showCustomOlfactiveFamilyField) {
      this.productForm.get('customOlfactiveFamily')?.setValidators([Validators.required]);
    } else {
      this.productForm.get('customOlfactiveFamily')?.clearValidators();
    }
    this.productForm.get('customOlfactiveFamily')?.updateValueAndValidity();
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

  onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.showLogoFileError = false;

    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        this.logoImagePreview = reader.result as string;
        this.productForm.patchValue({ logoImageUrl: this.logoImagePreview });
      };
      reader.readAsDataURL(file);
    } else {
      this.showLogoFileError = true;
      this.logoImagePreview = null;
    }
  }

  onPackagingFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.showPackagingFileError = false;

    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => this.packagingImagePreview = reader.result as string;
      reader.readAsDataURL(file);
    } else {
      this.showPackagingFileError = true;
      this.packagingImagePreview = null;
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

    // Validation des champs personnalisés
    if (this.productForm.value.category === 'other' && !this.productForm.value.customCategory) {
      this.errorMessage = 'Veuillez saisir le public cible manuellement';
      return;
    }

    if (this.productForm.value.olfactiveFamily === 'other' && !this.productForm.value.customOlfactiveFamily) {
      this.errorMessage = 'Veuillez saisir la famille olfactive manuellement';
      return;
    }

    if (this.productForm.value.volume === 'other' && !this.productForm.value.customVolume) {
      this.errorMessage = 'Veuillez saisir le volume manuellement';
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

      // Vérification si le produit existe déjà
      const existingProduct = await firstValueFrom(
        this.productService.getProductById(product.id).pipe(
          catchError(() => of(null))
        )
      );

      if (existingProduct) {
        this.errorMessage = 'Un produit avec cet ID existe déjà';
        return;
      }

      // Ajout au stock
      const stockData = {
        productId: product.id,
        productName: product.name,
        quantity: product.stockQuantity,
        unitPrice: this.calculateUnitPrice(product),
        qrCode: product.qrCode,
        imageUrl: product.imageUrl,
        description: product.description
      };

      await this.stockService.ajouterAuStock(stockData);

      // Ajout du produit
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
    // Implémentez votre logique de calcul de prix unitaire ici
    // Par exemple, vous pourriez avoir un prix de base ou le calculer à partir d'autres propriétés
    return 10; // Valeur par défaut temporaire
  }

private prepareProduct(): Product {
    const category = this.productForm.value.category === 'other'
      ? this.productForm.value.customCategory
      : this.productForm.value.category;

    const volume = this.productForm.value.volume === 'other'
      ? this.productForm.value.customVolume
      : this.productForm.value.volume;

    const olfactiveFamily = this.productForm.value.olfactiveFamily === 'other'
      ? this.productForm.value.customOlfactiveFamily
      : this.productForm.value.olfactiveFamily;

    const product: Product = {
      ...this.productForm.value,
      id: this.productForm.value.id.toUpperCase(),
      category: category,
      volume: volume,
      olfactiveFamily: olfactiveFamily,
      description: this.productForm.value.info,
      imageUrl: this.imagePreview!,
      qrCode: this.qrCodeImage!,
      stockQuantity: parseInt(this.productForm.value.stockQuantity, 10),
      createdAt: new Date().toISOString(),
      logoImageUrl: this.logoImagePreview || undefined,
      packagingImageUrl: this.packagingImagePreview || undefined,
      promotion: this.productForm.value.status === 'promotion' ? {
        startDate: this.productForm.value.promotionStart,
        endDate: this.productForm.value.promotionEnd,
        discountPercentage: this.productForm.value.discountPercentage
      } : undefined
    };

    // Assurez-vous que la propriété promotion est définie si le statut est promotion
    if (product.status === 'promotion' && !product.promotion) {
      throw new Error('Promotion details are required for promotion status');
    }

    return product;
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

    if (controls['brand']?.errors) {
      errors.push('- Marque requise');
    }

    if (controls['perfumeType']?.errors) {
      errors.push('- Type de parfum requis');
    }

    if (controls['olfactiveFamily']?.errors) {
      errors.push('- Famille olfactive requise');
    }

    if (controls['origin']?.errors) {
      errors.push('- Origine requise');
    }

    if (controls['category']?.errors) {
      errors.push('- Public cible requis');
    }

    if (controls['customCategory']?.errors) {
      errors.push('- Public cible personnalisé requis');
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
    this.showCustomVolumeField = false;
    this.showCustomCategoryField = false;
    this.showCustomOlfactiveFamilyField = false;
    this.logoImagePreview = null;
    this.showLogoFileError = false;
    this.packagingImagePreview = null;
    this.showPackagingFileError = false;
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

  private handleScannedData(scannedData: any): void {
    if (scannedData.id) {
      this.productForm.patchValue({
        id: scannedData.id
      });
    }

    if (scannedData.name) {
      this.productForm.patchValue({
        name: scannedData.name
      });
      this.generateQRCode(scannedData.name);
    }
  }
}
