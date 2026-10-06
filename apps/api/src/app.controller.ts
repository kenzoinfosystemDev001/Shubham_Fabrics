import { Controller, Get, Head, HttpCode, HttpStatus } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  @HttpCode(HttpStatus.OK)
  getRoot() {
    return {
      status: 'ok',
      service: 'Subham Fabrics MES API Gateway',
      timestamp: new Date().toISOString(),
    };
  }

  @Head()
  @HttpCode(HttpStatus.OK)
  headRoot() {
    return;
  }
}
