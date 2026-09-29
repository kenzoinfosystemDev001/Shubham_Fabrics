import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('MES-Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Security & Cross-Origin
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Unified Error Envelope
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('Subham Fabrics Manufacturing Execution System (MES) API')
    .setDescription('Production-grade Garment & Textile Shop-Floor Execution, Traceability, and Challan Gateway')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`=======================================================`);
  logger.log(`🚀 Subham Fabrics MES Backend running on: http://localhost:${port}/api`);
  logger.log(`📖 Interactive Swagger Documentation: http://localhost:${port}/api/docs`);
  logger.log(`=======================================================`);
}

bootstrap();
