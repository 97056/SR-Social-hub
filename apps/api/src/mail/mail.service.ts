import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { PrismaService } from "../prisma/prisma.service";

export type MailSettings = {
  provider: "smtp" | "sendgrid" | "none";
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  sendgridApiKey: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
};

const DEFAULT_MAIL: MailSettings = {
  provider: "smtp",
  smtpHost: "smtp.gmail.com",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  smtpPass: "",
  fromEmail: "support@srsocialhub.in",
  fromName: "SR Social Hub",
  sendgridApiKey: "",
  twilioAccountSid: "",
  twilioAuthToken: "",
  twilioFromNumber: "",
};

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getSettings(): Promise<MailSettings> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: "mail" } });
    const stored = (row?.value as Partial<MailSettings> | null) ?? {};
    const fromEnv: MailSettings = {
      ...DEFAULT_MAIL,
      smtpHost: this.config.get<string>("SMTP_HOST") || DEFAULT_MAIL.smtpHost,
      smtpPort: Number(this.config.get<string>("SMTP_PORT") || DEFAULT_MAIL.smtpPort),
      smtpSecure: String(this.config.get<string>("SMTP_SECURE") || "false") === "true",
      smtpUser: this.config.get<string>("SMTP_USER") || "",
      smtpPass: this.config.get<string>("SMTP_PASS") || "",
      fromEmail:
        this.config.get<string>("SMTP_FROM_EMAIL") ||
        this.config.get<string>("SMTP_USER") ||
        DEFAULT_MAIL.fromEmail,
      fromName: this.config.get<string>("SMTP_FROM_NAME") || DEFAULT_MAIL.fromName,
    };
    const merged: MailSettings = { ...fromEnv, ...stored };
    // Empty admin secrets should not wipe .env credentials
    if (!merged.smtpUser) merged.smtpUser = fromEnv.smtpUser;
    if (!merged.smtpPass) merged.smtpPass = fromEnv.smtpPass;
    if (!merged.fromEmail) merged.fromEmail = fromEnv.fromEmail;
    if (!merged.sendgridApiKey) merged.sendgridApiKey = fromEnv.sendgridApiKey;
    if (!merged.twilioAuthToken) merged.twilioAuthToken = fromEnv.twilioAuthToken;
    merged.provider = (stored.provider as MailSettings["provider"]) || fromEnv.provider || "smtp";
    return merged;
  }

  async updateSettings(value: Partial<MailSettings>) {
    const current = await this.getSettings();
    const next = { ...current, ...value };
    await this.prisma.systemSetting.upsert({
      where: { key: "mail" },
      create: { key: "mail", value: next },
      update: { value: next },
    });
    return this.publicSettings(next);
  }

  publicSettings(settings?: MailSettings) {
    const s = settings;
    const source = s ?? DEFAULT_MAIL;
    return {
      ...source,
      smtpPass: source.smtpPass ? "••••••••" : "",
      sendgridApiKey: source.sendgridApiKey ? "••••••••" : "",
      twilioAuthToken: source.twilioAuthToken ? "••••••••" : "",
    };
  }

  async sendMail(input: { to: string; subject: string; html: string; text?: string }) {
    const settings = await this.getSettings();
    if (settings.provider === "none") {
      this.log.warn(`Mail skipped (provider=none): ${input.subject} -> ${input.to}`);
      return { skipped: true };
    }
    if (settings.provider === "sendgrid") {
      this.log.warn("SendGrid provider selected but not configured yet; falling back to SMTP if available.");
    }
    if (!settings.smtpUser || !settings.smtpPass) {
      this.log.error("SMTP credentials missing; cannot send mail");
      throw new Error("SMTP is not configured. Set mail settings in Admin.");
    }

    const transport = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: { user: settings.smtpUser, pass: settings.smtpPass },
    } as SMTPTransport.Options);

    await transport.sendMail({
      from: `"${settings.fromName}" <${settings.fromEmail || settings.smtpUser}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { ok: true };
  }

  shellHtml(opts: {
    title: string;
    preheader: string;
    bodyHtml: string;
    ctaLabel?: string;
    ctaUrl?: string;
    accent?: "activate" | "reset" | "default";
  }) {
    const accent = opts.accent ?? "default";
    const isReset = accent === "reset";
    const isActivate = accent === "activate";
    const eyebrow = isActivate ? "Account activation" : isReset ? "Password recovery" : "SR Social Hub";
    const eyebrowColor = isReset ? "#FFB020" : "#00d2ff";
    const outerBg = isReset ? "#120e14" : "#070b16";
    const cardBg = isActivate
      ? "linear-gradient(165deg,#0a1a2e 0%,#0c1428 42%,#15102a 100%)"
      : isReset
        ? "linear-gradient(165deg,#1a120c 0%,#140f18 50%,#1a0e14 100%)"
        : "linear-gradient(165deg,#10182a 0%,#0c1224 100%)";
    const topBar = isReset
      ? "linear-gradient(90deg,#FFB020,#FF6B6B,#FFB020)"
      : "linear-gradient(90deg,#00d2ff,#7b5cff,#c026ff,#00d2ff)";
    const ctaBg = isReset
      ? "linear-gradient(105deg,#FFB020,#FF6B6B)"
      : "linear-gradient(105deg,#00d2ff,#7b5cff)";
    const ctaColor = isReset ? "#1a0f05" : "#050814";
    const badgeBg = isReset ? "rgba(255,176,32,.14)" : "rgba(0,210,255,.12)";
    const badgeBorder = isReset ? "rgba(255,176,32,.35)" : "rgba(0,210,255,.3)";
    const cta =
      opts.ctaLabel && opts.ctaUrl
        ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 10px"><tr><td style="border-radius:14px;background:${ctaBg}">
             <a href="${opts.ctaUrl}" style="display:inline-block;padding:15px 26px;border-radius:14px;color:${ctaColor};font-weight:800;font-size:14px;letter-spacing:.02em;text-decoration:none">${opts.ctaLabel}</a>
           </td></tr></table>
           <p style="margin:0;font-size:11px;line-height:1.6;color:#6b7388;word-break:break-all">Secure link:<br/><a href="${opts.ctaUrl}" style="color:${eyebrowColor};text-decoration:none">${opts.ctaUrl}</a></p>`
        : "";
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark"/><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${outerBg};color:#f5f7ff;font-family:Georgia,'Times New Roman',serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${outerBg};padding:40px 14px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px">
        <tr><td style="padding:0 0 18px;text-align:center">
          <span style="display:inline-block;width:42px;height:42px;line-height:42px;border-radius:50%;background:linear-gradient(135deg,#00d2ff,#7b5cff);color:#050814;font-family:'Segoe UI',Arial,sans-serif;font-weight:800;font-size:14px">SR</span>
          <p style="margin:10px 0 0;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;letter-spacing:.32em;text-transform:uppercase;color:#6b7388">Social Hub</p>
        </td></tr>
        <tr><td style="border-radius:22px;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:${cardBg};box-shadow:0 24px 60px rgba(0,0,0,.45)">
          <div style="height:4px;background:${topBar}"></div>
          <div style="padding:30px 28px 28px">
            <span style="display:inline-block;padding:6px 12px;border-radius:999px;border:1px solid ${badgeBorder};background:${badgeBg};font-family:'Segoe UI',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${eyebrowColor}">${eyebrow}</span>
            <h1 style="margin:18px 0 14px;font-size:30px;line-height:1.15;font-weight:700;color:#fff">${escapeHtml(opts.title)}</h1>
            <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.7;color:#9aa3b8">${opts.bodyHtml}</div>
            ${cta}
          </div>
          <div style="padding:16px 28px 22px;border-top:1px solid rgba(255,255,255,.07);background:rgba(0,0,0,.22)">
            <p style="margin:0;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;letter-spacing:.08em;color:#6b7388">SPARK · APPROVE · BROADCAST</p>
          </div>
        </td></tr>
        <tr><td style="padding:18px 8px 0;text-align:center;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#4b5568">© SR Social Hub · Confidential account mail</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  /** Unique “access pass” design for client portal credentials. */
  clientAccessHtml(opts: {
    contactName: string;
    organizationName: string;
    agencyName: string;
    email: string;
    password: string;
    mobile: string;
    loginUrl: string;
  }) {
    const preheader = `Your ${opts.organizationName} client pass — sign in anytime on SR Social Hub`;
    const year = new Date().getFullYear();
    return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark light"/>
<title>Client access — ${escapeHtml(opts.organizationName)}</title>
</head>
<body style="margin:0;padding:0;background:#061018;color:#e8f4f8;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#061018;background-image:radial-gradient(ellipse at 20% 0%,rgba(0,210,255,.18),transparent 42%),radial-gradient(ellipse at 90% 10%,rgba(240,193,74,.12),transparent 40%);padding:36px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px">

        <!-- Brand strip -->
        <tr><td style="padding:0 6px 20px">
          <table role="presentation" width="100%"><tr>
            <td style="vertical-align:middle">
              <span style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;border-radius:12px;background:#00d2ff;color:#041018;font-weight:800;font-size:13px;letter-spacing:.04em">SR</span>
              <span style="display:inline-block;margin-left:10px;vertical-align:middle">
                <span style="display:block;font-size:14px;font-weight:700;color:#f3fbff;letter-spacing:.02em">SR Social Hub</span>
                <span style="display:block;font-size:11px;color:#6d8a96;letter-spacing:.18em;text-transform:uppercase">Client access pass</span>
              </span>
            </td>
            <td align="right" style="vertical-align:middle">
              <span style="display:inline-block;padding:7px 11px;border-radius:8px;border:1px dashed rgba(240,193,74,.55);color:#F0C14A;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase">Live login</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Ticket / pass card -->
        <tr><td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:20px;overflow:hidden;border:1px solid rgba(0,210,255,.28);background:#0a1820;box-shadow:0 28px 70px rgba(0,0,0,.55)">
            <tr><td style="background:linear-gradient(115deg,#0d3a48 0%,#0a1820 48%,#1a1408 100%);padding:26px 24px 18px">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#7ad9ef;font-weight:700">Issued by</p>
              <p style="margin:0 0 4px;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff">${escapeHtml(opts.agencyName)}</p>
              <p style="margin:0;font-size:13px;color:#9bb8c2">Workspace invite for <strong style="color:#F0C14A">${escapeHtml(opts.organizationName)}</strong></p>
            </td></tr>

            <!-- Perforation row -->
            <tr><td style="padding:0;background:#0a1820">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="14" style="font-size:0;line-height:0;background:#061018;border-radius:0 14px 14px 0">&nbsp;</td>
                  <td style="border-top:2px dashed rgba(122,217,239,.28);height:1px;font-size:0;line-height:0">&nbsp;</td>
                  <td width="14" style="font-size:0;line-height:0;background:#061018;border-radius:14px 0 0 14px">&nbsp;</td>
                </tr>
              </table>
            </td></tr>

            <tr><td style="padding:8px 24px 22px;background:#0a1820">
              <p style="margin:12px 0 4px;font-size:12px;color:#7ad9ef;letter-spacing:.14em;text-transform:uppercase;font-weight:700">Hello</p>
              <p style="margin:0 0 14px;font-size:20px;font-weight:700;color:#fff">${escapeHtml(opts.contactName)}</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#9bb8c2">
                Your client portal is ready. Use the credentials below to review posts, approvals, and publishing from anywhere — desktop or mobile.
              </p>

              <!-- Credential vault -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:16px;overflow:hidden;border:1px solid rgba(240,193,74,.35);background:linear-gradient(180deg,#14100a,#0e160f)">
                <tr><td style="padding:8px 16px;background:rgba(240,193,74,.1);border-bottom:1px solid rgba(240,193,74,.22)">
                  <p style="margin:0;font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:#F0C14A;font-weight:800">Private key card</p>
                </td></tr>
                <tr><td style="padding:16px 18px">
                  <p style="margin:0 0 4px;font-size:11px;color:#8a9a7a;letter-spacing:.12em;text-transform:uppercase">Email</p>
                  <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#f5f7ff;word-break:break-all">${escapeHtml(opts.email)}</p>
                  <p style="margin:0 0 4px;font-size:11px;color:#8a9a7a;letter-spacing:.12em;text-transform:uppercase">Password</p>
                  <p style="margin:0;padding:12px 14px;border-radius:10px;background:#050a08;border:1px solid rgba(240,193,74,.4);font-family:Consolas,'Courier New',monospace;font-size:18px;letter-spacing:.12em;font-weight:700;color:#F0C14A;word-break:break-all">${escapeHtml(opts.password)}</p>
                  <p style="margin:12px 0 0;font-size:11px;line-height:1.5;color:#7d8f78">Starts with <strong style="color:#F0C14A">SR</strong> · keep offline · change via Forgot password after first login</p>
                </td></tr>
              </table>

              <!-- Meta chips -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px">
                <tr>
                  <td width="50%" style="padding-right:6px;vertical-align:top">
                    <div style="padding:12px 14px;border-radius:12px;background:rgba(0,210,255,.08);border:1px solid rgba(0,210,255,.2)">
                      <p style="margin:0 0 4px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#7ad9ef">Organization</p>
                      <p style="margin:0;font-size:13px;font-weight:700;color:#fff">${escapeHtml(opts.organizationName)}</p>
                    </div>
                  </td>
                  <td width="50%" style="padding-left:6px;vertical-align:top">
                    <div style="padding:12px 14px;border-radius:12px;background:rgba(0,210,255,.08);border:1px solid rgba(0,210,255,.2)">
                      <p style="margin:0 0 4px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#7ad9ef">Mobile on file</p>
                      <p style="margin:0;font-size:13px;font-weight:700;color:#fff">${escapeHtml(opts.mobile)}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px"><tr>
                <td style="border-radius:14px;background:linear-gradient(105deg,#00d2ff 0%,#3DDC97 100%)">
                  <a href="${escapeAttr(opts.loginUrl)}" style="display:inline-block;padding:15px 28px;border-radius:14px;color:#041018;font-size:14px;font-weight:800;text-decoration:none;letter-spacing:.03em">Open client login →</a>
                </td>
              </tr></table>
              <p style="margin:0;font-size:11px;line-height:1.55;color:#5f7882;word-break:break-all">
                Bookmark: <a href="${escapeAttr(opts.loginUrl)}" style="color:#7ad9ef;text-decoration:none">${escapeHtml(opts.loginUrl)}</a>
              </p>
            </td></tr>

            <tr><td style="padding:14px 24px 18px;background:#07141a;border-top:1px solid rgba(0,210,255,.12)">
              <p style="margin:0;font-size:11px;line-height:1.6;color:#5f7882">
                Sign in from any device. This pass was generated for you alone — never forward the password. Need help? Reply to this email or contact ${escapeHtml(opts.agencyName)}.
              </p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:22px 8px 0;text-align:center">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:#3d5560">Spark · Approve · Broadcast</p>
          <p style="margin:0;font-size:11px;color:#3d5560">© ${year} SR Social Hub · Client portal credentials</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
