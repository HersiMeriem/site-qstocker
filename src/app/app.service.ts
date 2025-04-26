import { AngularFireDatabase } from "@angular/fire/compat/database";
import { DataIntegrityService } from "./services/data-integrity.service";
import { Injectable } from "@angular/core";
import { take } from "rxjs";

@Injectable({ providedIn: 'root' })
export class AppService {
  constructor(
    private db: AngularFireDatabase,
    private dataIntegrityService: DataIntegrityService
  ) {}

  initializeScheduledChecks() {
    this.db.object('config/dataCheckSchedule/nextRun')
      .valueChanges()
      .pipe(take(1))
      .subscribe((nextRun: any) => { // Utilisez any ou créez une interface
        if (nextRun && new Date(nextRun) <= new Date()) {
          this.dataIntegrityService.runAllChecks();
          this.updateNextRun();
        }
      });
  }

  private async updateNextRun() {
    const snapshot = await this.db.object('config/dataCheckSchedule')
      .query.once('value');
    const config = snapshot.val();
    
    if (config?.frequency) {
      await this.dataIntegrityService.setSchedule(config.frequency);
    }
  }
}