import { Controller, Get, Patch, Post, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Query('isRead') isRead?: string) {
    const filter = isRead !== undefined ? isRead === 'true' : undefined;
    return this.notificationsService.getNotifications(filter);
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Post('read-all')
  async markAllRead() {
    return this.notificationsService.markAllAsRead();
  }

  @Post('scan')
  async triggerScan() {
    return this.notificationsService.scanAndGenerateAlerts();
  }
}
