import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProgramsModule,
    ChallansModule,
    ProductionModule,
    QualityModule,
    DepartmentsModule,
    AuditModule,
    DashboardModule,
    HealthModule,
  ],
})
export class AppModule {}
