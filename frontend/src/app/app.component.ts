import {Component, inject} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {ZipService} from './shared/services/zip.service';
import {tap} from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly zipService = inject(ZipService);
  protected descriptor!: ArrayBuffer;

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.zipService.upload(file).pipe(
        tap((res: ArrayBuffer) => this.descriptor = res)
    ).subscribe();
  }
}
