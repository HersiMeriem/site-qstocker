import { Injectable } from '@angular/core';
import * as QRCode from 'qrcode';

@Injectable({
  providedIn: 'root'
})
export class QrCodeService {
  async generateQRCodeImage(data: string): Promise<string> {
    try {
      const options: QRCode.QRCodeToDataURLOptions = {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 300,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      };
      return await QRCode.toDataURL(data, options);
    } catch (error) {
      console.error("Erreur génération QR Code:", error);
      throw error;
    }
  }

  // Ajoutez cette méthode pour la compatibilité
  async generateQRCode(data: string): Promise<string> {
    return this.generateQRCodeImage(data);
  }
}