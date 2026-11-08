import { Injectable } from "@nestjs/common";
import { AdminService } from "../admin/admin.service";
import type { CreateContactLeadDto } from "../admin/dto/admin.dto";

type ChatReply = {
  reply: string;
  suggestContact: boolean;
  matchedFaqId?: string | null;
  supportEmail: string;
  quickReplies: string[];
};

const PRODUCT_KB: Array<{ id: string; keys: string[]; answer: string }> = [
  {
    id: "clients",
    keys: ["client", "clients", "add client", "roster", "workspace client"],
    answer:
      "Go to Clients in the sidebar to add or manage client profiles (name, website, brand, approval workflow). Each client can have its own social accounts, media, and approval portal.",
  },
  {
    id: "social",
    keys: ["social", "connect", "facebook", "instagram", "linkedin", "youtube", "pinterest", "threads", "oauth", "account"],
    answer:
      "Open Social Accounts, pick a client, then Connect on a network. Finish the provider login — quotas come from your plan/trial. If connect fails, check Admin → Integrations and Live OAuth callbacks.",
  },
  {
    id: "create-post",
    keys: ["create post", "compose", "draft", "caption", "media post", "content studio"],
    answer:
      "Use Create Post to write a draft, attach media from the Media Library, choose networks, then submit for approval or publish depending on the client workflow.",
  },
  {
    id: "approvals",
    keys: ["approval", "approve", "inbox", "client review", "feedback"],
    answer:
      "Drafts go to Approval Inbox. Clients review in their portal, leave feedback, and approve. Approved posts move into the Publishing Queue automatically when the workflow is Client then Publish.",
  },
  {
    id: "publishing",
    keys: ["publish", "queue", "schedule", "failed publish", "posting"],
    answer:
      "Publishing Queue shows scheduled and live jobs. Failures usually mean missing media URLs, revoked tokens, or plan limits — reconnect the social account and retry the job.",
  },
  {
    id: "media",
    keys: ["media", "upload", "image", "video", "library", "asset"],
    answer:
      "Media Library stores images/videos for the selected client. Upload there first, then attach assets while composing posts so every network gets a public media URL.",
  },
  {
    id: "billing",
    keys: ["billing", "plan", "trial", "payment", "razorpay", "upgrade", "quota", "subscription"],
    answer:
      "Open Billing to see your plan, trial countdown, and upgrade options. Quotas for clients and socials are enforced from the assigned plan. Payments appear under Admin Contact/Billing after Razorpay succeeds.",
  },
  {
    id: "team",
    keys: ["team", "invite", "member", "password", "colleague"],
    answer:
      "Company Team lets you invite coworkers by name and email. They receive login credentials by email and can work inside the same agency workspace (based on role).",
  },
  {
    id: "seo",
    keys: ["seo", "sitemap", "robots", "website analysis", "seo workspace"],
    answer:
      "SEO Workspace lists clients that already have a website URL. Run Deep analysis, Generate sitemap (imports existing sitemap + crawl), or Generate robots.txt, then download the files for the client site.",
  },
  {
    id: "growth",
    keys: ["growth", "ai growth", "marketing expert", "business consultant", "growth partner"],
    answer:
      "AI Growth Center (when enabled by Super Admin) helps with business/marketing analysis, opportunities, plans, tasks, and reports per client. Fill the Growth profile with a correct website URL for better results.",
  },
  {
    id: "command",
    keys: ["command center", "dashboard", "overview", "today"],
    answer:
      "Dashboard and Command Center summarize clients, connected socials, approvals waiting, and published posts so your team can operate day-to-day from one screen.",
  },
  {
    id: "login",
    keys: ["login", "password", "forgot", "reset", "access", "sign in"],
    answer:
      "Use Forgot password on the login page to reset. Client portal users sign in with the invite email/password. Company owners use the agency login after activation.",
  },
];

