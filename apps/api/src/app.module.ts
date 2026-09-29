import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { ChallansModule } from './modules/challans/challans.module';
import { ProductionModule } from './modules/production/production.module';
import { QualityModule } from './modules/quality/quality.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { AuditModule } from './modules/audit/audit.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';

import { MastersModule } from './modules/masters/masters.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { BundlesModule } from './modules/bundles/bundles.module';
import { DefectsModule } from './modules/defects/defects.module';
import { PackingModule } from './modules/packing/packing.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { FloorBoardModule } from './modules/floorboard/floorboard.module';

// Phase 3 Modules
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ControlTowerModule } from './modules/controltower/controltower.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SearchModule } from './modules/search/search.module';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { ReportsModule } from './modules/reports/reports.module';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 1000, // 1000 requests per minute
      },
    ]),
    PrismaModule,
    AuthModule,
    MastersModule,
    ProgramsModule,
    ChallansModule,
    ProductionModule,
    QualityModule,
    DepartmentsModule,
    AuditModule,
    DashboardModule,
    HealthModule,
    InventoryModule,
    BundlesModule,
    DefectsModule,
    PackingModule,
    DispatchModule,
    FloorBoardModule,
    AnalyticsModule,
    ControlTowerModule,
    NotificationsModule,
    SearchModule,
    DiagnosticsModule,
    ReportsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}
