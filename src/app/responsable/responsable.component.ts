import { Component, OnInit } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { SnapshotAction } from '@angular/fire/compat/database';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-responsable',
  templateUrl: './responsable.component.html',
  styleUrls: ['./responsable.component.css']
})
export class ResponsableComponent implements OnInit {
  constructor(private db: AngularFireDatabase, private authService: AuthService, private router: Router) {}
  
  ngOnInit(): void {
    throw new Error('Method not implemented.');
  }

}