const CONTACT_KEYS = [
  "contact",
  "support",
  "help me",
  "talk to",
  "call me",
  "email you",
  "human",
  "agent",
  "speak",
  "reach out",
  "message you",
  "get in touch",
];

@Injectable()
export class SupportChatService {
  constructor(private readonly admin: AdminService) {}

  async ask(message: string, context?: { fullName?: string; email?: string }): Promise<ChatReply> {
    const branding = await this.admin.getBranding();
    const supportEmail = branding.supportEmail || "support@srsocialhub.in";
    const text = (message || "").trim();
    const lower = text.toLowerCase();

    const quickReplies = [
      "How do I connect Instagram?",
      "How do client approvals work?",
      "Where is billing?",
      "I want to contact support",
    ];

    if (!text) {
      return {
        reply: `Hi${context?.fullName ? ` ${context.fullName.split(" ")[0]}` : ""}! I'm the SR Social Hub helper. Ask about clients, social connects, posts, approvals, publishing, billing, SEO Workspace, or Growth Center — or say “contact support” to leave a message.`,
        suggestContact: false,
        supportEmail,
        quickReplies,
      };
    }

    const wantsContact = CONTACT_KEYS.some((k) => lower.includes(k));
    if (wantsContact) {
      return {
        reply: `Sure — you can email us at ${supportEmail}, or fill the short form below. Your note goes straight into Admin → Contact Leads so the team can reply.`,
        suggestContact: true,
        supportEmail,
        quickReplies: ["How do I create a post?", "SEO Workspace help"],
      };
    }

    const faqs = await this.admin.getFaqs(true);
    const faqHit = this.bestMatch(
      lower,
      faqs.map((f) => ({
        id: f.id,
        haystack: `${f.question} ${f.answer}`.toLowerCase(),
        answer: f.answer,
        question: f.question,
      })),
    );
    if (faqHit && faqHit.score >= 2) {
      return {
        reply: `${faqHit.question}\n\n${faqHit.answer}\n\nNeed a human? Say “contact support” or email ${supportEmail}.`,
        suggestContact: false,
        matchedFaqId: faqHit.id,
        supportEmail,
        quickReplies,
      };
    }

    const kbHit = this.bestKb(lower);
    if (kbHit) {
      return {
        reply: `${kbHit.answer}\n\nStill stuck? Say “contact support” and I’ll open a form for Admin Contact Leads.`,
        suggestContact: false,
        matchedFaqId: kbHit.id,
        supportEmail,
        quickReplies,
      };
    }

    return {
      reply: `I can help with SR Social Hub features (clients, social accounts, create/approve/publish, billing, SEO Workspace, Growth Center). Try a more specific question — or say “contact support” to email ${supportEmail} / submit a lead.`,
      suggestContact: true,
      supportEmail,
      quickReplies,
    };
  }

  async submitLead(dto: CreateContactLeadDto) {
    return this.admin.createContactLead(dto);
  }

  private bestKb(lower: string) {
    let best: { id: string; answer: string; score: number } | null = null;
    for (const row of PRODUCT_KB) {
      let score = 0;
      for (const key of row.keys) {
        if (lower.includes(key)) score += key.split(" ").length > 1 ? 3 : 2;
      }
      if (!best || score > best.score) best = { id: row.id, answer: row.answer, score };
    }
    return best && best.score >= 2 ? best : null;
  }

  private bestMatch(
    lower: string,
    rows: Array<{ id: string; haystack: string; answer: string; question: string }>,
  ) {
    const tokens = lower
      .split(/[^a-z0-9]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length > 2);
    let best: { id: string; answer: string; question: string; score: number } | null = null;
    for (const row of rows) {
      let score = 0;
      for (const t of tokens) {
        if (row.haystack.includes(t)) score += 1;
      }
      if (row.haystack.includes(lower.slice(0, 40))) score += 2;
      if (!best || score > best.score) best = { ...row, score };
    }
    return best;
  }
}
