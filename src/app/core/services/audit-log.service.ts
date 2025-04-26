import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface AuditLog {
  id: string;
  action: string;
  message: string;
  user: string;
  timestamp: number;
  context?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  constructor(private db: AngularFireDatabase) {}

  log(action: string, message: string, context: string = 'system'): Promise<void> {
    const logEntry: AuditLog = {
      action,
      message,
      user: 'current-user', // Vous devriez utiliser le vrai utilisateur ici
      timestamp: Date.now(),
      context,
      id: ''
    };
    return this.db.list('auditLogs').push(logEntry).then(() => undefined);
  }

  getLogs(context?: string): Observable<AuditLog[]> {
    return this.db.list<AuditLog>('auditLogs', ref => 
      context 
        ? ref.orderByChild('context').equalTo(context).limitToLast(20)
        : ref.orderByChild('timestamp').limitToLast(20)
    ).snapshotChanges().pipe(
      map(actions => actions.map(a => ({ 
        id: a.key || '',
        action: a.payload.val()?.action || '',
        message: a.payload.val()?.message || '',
        user: a.payload.val()?.user || '',
        timestamp: a.payload.val()?.timestamp || 0,
        context: a.payload.val()?.context
      } as AuditLog)))
    );
  }
}