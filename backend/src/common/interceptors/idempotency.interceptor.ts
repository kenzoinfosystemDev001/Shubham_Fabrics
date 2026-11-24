import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Idempotency applies to state-mutating requests (POST, PUT, PATCH, DELETE)
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const idempotencyKey =
      request.headers['x-idempotency-key'] ||
      request.headers['idempotency-key'] ||
      (request.body && request.body.idempotencyKey);

    if (!idempotencyKey) {
      return next.handle();
    }

    const keyStr = String(idempotencyKey).trim();
    if (keyStr.length < 8) {
      throw new BadRequestException('Idempotency key must be at least 8 characters long');
    }

    // Check if key already exists
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { key: keyStr },
    });

    if (existing) {
      const response = context.switchToHttp().getResponse();
      response.status(existing.statusCode);
      response.setHeader('X-Cache-Lookup', 'HIT-IDEMPOTENT');
      try {
        const parsed = JSON.parse(existing.responseBody);
        return of(parsed);
      } catch {
        return of(existing.responseBody);
      }
    }

    // Otherwise proceed and cache the response
    return next.handle().pipe(
      tap(async (data) => {
        try {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode || 200;
          await this.prisma.idempotencyRecord.create({
            data: {
              key: keyStr,
              endpoint: request.originalUrl || request.url,
              method,
              statusCode,
              responseBody: JSON.stringify(data || {}),
            },
          });
        } catch (err) {
          // In case another concurrent thread inserted it first
          console.warn(`[IdempotencyInterceptor] Note on key ${keyStr}:`, (err as any).message);
        }
      }),
    );
  }
}
