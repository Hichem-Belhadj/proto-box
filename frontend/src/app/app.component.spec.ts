import {AppComponent} from './app.component';
import {MockBuilder, MockRender} from "ng-mocks";
import {ZipService} from "./shared/services/zip.service";

describe('AppComponent', () => {

  beforeEach(() => MockBuilder(AppComponent)
      .mock(ZipService));

  it('should create the app', () => {
    const fixture = MockRender(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
