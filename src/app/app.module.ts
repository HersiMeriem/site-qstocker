import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { environment } from '../environments/environment';
import { FormsModule,ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';  // ✅ Ajout de RouterModule
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { AdminComponent } from './admin/admin.component';
import { ResponsableComponent } from './responsable/responsable.component';
import { AngularFireDatabaseModule } from '@angular/fire/compat/database'; // ✅ Ajout pour Firebase DB
import { HttpClient, HttpClientModule } from '@angular/common/http';
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
import { SearchPipe } from './search.pipe';
import { EditProductComponent } from './responsable/edit-product/edit-product.component';
import { ProductAddComponent } from './responsable/product-add/product-add.component';
import { ProductListComponent } from './responsable/product-list/product-list.component';
import { ResponsableDashboardComponent } from './responsable/responsable-dashboard/responsable-dashboard.component';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { NgChartsModule } from 'ng2-charts';
import { QRCodeModule } from 'angularx-qrcode';
import { LucideAngularModule, Package, QrCode, Scan, BarChart, Bell, FileText } from 'lucide-angular';
import { NavComponent } from './responsable/nav/nav.component';
import { ProfilComponent } from './responsable/profil/profil.component';
import { SettingComponent } from './responsable/setting/setting.component';
import { ProductService } from './services/product.service';
import { HistoriqueCommandesComponent } from './responsable/historique-commandes/historique-commandes.component';
import { SuppliersComponent } from './responsable/suppliers/suppliers.component';
import { ConfirmationDialogComponent } from './responsable/confirmation-dialog/confirmation-dialog.component';
import { SupplierDialogComponent } from './responsable/supplier-dialog/supplier-dialog.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatIconModule } from '@angular/material/icon';
import { StockComponent } from './responsable/stock/stock.component';
import { FilterPipe } from './filter.pipe';
import { ToastrModule } from 'ngx-toastr';
import { AngularFireMessagingModule } from '@angular/fire/compat/messaging';
import { FullCalendarModule } from '@fullcalendar/angular';
import { ArrayFromNumberPipe } from './array-from-number.pipe'; // Importation de FullCalendarModule
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { CommandeFournisseurComponent } from './responsable/commande-fournisseur/commande-fournisseur.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from './services/notification.service';
import { LangageService } from './services/langage.service';
import { UserFilterPipe } from './pipes/user-filter.pipe';
import { PromptDialogComponent } from './admin/prompt-dialog/prompt-dialog.component';
import { ConfirmationService } from './services/confirmation.service';
import { MatRadioModule } from '@angular/material/radio';
import { AngularFireStorageModule } from '@angular/fire/compat/storage';
import { StockManagerProfileService } from './services/stock-manager-profile.service';
import { StockManagerConfirmationService } from './services/stock-manager-confirmation.service';
import { MatCommonModule } from '@angular/material/core';
import { InitialsPipe } from './initials.pipe';
import { TruncatePipe } from './truncate.pipe';
import { ToggleSwitchComponent } from './responsable/toggle-switch/toggle-switch.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SettingsExportDialogComponent } from './settings-export-dialog/settings-export-dialog.component';
import { TranslatePipe } from './shared/pipes/translate.pipe';
import { MatListModule } from '@angular/material/list';
import { AiDashboardComponent } from './modules/settings/components/ai-dashboard/ai-dashboard.component';
import { ChatbotComponent } from './shared/components/chatbot/chatbot.component';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { SettingsService } from './core/services/settings.service';
import { BackupService } from './core/services/backup.service';
import { ThemeService } from './core/services/theme.service';
import { TranslationService } from './core/services/translation.service';
import { UserService } from './core/services/user.service';
import { EmailMessagingComponent } from './email-messaging/email-messaging.component';
import { EmailSimulatorComponent } from './email-simulator/email-simulator.component';
import { AbsolutePipe } from './pipes/absolute.pipe';
import { FilteePipe } from './pipes/filtee.pipe';
import { SafeUrlPipe } from './pipes/safe-url.pipe';
import { ConfirmDialogComponent } from './responsable/confirm-dialog/confirm-dialog.component';
import { ProductDetailsComponent } from './responsable/product-details/product-details.component';
import { SalesComponent } from './responsable/sales/sales.component';
import { SalesReportsComponent } from './responsable/sales-reports/sales-reports.component';
import { StatusLabelPipe } from './status-label.pipe';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { EmailService } from './services/email.service';
import { SupplierService } from './services/supplier.service';
import { StockService } from './services/stock.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';
import { VentesComponent } from './admin/ventes/ventes.component';
import { FinancialDashboardComponent } from './responsable/financial-dashboard/financial-dashboard.component';
import { ReportService } from 'src/app/services/report.service';
import { FacturationCommandesComponent } from './responsable/facturation-commandes/facturation-commandes.component';
import { SumPipe } from './pipes/sum.pipe';
import { DetailsProductsComponent } from './admin/details-products/details-products.component';
import { DashboardFinancierComponent } from './admin/dashboard-financier/dashboard-financier.component';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { PromotionDialogComponent } from './responsable/promotion-dialog/promotion-dialog.component';
import { NotificationsComponent } from './admin/notifications/notifications.component';
import { ProductDetailsDialogComponent } from './product-details-dialog/product-details-dialog.component';
import { LivraisonComponent } from './responsable/livraison/livraison.component';
import { LivraisonViewComponent } from './admin/livraison-view/livraison-view.component';
import { PredectionsComponent } from './responsable/predections/predections.component';
import { PredictionService } from './services/prediction.service';

const config: SocketIoConfig = { 
  url: 'http://localhost:3000', // Remplacez par votre URL de serveur
  options: {}
};

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}




