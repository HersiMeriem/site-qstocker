import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  constructor(
    private db: AngularFireDatabase,
    private afAuth: AngularFireAuth
  ) {}

  getTasks(userId: string) {
    return this.db.list(`users/${userId}/tasks`).valueChanges();
  }

  async addTask(userId: string, title: string) {
    const newTask = {
      id: Date.now().toString(),
      title,
      completed: false,
      createdAt: new Date().toISOString()
    };

    await this.db.list(`users/${userId}/tasks`).push(newTask);
  }

  async toggleTask(userId: string, taskId: string, completed: boolean) {
    await this.db.object(`users/${userId}/tasks/${taskId}`).update({
      completed: !completed
    });
  }

  async deleteTask(userId: string, taskId: string) {
    await this.db.object(`users/${userId}/tasks/${taskId}`).remove();
  }
}