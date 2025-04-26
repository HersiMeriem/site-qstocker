import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface Backup {
  id: string;
  timestamp: number;
  size: number;
  status: 'pending' | 'success' | 'error' | 'restoring' | 'restored';
  createdBy: string;
  type: 'manual' | 'auto';
}

@Injectable({
  providedIn: 'root'
})
export class BackupService {
  constructor(private db: AngularFireDatabase) {}

  getBackups(type: string): Observable<Backup[]> {
    return this.db.list<Backup>(`backups/${type}`, ref => 
      ref.orderByChild('timestamp')
    ).snapshotChanges().pipe(
      map(actions => actions.map(a => ({ 
        id: a.key || '', // Fournir une valeur par défaut
        timestamp: a.payload.val()?.timestamp || 0,
        size: a.payload.val()?.size || 0,
        status: a.payload.val()?.status || 'pending',
        createdBy: a.payload.val()?.createdBy || '',
        type: a.payload.val()?.type || 'manual'
      } as Backup)))
    );
  }

  async createBackup(type: string, backupType: 'manual' | 'auto'): Promise<Backup> {
    const newBackup: Backup = {
      id: this.db.createPushId(),
      timestamp: Date.now(),
      size: Math.round(Math.random() * 1000) / 100, // Random size 0.00-10.00 MB
      status: 'success',
      createdBy: 'current-user',
      type: backupType
    };

    await this.db.object(`backups/${type}/${newBackup.id}`).set(newBackup);
    return newBackup;
  }

  async restoreBackup(type: string, backupId: string): Promise<void> {
    await this.db.object(`backups/${type}/${backupId}/status`).set('restored');
  }

  async deleteBackup(type: string, backupId: string): Promise<void> {
    await this.db.object(`backups/${type}/${backupId}`).remove();
  }
}