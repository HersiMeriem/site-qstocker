import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { AdminComponent } from './admin/admin.component';
import { ResponsableComponent } from './responsable/responsable.component';
import { AdminDashboardComponent } from './admin/admin-dashboard/admin-dashboard.component';
import { UserManagementComponent } from './admin/user-management/user-management.component';
import { ProductManagementComponent } from './admin/product-management/product-management.component';
import { StockHistoryComponent } from './admin/stock-history/stock-history.component';
import { StatisticsComponent } from './admin/statistics/statistics.component';
import { SettingsComponent } from './admin/settings/settings.component';
import { AnalyticsReportManagementComponent } from './admin/analytics-report-management/analytics-report-management.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { NavbarComponent } from './admin/navbar/navbar.component';
import { ProfileComponent } from './admin/profile/profile.component';
import { AuthGuard } from './guards/auth.guard';
import { EditProductComponent } from './responsable/edit-product/edit-product.component';
import { ProductAddComponent } from './responsable/product-add/product-add.component';
import { ProductListComponent } from './responsable/product-list/product-list.component';
import { ResponsableDashboardComponent } from './responsable/responsable-dashboard/responsable-dashboard.component';
import { NavComponent } from './responsable/nav/nav.component';
import { ProfilComponent } from './responsable/profil/profil.component';
import { SettingComponent } from './responsable/setting/setting.component';
import { SupplierDialogComponent } from './responsable/supplier-dialog/supplier-dialog.component';
import { HistoriqueCommandesComponent } from './responsable/historique-commandes/historique-commandes.component';
import { SuppliersComponent } from './responsable/suppliers/suppliers.component';
import { StockComponent } from './responsable/stock/stock.component';
import { CommandeFournisseurComponent } from './responsable/commande-fournisseur/commande-fournisseur.component';
import { SalesComponent } from './responsable/sales/sales.component';
import { ProductDetailsComponent } from './responsable/product-details/product-details.component';
import { VentesComponent } from './admin/ventes/ventes.component';
import { FinancialDashboardComponent } from './responsable/financial-dashboard/financial-dashboard.component';
import { FacturationCommandesComponent } from './responsable/facturation-commandes/facturation-commandes.component';
import { DetailsProductsComponent } from './admin/details-products/details-products.component';
import { DashboardFinancierComponent } from './admin/dashboard-financier/dashboard-financier.component';

const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'admin', component: AdminDashboardComponent, children: [
    { path: 'statistics', component: StatisticsComponent },
    { path: 'users', component: UserManagementComponent },
    { path: 'products', component: ProductManagementComponent },
    { path: 'stock-history', component: StockHistoryComponent },
    { path: 'settings', component: SettingsComponent },
    { path: 'report', component: AnalyticsReportManagementComponent},
    { path: 'details-products/:id', component: DetailsProductsComponent },
    { path: 'analyse-financier', component: DashboardFinancierComponent },
    { path: 'navbar', component: NavbarComponent },
    { path: 'ventes', component: VentesComponent },
    { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] }, // Nouvelle route
    { path: '', redirectTo: 'statistics', pathMatch: 'full' }
  ]},
  { path: 'responsable', component: ResponsableComponent, children :[
    { path: 'dashboard', component: ResponsableDashboardComponent }, 
    { path: 'edit-product/:id', component: EditProductComponent },
    { path: 'nav', component: NavComponent },
    { path: 'product-list', component:ProductListComponent },
    { path: 'product-add', component:ProductAddComponent},
    { path: 'profil', component: ProfilComponent, canActivate: [AuthGuard] },
    { path: 'commande-fournisseur', component: CommandeFournisseurComponent },
    { path: 'historique-commandes', component: HistoriqueCommandesComponent },
    { path: 'suppliers', component: SuppliersComponent },
    { path: 'supplier-dialog', component: SupplierDialogComponent },
    { path: 'stock', component: StockComponent },
    { path: 'setting', component: SettingComponent},
    { path: 'sales', component: SalesComponent },
    { path: 'financial-dashboard', component: FinancialDashboardComponent},
    { path: 'facturation-commande', component: FacturationCommandesComponent},
    { path: 'product-details/:id', component: ProductDetailsComponent },
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
  ]},
  { path: 'forgot-password', component: ForgotPasswordComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
