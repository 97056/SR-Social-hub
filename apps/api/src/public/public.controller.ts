import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("public")
@Controller("public")
export class PublicController {
  @Get("integration-urls")
  integrationUrls() {
    const web = process.env.WEB_URL ?? "https://srsocialhub.in";
    const api = process.env.API_URL ?? "https://api.srsocialhub.in";
    return {
      frontendWebsiteUrl: web,
      backendApiBaseUrl: `${api}/api/v1`,
      socialAccountConnectionPage: `${web}/app/{companyId}/social-accounts`,
      clientSocialAccountConnectionPage: `${web}/client/{clientId}/social-accounts`,
      facebookOauthStartUrl: `${web}/client/{clientId}/social-accounts?connect=FACEBOOK`,
      instagramOauthStartUrl: `${web}/client/{clientId}/social-accounts?connect=INSTAGRAM`,
      facebookOauthStartApi: `${api}/api/v1/companies/{companyId}/clients/{clientId}/social-accounts/FACEBOOK/connect`,
      instagramOauthStartApi: `${api}/api/v1/companies/{companyId}/clients/{clientId}/social-accounts/INSTAGRAM/connect`,
      oauthCallbackUrl: `${api}/api/v1/oauth/callback`,
      disconnectAccountUrl: `${api}/api/v1/social-accounts/{accountId}/disconnect`,
      privacyPolicyUrl: `${web}/privacy`,
      termsUrl: `${web}/terms`,
      deleteAccountUrl: `${web}/delete-account`,
    };
  }
}
