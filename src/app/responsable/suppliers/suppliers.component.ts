import { Component, OnInit } from '@angular/core';
import { SupplierService } from '../../services/supplier.service';
import { MatDialog } from '@angular/material/dialog';
import { SupplierDialogComponent } from '../supplier-dialog/supplier-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Supplier } from 'src/app/models/supplier';
import { Router } from '@angular/router';

@Component({
  selector: 'app-suppliers',
  templateUrl: './suppliers.component.html',
  styleUrls: ['./suppliers.component.css']
})
export class SuppliersComponent implements OnInit {
  suppliers: Supplier[] = [];

  constructor(
    private supplierService: SupplierService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit() {
    this.fetchSuppliers();
  }


  fetchSuppliers() {
    this.supplierService.getAll().subscribe(data => {
      this.suppliers = data;
    });
  }

  retour() {
    this.router.navigate(['/responsable/commande-fournisseur']); 
  }
  openDialog(supplier?: Supplier) {
    const dialogRef = this.dialog.open(SupplierDialogComponent, {
      width: '400px',
      data: supplier ? { ...supplier } : null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        supplier ? this.updateSupplier(supplier.id!, result) : this.addSupplier(result);
      }
    });
  }
  
  addSupplier(supplier: Supplier) {
    this.supplierService.create(supplier).then(() => {
      this.snackBar.open('Fournisseur ajouté avec succès', 'OK', { duration: 3000 });
      this.fetchSuppliers(); // Met à jour la liste après l'ajout
    });
  }

  updateSupplier(id: string, supplier: Supplier) {
    this.supplierService.update(id, supplier).then(() => {
      this.snackBar.open('Fournisseur mis à jour', 'OK', { duration: 3000 });
      this.fetchSuppliers();
    });
  }

  deleteSupplier(id: string) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
      this.supplierService.delete(id).then(() => {
        this.snackBar.open('Fournisseur supprimé', 'OK', { duration: 3000 });
        this.fetchSuppliers(); 
      });
    }
  }
}