@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    RegisterComponent,
    AdminComponent,
    ResponsableComponent,
    AdminDashboardComponent,
    UserManagementComponent,
    ProductManagementComponent,
    StockHistoryComponent,
    StatisticsComponent,
    SettingsComponent,
    AnalyticsReportManagementComponent,
    ForgotPasswordComponent,
    NavbarComponent,
    ProfileComponent,
    SearchPipe,
    EditProductComponent,
    ProductAddComponent,
    ProductListComponent,
    NavComponent,
    ProfilComponent,
    SettingComponent,
    HistoriqueCommandesComponent,
    SuppliersComponent,
    ConfirmationDialogComponent,
    SupplierDialogComponent,
    StockComponent,
    FilterPipe,
    ArrayFromNumberPipe,
    CommandeFournisseurComponent,
    UserFilterPipe,
    PromptDialogComponent,
    InitialsPipe,
    ConfirmationDialogComponent,
    TruncatePipe,
    FilterPipe,
    TruncatePipe,
    ConfirmDialogComponent,
    ProductDetailsComponent,
    StatusLabelPipe,
    SalesComponent,
    SalesReportsComponent,
    AbsolutePipe,
    ToggleSwitchComponent,
    SettingsExportDialogComponent,
    TranslatePipe,
    AiDashboardComponent,
    ChatbotComponent,
    EmailMessagingComponent,
    EmailSimulatorComponent,
    AbsolutePipe,
    FilteePipe,
    SafeUrlPipe,
    ConfirmDialogComponent,
    ProductDetailsComponent,
    SalesComponent,
    SalesReportsComponent,
    StatusLabelPipe,
    VentesComponent,
    FinancialDashboardComponent,
    FacturationCommandesComponent,
    SumPipe,
    DetailsProductsComponent,
    DashboardFinancierComponent,
    PromotionDialogComponent,
    NotificationsComponent,
    ProductDetailsDialogComponent,
    LivraisonComponent,
    LivraisonViewComponent,
    PredectionsComponent,
    
  
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    AngularFireModule.initializeApp(environment.firebaseConfig),
    AngularFireAuthModule,
    FormsModule,
    HttpClientModule,
    AngularFireDatabaseModule, 
    RouterModule,
    BrowserModule,
    AppRoutingModule,
    AngularFireModule.initializeApp(environment.firebaseConfig),
    AngularFireAuthModule,
    FormsModule,
    HttpClientModule,
    MatProgressBarModule,
    AngularFireDatabaseModule, 
    AngularFireAuthModule,
    ReactiveFormsModule,
    LucideAngularModule.pick({ Package, QrCode, Scan, BarChart, Bell, FileText }),
    QRCodeModule, 
    MatCardModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatButtonModule, 
    NgChartsModule,
    MatListModule,
    AngularFireStorageModule,
    RouterModule.forRoot([
      { path: 'product-add', component: ProductAddComponent },
    ]),
    MatSelectModule,
    MatFormFieldModule,
    BrowserAnimationsModule, 
    MatButtonToggleModule,
    MatIconModule,
    MatTableModule,
    MatDialogModule,
    MatSnackBarModule,
    MatInputModule,
    MatSlideToggleModule,
    MatDatepickerModule,
    MatNativeDateModule,
    CommonModule,
    MatSelectModule,
    MatFormFieldModule,
    BrowserAnimationsModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatInputModule,
    MatSlideToggleModule,
    MatDatepickerModule,
    MatNativeDateModule,
    CommonModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatSnackBarModule,
    NgSelectModule,
    MatMenuModule ,
    MatPaginatorModule ,
    MatListModule,
    ZXingScannerModule,
    MatSortModule,
    MatTabsModule ,
    MatDividerModule,
    MatGridListModule,
    MatTooltipModule,
    ToastrModule.forRoot(),
    AngularFireMessagingModule,
    FullCalendarModule, 
    MatRadioModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatCommonModule,
   
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient],
      },
    }) 

  ],
  providers: [ProductService,LangageService,NotificationService,ConfirmationService,StockManagerProfileService,StockManagerConfirmationService,SettingsService,BackupService,ThemeService,TranslationService,UserService,
    StockService,
   EmailService,
   SupplierService ,
   ReportService,
   PredictionService,

  ],
  
  bootstrap: [AppComponent]
})
export class AppModule { }
