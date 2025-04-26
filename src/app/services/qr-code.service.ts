// services/qr-code.service.ts
import { Injectable } from '@angular/core';
import * as QRCode from 'qrcode';

@Injectable({
  providedIn: 'root'
})
export class QrCodeService {
  async generateQRCode(data: string): Promise<string> {
    try {
      return await QRCode.toDataURL(data); // Retourne une image en base64
    } catch (error) {
      console.error("Erreur QR Code:", error);
      throw error;
    }
  }
}