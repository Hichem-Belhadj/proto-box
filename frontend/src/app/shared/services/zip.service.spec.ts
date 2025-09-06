import {MockBuilder, ngMocks} from 'ng-mocks';

import {ZipService} from './zip.service';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {environment} from '../../../environments/environment';
import {provideHttpClient} from '@angular/common/http';

describe('ZipService', () => {
  let service: ZipService;
  let httpMock: HttpTestingController;

  beforeEach(() => MockBuilder(ZipService)
    .provide(provideHttpClient())
    .provide(provideHttpClientTesting()) );

  beforeEach(() => {
    service = ngMocks.findInstance(ZipService);
    httpMock = ngMocks.findInstance(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should POST FormData and return ArrayBuffer', () => {
    // GIVEN
    const file = new File(['dummy'], 'test.zip', { type: 'application/zip' });
    const expected = new ArrayBuffer(4);

    let result: ArrayBuffer | undefined;

    // WHEN
    service.upload(file).subscribe(res => (result = res));

    // THEN
    const req = httpMock.expectOne(environment.apiUrl + '/parse');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);

    req.flush(expected);

    expect(result).toBe(expected);
  });
});
