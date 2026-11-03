import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("unreadOnly") unreadOnly?: string) {
    return this.notifications.listForUser(user, {
      unreadOnly: unreadOnly === "true" || unreadOnly === "1",
    });
  }

  @Get("unread-count")
  async unread(@CurrentUser() user: AuthUser) {
    return { count: await this.notifications.unreadCount(user) };
  }

  @Post(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.notifications.markRead(id, user);
  }

  @Post("read-all")
  markAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }
}
