/** Official-style brand glyphs for social platforms (inline SVG). */
export function SocialPlatformIcon({
  code,
  className = "h-6 w-6",
}: {
  code: string;
  className?: string;
}) {
  const c = code.toUpperCase();
  const common = className;
  switch (c) {
    case "FACEBOOK":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="#1877F2" aria-hidden>
          <path d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H7v4h2v7h4v-7h3l1-4h-4V9c0-.6.4-1 1-1z" />
        </svg>
      );
    case "INSTAGRAM":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="#E1306C" aria-hidden>
          <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 4.5A4.5 4.5 0 1 0 16.5 12 4.5 4.5 0 0 0 12 7.5zm6.2-.9a1.1 1.1 0 1 0 1.1 1.1 1.1 1.1 0 0 0-1.1-1.1zM12 9.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5z" />
        </svg>
      );
    case "LINKEDIN":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="#0A66C2" aria-hidden>
          <path d="M6.5 9.5H3.7V20h2.8zm.2-3.2a1.7 1.7 0 1 1-1.7-1.7 1.7 1.7 0 0 1 1.7 1.7zM20.3 13.2c0-2.7-1.4-4-3.4-4a3.1 3.1 0 0 0-2.8 1.5V9.5h-2.8c0 .8 0 10.5 0 10.5h2.8v-5.9c0-.3 0-.7.1-1 .3-.7.9-1.5 2-1.5 1.4 0 2 1.1 2 2.7V20h2.8z" />
        </svg>
      );
    case "X":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M17.6 3H20l-6.2 7.1L21 21h-5.5l-4.3-5.6L6 21H3.6l6.6-7.6L3 3h5.6l3.9 5.2L17.6 3zm-1.9 16.2h1.5L8.4 4.7H6.8l8.9 14.5z" />
        </svg>
      );
    case "YOUTUBE":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="#FF0033" aria-hidden>
          <path d="M23 12.2s0-3.2-.4-4.7a3 3 0 0 0-2.1-2.1C18.9 5 12 5 12 5s-6.9 0-8.5.4a3 3 0 0 0-2.1 2.1C1 9 1 12.2 1 12.2s0 3.2.4 4.7a3 3 0 0 0 2.1 2.1c1.6.4 8.5.4 8.5.4s6.9 0 8.5-.4a3 3 0 0 0 2.1-2.1c.4-1.5.4-4.7.4-4.7zM9.8 15.5v-6.6l6.2 3.3-6.2 3.3z" />
        </svg>
      );
    case "PINTEREST":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="#E60023" aria-hidden>
          <path d="M12 2C6.5 2 2 6.3 2 11.6c0 4 2.5 7.4 6.1 8.7-.1-.7-.2-1.9 0-2.7.2-.7 1.3-5.4 1.3-5.4s-.3-.7-.3-1.7c0-1.6.9-2.8 2.1-2.8 1 0 1.5.7 1.5 1.6 0 1-.6 2.4-.9 3.8-.3 1.1.5 2 1.6 2 2 0 3.3-2.5 3.3-5.5 0-2.3-1.5-4-4.3-4-3.1 0-5.1 2.3-5.1 4.9 0 .9.3 1.5.7 2 .2.1.2.2.1.5l-.3 1c-.1.3-.2.3-.5.2-1.7-.7-2.5-2.6-2.5-4.7 0-3.5 3-7.2 8.3-7.2 4.4 0 7.3 3.2 7.3 6.6 0 4.5-2.5 7.8-6.2 7.8-1.2 0-2.4-.7-2.8-1.4l-.8 2.9c-.3 1-1 2.1-1.5 2.8 1.3.4 2.6.6 4 .6 5.5 0 10-4.3 10-9.6C22 6.3 17.5 2 12 2z" />
        </svg>
      );
    case "THREADS":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <path d="M16.2 9.2c-.1-2.2-1.4-3.7-3.9-3.8-1.7 0-3.1.7-3.7 1.9l1.5.9c.4-.8 1.2-1.2 2.2-1.2 1.4 0 2.2.8 2.3 2.2v.2c-1.1-.1-2.3 0-3.5.3-2 .5-3.3 1.8-3.2 3.8.1 1.9 1.6 3.1 3.6 3.1 1.3 0 2.4-.5 3.1-1.5.4.8 1 1.3 1.8 1.6l.8-1.4c-.7-.2-1.2-.7-1.4-1.5.8-.9 1.2-2.1 1.2-3.5v-.1h-.1zm-3.3 5.1c-1.1 0-1.9-.6-1.9-1.5 0-1.2.9-1.9 2.8-2.1.6-.1 1.2-.1 1.8 0-.1 2.1-1.1 3.6-2.7 3.6z" />
          <path
            fillRule="evenodd"
            d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12S6.2 22.5 12 22.5 22.5 17.8 22.5 12 17.8 1.5 12 1.5zM3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    default:
      return (
        <span
          className={`inline-grid place-items-center rounded-lg bg-white/10 text-[10px] font-bold ${common}`}
        >
          {c.slice(0, 2)}
        </span>
      );
  }
}

export const PLATFORM_BRAND_COLOR: Record<string, string> = {
  FACEBOOK: "#1877F2",
  INSTAGRAM: "#E1306C",
  LINKEDIN: "#0A66C2",
  X: "#E7E9EA",
  YOUTUBE: "#FF0033",
  PINTEREST: "#E60023",
  THREADS: "#A8A8A8",
};
