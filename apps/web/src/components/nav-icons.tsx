import type { NavIcon } from "@/lib/nav";

export function NavGlyph({ name, className = "h-4 w-4" }: { name: NavIcon; className?: string }) {
  const props = {
    viewBox: "0 0 24 24",
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
        </svg>
      );
    case "command":
      return (
        <svg {...props}>
          <path d="M12 3l2.2 6.6L21 12l-6.8 2.4L12 21l-2.2-6.6L3 12l6.8-2.4L12 3z" />
        </svg>
      );
    case "clients":
    case "companies":
    case "team":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="3" />
          <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      );
    case "social":
    case "integrations":
      return (
        <svg {...props}>
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="18" cy="18" r="2.5" />
          <path d="M8.3 11l7.4-4M8.3 13l7.4 4" />
        </svg>
      );
    case "media":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="11" r="2" />
          <path d="M21 16l-5-4-4 3-3-2-4 3" />
        </svg>
      );
    case "create":
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
          <rect x="3" y="3" width="18" height="18" rx="4" />
        </svg>
      );
    case "posts":
      return (
        <svg {...props}>
          <path d="M4 6h16M4 12h10M4 18h14" />
        </svg>
      );
    case "approvals":
      return (
        <svg {...props}>
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "publishing":
      return (
        <svg {...props}>
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      );
    case "billing":
    case "plans":
      return (
        <svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h4" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...props}>
          <path d="M4 19V5M10 19V9M16 19v-6M22 19V7" />
        </svg>
      );
    case "notifications":
      return (
        <svg {...props}>
          <path d="M18 16v-5a6 6 0 10-12 0v5l-2 2h16l-2-2z" />
          <path d="M10 19a2 2 0 004 0" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
        </svg>
      );
    case "branding":
      return (
        <svg {...props}>
          <path d="M12 3l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6l2-6z" />
        </svg>
      );
    case "faqs":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.1 9a3 3 0 015.8 1c0 2-3 2.5-3 4.5" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "leads":
      return (
        <svg {...props}>
          <path d="M4 4h16v12H5.2L4 17.5V4z" />
          <path d="M8 8h8M8 12h5" />
        </svg>
      );
    case "mail":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 7 9-7" />
        </svg>
      );
    case "admin":
    default:
      return (
        <svg {...props}>
          <path d="M12 3l8 4v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7l8-4z" />
        </svg>
      );
  }
}
