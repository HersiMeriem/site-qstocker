import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { QrCodeService } from '../../services/qr-code.service';
import { Product } from '../../models/product';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { StockService } from '../../services/stock.service';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { map } from 'rxjs/operators';
import { DateAdapter } from '@angular/material/core';

@Component({
  selector: 'app-edit-product',
  templateUrl: './edit-product.component.html',
  styleUrls: ['./edit-product.component.css']
})
export class EditProductComponent implements OnInit {
    showCustomVolumeField = false;
  @ViewChild('promoDialog') promoDialog!: TemplateRef<any>;

  productForm: FormGroup;
  promoForm: FormGroup;
  productId: string = '';
  existingImage: string | undefined;
  existingQrCode: string | undefined;
  imageFile: File | null = null;
  imagePreview: string | null = null;
  qrCodeImage: string | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  showFileError = false;
  showSuccessMessage = false;
  successMessage = '';
  showSaveSuccess = false;
  saveMessage = 'Produit mis à jour avec succès !';
  showCustomOlfactiveFamilyField = false;
  showCustomCategoryField = false;
  currentStockQuantity = 0;
  private dialogRef!: MatDialogRef<any>;

  private readonly VOLUME_PATTERN = /^\d+ml$/i;
  private readonly NAME_MIN_LENGTH = 2;
  private readonly NAME_MAX_LENGTH = 50;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private stockService: StockService,
    private qrCodeService: QrCodeService,
    private dialog: MatDialog,
    private dateAdapter: DateAdapter<Date>
  ) {
    this.dateAdapter.setLocale('fr-FR');

    this.productForm = this.fb.group({
      id: [{ value: '', disabled: true }],
      name: ['', [
        Validators.required,
        Validators.minLength(this.NAME_MIN_LENGTH),
        Validators.maxLength(this.NAME_MAX_LENGTH)
      ]],
      isAuthentic: [true, Validators.required],
      brand: ['', Validators.required],
      perfumeType: ['', Validators.required],
      olfactiveFamily: ['', Validators.required],
      customOlfactiveFamily: [''],
      origin: ['', Validators.required],
      category: ['', Validators.required],
      customCategory: [''],
      info: ['', Validators.required],
      volume: ['50ml', Validators.required],
      customVolume: [''],
      stockQuantity: [0, [Validators.required, Validators.min(0)]],
      status: ['active' as const, Validators.required],
      discountPercentage: [null],
      promotionStart: [''],
      promotionEnd: [''],
      postPromoStatus: ['active']
    });

    this.promoForm = this.fb.group({
      discount: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
      startDate: [new Date(), Validators.required],
      endDate: [this.getDefaultEndDate(), Validators.required],
      postPromoStatus: ['active', Validators.required]
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.productId = id;
      this.loadProductData();
      this.setupStockSync();
      this.initializePromotionValidators();
    } else {
      this.errorMessage = 'ID produit non fourni';
    }
  }

  get todayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getDefaultEndDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  }

  private initializePromotionValidators(): void {
    this.productForm.get('status')?.valueChanges.subscribe(status => {
      const promotionControls = ['discountPercentage', 'promotionStart', 'promotionEnd'];

      if (status === 'promotion') {
        promotionControls.forEach(control => {
          this.productForm.get(control)?.setValidators(Validators.required);
        });
        this.productForm.get('discountPercentage')?.addValidators([
          Validators.min(1),
          Validators.max(100)
        ]);

        this.openPromoDialog();
      } else {
        promotionControls.forEach(control => {
          this.productForm.get(control)?.clearValidators();
        });
      }

      promotionControls.forEach(control => {
        this.productForm.get(control)?.updateValueAndValidity();
      });
    });
  }

  private setupStockSync(): void {
    this.productForm.get('id')?.valueChanges.subscribe(async (productId) => {
        if (productId && this.productForm.get('id')?.valid) {
            try {
                const stockItem = await firstValueFrom(
                    this.stockService.getProduct(productId).pipe(
                        catchError(() => of(null))
                    )
                );
                this.currentStockQuantity = (stockItem as any)?.quantite || 0;
                this.productForm.get('stockQuantity')?.setValue(this.currentStockQuantity);
            } catch (error) {
                console.error('Erreur lors de la récupération du stock:', error);
                this.currentStockQuantity = 0;
                this.productForm.get('stockQuantity')?.setValue(0);
            }
        }
    });
  }

  private loadProductData(): void {
    this.isLoading = true;
    this.productService.getProductById(this.productId).subscribe({
      next: (product) => {
        if (!product) {
          this.errorMessage = `Produit avec ID ${this.productId} non trouvé`;
          this.router.navigate(['/products']);
          return;
        }
        this.populateForm(product);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Détails de l\'erreur:', error);
        this.errorMessage = `Erreur lors du chargement du produit ${this.productId}`;
        this.isLoading = false;
        this.router.navigate(['/products']);
      }
    });
  }

  private populateForm(product: Product): void {
    const isCustomOlfactiveFamily = !['Boisé', 'Oriental', 'Floral', 'Fruité', 'Fougère'].includes(product.olfactiveFamily);
    const isCustomCategory = !['Homme', 'Femme', 'Unisexe', 'Enfant-Fille', 'Enfant-Garçon', 'Bébé'].includes(product.category);

    this.productForm.patchValue({
      id: product.id,
      name: product.name,
      isAuthentic: product.isAuthentic !== undefined ? product.isAuthentic : true,
      brand: product.brand,
      perfumeType: product.perfumeType,
      olfactiveFamily: isCustomOlfactiveFamily ? 'other' : product.olfactiveFamily,
      customOlfactiveFamily: isCustomOlfactiveFamily ? product.olfactiveFamily : '',
      origin: product.origin,
      category: isCustomCategory ? 'other' : product.category,
      customCategory: isCustomCategory ? product.category : '',
      info: product.description,
      volume: product.volume,
      stockQuantity: product.stockQuantity,
      status: product.status,
      postPromoStatus: product.postPromoStatus || 'active'
    });

    if (product.promotion) {
      this.productForm.patchValue({
        discountPercentage: product.promotion.discountPercentage,
        promotionStart: this.formatDateForInput(product.promotion.startDate),
        promotionEnd: this.formatDateForInput(product.promotion.endDate)
      });
    }

    this.showCustomOlfactiveFamilyField = isCustomOlfactiveFamily;
    this.showCustomCategoryField = isCustomCategory;
    this.existingImage = product.imageUrl;
    this.existingQrCode = product.qrCode;
  }

  private formatDateForInput(isoDate: string): string {
    return isoDate ? isoDate.split('T')[0] : '';
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

  onCategoryChange(): void {
    this.showCustomCategoryField = this.productForm.get('category')?.value === 'other';
    if (this.showCustomCategoryField) {
      this.productForm.get('customCategory')?.setValidators([Validators.required]);
    } else {
      this.productForm.get('customCategory')?.clearValidators();
    }
    this.productForm.get('customCategory')?.updateValueAndValidity();
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

  openPromoDialog(): void {
    this.dialogRef = this.dialog.open(this.promoDialog, {
      width: '500px'
    });

    if (this.productForm.get('status')?.value === 'promotion') {
      this.promoForm.patchValue({
        discount: this.productForm.get('discountPercentage')?.value,
        startDate: new Date(this.productForm.get('promotionStart')?.value),
        endDate: new Date(this.productForm.get('promotionEnd')?.value),
        postPromoStatus: this.productForm.get('postPromoStatus')?.value || 'active'
      });
    }
  }

  savePromotion(): void {
    if (this.promoForm.invalid) {
      this.promoForm.markAllAsTouched();
      return;
    }

    const promoData = this.promoForm.value;

    this.productForm.patchValue({
      status: 'promotion',
      discountPercentage: promoData.discount,
      promotionStart: promoData.startDate.toISOString().split('T')[0],
      promotionEnd: promoData.endDate.toISOString().split('T')[0],
      postPromoStatus: promoData.postPromoStatus
    });

    this.dialogRef.close();

    this.showSuccessMessage = true;
    this.successMessage = 'Promotion enregistrée avec succès !';
    setTimeout(() => this.showSuccessMessage = false, 3000);
  }

  async generateQRCode(productName: string): Promise<void> {
    if (!productName || !this.productForm.get('id')?.value) return;

    try {
      const qrData = JSON.stringify({
        productId: this.productForm.get('id')?.value,
        productName: productName,
        timestamp: new Date().toISOString()
      });
      this.qrCodeImage = await this.qrCodeService.generateQRCode(qrData);
    } catch (error) {
      console.error('Erreur génération QR Code:', error);
      this.errorMessage = "Échec de la génération du QR Code";
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      this.imageFile = file;
      this.showFileError = false;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      this.showFileError = true;
      this.imageFile = null;
      this.imagePreview = null;
    }
  }

  async updateProduct(): Promise<void> {
    this.errorMessage = null;
    this.showSaveSuccess = false;
    this.markFormAsTouched();

    if (this.productForm.invalid) {
      this.errorMessage = this.getFormErrors();
      return;
    }

    if (this.productForm.pristine) {
      this.errorMessage = 'Aucune modification détectée';
      return;
    }

    try {
      this.isLoading = true;
      const productData = this.prepareUpdateData();

      const productExists = await firstValueFrom(
        this.productService.getProductById(this.productId).pipe(
          map((p: Product | null) => !!p),
          catchError(() => of(false))
        )
      );

      if (!productExists) {
        throw new Error(`Le produit ${this.productId} n'existe pas`);
      }

      await this.productService.updateProduct(this.productId, productData);

      const stockData = {
        productId: this.productId,
        productName: productData.name || '',
        quantity: productData.stockQuantity || 0,
        unitPrice: this.calculateUnitPrice(productData),
        qrCode: productData.qrCode || null,
        imageUrl: productData.imageUrl || null,
        description: productData.description || null
      };

      const stockExists = await firstValueFrom(
        this.stockService.getProduct(this.productId).pipe(
          map((s: any) => !!s),
          catchError(() => of(false))
        )
      );

      if (stockExists) {
        await this.stockService.updateStock(this.productId, stockData);
      } else {
        await this.stockService.ajouterAuStock(stockData);
      }

      this.showSaveSuccess = true;
      this.saveMessage = 'Produit mis à jour avec succès !';
      this.productForm.markAsPristine();

      setTimeout(() => this.showSaveSuccess = false, 3000);

    } catch (error: unknown) {
      this.errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur:', error);
      await this.loadProductData();
    } finally {
      this.isLoading = false;
    }
  }

  private calculateUnitPrice(product: Partial<Product>): number {
    return product.volume?.includes('100ml') ? 50 : 30;
  }

  private prepareUpdateData(): Partial<Product> {
    const formData = this.productForm.getRawValue();

    const olfactiveFamily = formData.olfactiveFamily === 'other' ? formData.customOlfactiveFamily : formData.olfactiveFamily;
    const category = formData.category === 'other' ? formData.customCategory : formData.category;
    const volume = formData.volume === 'other' ? formData.customVolume : formData.volume;

    const updateData: Partial<Product> = {
      name: formData.name,
      isAuthentic: formData.isAuthentic,
      brand: formData.brand,
      perfumeType: formData.perfumeType,
      olfactiveFamily: olfactiveFamily,
      origin: formData.origin,
      category: category,
      description: formData.info,
      volume: volume,
      stockQuantity: Number(formData.stockQuantity),
      status: formData.status,
      updatedAt: new Date().toISOString(),
      postPromoStatus: formData.postPromoStatus
    };

    if (this.imageFile) {
      updateData.imageUrl = this.imagePreview || undefined;
    }

    if (this.qrCodeImage) {
      updateData.qrCode = this.qrCodeImage;
    }

    if (formData.status === 'promotion') {
      updateData.promotion = {
        discountPercentage: formData.discountPercentage,
        startDate: new Date(formData.promotionStart).toISOString(),
        endDate: new Date(formData.promotionEnd).toISOString()
      };
    } else {
      updateData.promotion = null;
    }

    return updateData;
  }

  async removePromotion(): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirmer la suppression',
        message: 'Voulez-vous vraiment supprimer la promotion de ce produit ?',
        cancelText: 'Annuler',
        confirmText: 'Supprimer'
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          this.isLoading = true;

          const updateData: Partial<Product> = {
            status: 'active',
            promotion: null,
            postPromoStatus: null,
            updatedAt: new Date().toISOString()
          };

          await this.productService.updateProduct(this.productId, updateData);

          this.productForm.patchValue({
            status: 'active',
            discountPercentage: null,
            promotionStart: null,
            promotionEnd: null,
            postPromoStatus: null
          }, { emitEvent: false });

          await this.loadProductData();

          this.showSuccessMessage = true;
          this.successMessage = 'Promotion supprimée avec succès !';
          setTimeout(() => this.showSuccessMessage = false, 3000);

        } catch (error) {
          this.errorMessage = 'Erreur lors de la suppression de la promotion';
          console.error(error);
        } finally {
          this.isLoading = false;
        }
      }
    });
  }

  private getFormErrors(): string {
    const errors: string[] = [];
    const controls = this.productForm.controls;

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

    if (controls['stockQuantity']?.errors) {
      errors.push('- Quantité en stock invalide');
    }

    if (this.productForm.get('status')?.value === 'promotion') {
      if (controls['discountPercentage']?.errors) {
        errors.push('- Pourcentage de réduction invalide (1-100%)');
      }
      if (controls['promotionStart']?.errors) {
        errors.push('- Date de début requise');
      }
      if (controls['promotionEnd']?.errors) {
        errors.push('- Date de fin requise');
      }
    }

    return 'Erreurs de validation :\n' + errors.join('\n');
  }

  private markFormAsTouched(): void {
    Object.values(this.productForm.controls).forEach(control => {
      if (control.enabled) control.markAsTouched();
    });
  }

  cancelEdit(): void {
    if (this.productForm.pristine) {
      this.router.navigate(['/responsable/product-list']);
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirmation',
        message: 'Voulez-vous vraiment annuler les modifications ?',
        cancelText: 'Non',
        confirmText: 'Oui'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.router.navigate(['/responsable/product-list']);
      }
    });
  }

  showValidation(controlName: string): boolean {
    const control = this.productForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  getValidationMessage(controlName: string): string {
    const control = this.productForm.get(controlName);
    if (!control?.errors) return '';

    if (control.errors['required']) return 'Champ obligatoire';
    if (control.errors['minlength']) return `Minimum ${control.errors['minlength'].requiredLength} caractères`;
    if (control.errors['maxlength']) return `Maximum ${control.errors['maxlength'].requiredLength} caractères`;
    if (control.errors['min']) return `Minimum ${control.errors['min'].min}`;
    if (control.errors['pattern']) return 'Format invalide';

    return 'Valeur invalide';
  }

  removeCurrentImage(): void {
    this.existingImage = undefined;
    this.imagePreview = null;
    this.imageFile = null;
    this.productForm.markAsDirty();
  }
}
