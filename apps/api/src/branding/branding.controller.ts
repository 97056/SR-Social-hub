import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminService } from "../admin/admin.service";
import { CreateContactLeadDto } from "../admin/dto/admin.dto";

@ApiTags("branding")
@Controller()
export class BrandingController {
  constructor(private readonly admin: AdminService) {}

  @Get("branding")
  get() {
    return this.admin.getBranding();
  }

  @Get("faqs")
  faqs() {
    return this.admin.getFaqs(true);
  }

  @Post("contact")
  contact(@Body() dto: CreateContactLeadDto) {
    return this.admin.createContactLead(dto);
  }
}
