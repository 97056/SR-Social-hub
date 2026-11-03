import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminService } from "../admin/admin.service";

@ApiTags("branding")
@Controller("branding")
export class BrandingController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  get() {
    return this.admin.getBranding();
  }
}
