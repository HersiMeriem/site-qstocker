import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { QrCodeService } from '../../services/qr-code.service';
import { Product } from '../../models/product';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { StockService } from '../../services/stock.service';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { map } from 'rxjs/operators';


@Component({
  selector: 'app-edit-product',
  templateUrl: './edit-product.component.html',
  styleUrls: ['./edit-product.component.css']
})
export class EditProductComponent implements OnInit {
  productForm: FormGroup;
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
  saveMessage = '';
  showCustomTypeField = false;
  showCustomVolumeField = false;
  currentStockQuantity = 0;
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
    private dialog: MatDialog
  ) {
    this.productForm = this.fb.group({
      id: [{ value: '', disabled: true }],
      name: ['', [
        Validators.required, 
        Validators.minLength(this.NAME_MIN_LENGTH),
        Validators.maxLength(this.NAME_MAX_LENGTH)
      ]],
      type: ['', Validators.required],
      customType: [''],
      category: ['', Validators.required],
      info: ['', Validators.required],
      volume: ['50ml', Validators.required],
      customVolume: [''],
      stockQuantity: [0, [Validators.required, Validators.min(0)]],
      status: ['active', Validators.required]
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.productId = id;
      this.loadProductData();
      this.setupStockSync();
    } else {
      this.errorMessage = 'ID produit non fourni';
    }
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

  private loadProductData(): void {
    this.isLoading = true;
    this.productService.getProductById(this.productId).subscribe({
      next: (product) => {
        if (!product) {
          this.errorMessage = `Produit avec ID ${this.productId} non trouvé`;
          this.router.navigate(['/products']); // Redirection si produit non trouvé
          return;
        }
        this.populateForm(product);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Détails de l\'erreur:', error);
        this.errorMessage = `Erreur lors du chargement du produit ${this.productId}`;
        this.isLoading = false;
        this.router.navigate(['/products']); // Redirection en cas d'erreur
      }
    });
  }

  private populateForm(product: Product): void {
    const isCustomType = !['Floral', 'Sucré', 'Boisé', 'Oriental'].includes(product.type);
    const isCustomVolume = !['15ml', '30ml', '50ml', '100ml'].includes(product.volume);

    this.productForm.patchValue({
      id: product.id,
      name: product.name,
      type: isCustomType ? 'other' : product.type,
      customType: isCustomType ? product.type : '',
      category: product.category,
      info: product.description,
      volume: isCustomVolume ? 'other' : product.volume,
      customVolume: isCustomVolume ? product.volume : '',
      stockQuantity: product.stockQuantity,
      status: product.status
    });

    this.showCustomTypeField = isCustomType;
    this.showCustomVolumeField = isCustomVolume;
    this.existingImage = product.imageUrl;
    this.existingQrCode = product.qrCode;
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
  
      // Vérification de l'existence avec gestion de type explicite
      const productExists = await firstValueFrom(
        this.productService.getProductById(this.productId).pipe(
          map((p: Product | null) => !!p),
          catchError(() => of(false))
        )
      );
  
      if (!productExists) {
        throw new Error(`Le produit ${this.productId} n'existe pas`);
      }
  
      // Mise à jour du produit
      await this.productService.updateProduct(this.productId, productData);
  
      // Préparation des données pour le stock
      const stockData = {
        productId: this.productId,
        productName: productData.name || '', // Conversion nomProduit -> productName
        quantity: productData.stockQuantity || 0, // Conversion quantite -> quantity
        unitPrice: this.calculateUnitPrice(productData), // Conversion prixUnitaireHT -> unitPrice
        qrCode: productData.qrCode || null,
        imageUrl: productData.imageUrl || null,
        description: productData.description || null
      };
  
      // Vérification du stock avec gestion de type
      const stockExists = await firstValueFrom(
        this.stockService.getProduct(this.productId).pipe(
          map((s: any) => !!s), // Utilisez une interface spécifique si disponible
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
      await this.loadProductData(); // Tentative de récupération
    } finally {
      this.isLoading = false;
    }
  }
  
  private calculateUnitPrice(product: Partial<Product>): number {
    // Implémentez votre logique de calcul ici
    // Exemple basique :
    return product.volume?.includes('100ml') ? 50 : 30;
  }
  
  private calculateSalePrice(product: Partial<Product>): number {
    // Prix de vente = prix unitaire * marge (ex: 20%)
    return this.calculateUnitPrice(product) * 1.2;
  }
  private prepareUpdateData(): Partial<Product> {
    const formData = this.productForm.getRawValue();
    
    const type = formData.type === 'other' ? formData.customType : formData.type;
    const volume = formData.volume === 'other' ? formData.customVolume : formData.volume;

    const updateData: Partial<Product> = {
      name: formData.name,
      type: type,
      category: formData.category,
      description: formData.info,
      volume: volume,
      stockQuantity: Number(formData.stockQuantity),
      status: formData.status,
      updatedAt: new Date().toISOString()
    };

    if (this.imageFile) {
      updateData.imageUrl = this.imagePreview || undefined;
    }
    
    if (this.qrCodeImage) {
      updateData.qrCode = this.qrCodeImage;
    }

    return updateData;
  }

  private getFormErrors(): string {
    const errors: string[] = [];
    const controls = this.productForm.controls;

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


private initializeForm(): void {
  this.productForm = this.fb.group({
    // ... autres contrôles
    status: ['active', Validators.required],
    discountPercentage: [null, [Validators.min(1), Validators.max(100)]],
    promotionStart: [''],
    promotionEnd: ['']
  });

  this.productForm.get('status')?.valueChanges.subscribe(status => {
    if (status === 'promotion') {
      this.productForm.get('discountPercentage')?.setValidators([Validators.required]);
      this.productForm.get('promotionStart')?.setValidators([Validators.required]);
      this.productForm.get('promotionEnd')?.setValidators([Validators.required]);
    } else {
      this.productForm.get('discountPercentage')?.clearValidators();
      this.productForm.get('promotionStart')?.clearValidators();
      this.productForm.get('promotionEnd')?.clearValidators();
    }
    this.productForm.get('discountPercentage')?.updateValueAndValidity();
    this.productForm.get('promotionStart')?.updateValueAndValidity();
    this.productForm.get('promotionEnd')?.updateValueAndValidity();
  });
}
}