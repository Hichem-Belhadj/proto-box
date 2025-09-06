import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../../environments/environment';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ZipService {
  private readonly API_URL = environment.apiUrl;
  private readonly http = inject(HttpClient);

  upload(file: File): Observable<ArrayBuffer> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(this.API_URL + '/parse', formData, {
      responseType: 'arraybuffer'
    });
  }
}
