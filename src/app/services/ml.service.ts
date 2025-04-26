import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class MlService {
  private apiUrl = 'https://your-ml-api.com/predict';

  constructor(private http: HttpClient) {}

  getPredictions() {
    return this.http.get(this.apiUrl);
  }
}