import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconSearch = (p: IconProps) => <Base {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Base>;
export const IconMenu = (p: IconProps) => <Base {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Base>;
export const IconClose = (p: IconProps) => <Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>;
export const IconCart = (p: IconProps) => <Base {...p}><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2" /><circle cx="9" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></Base>;
export const IconHome = (p: IconProps) => <Base {...p}><path d="M3 11 12 4l9 7" /><path d="M5 10v10h5v-6h4v6h5V10" /></Base>;
export const IconGrid = (p: IconProps) => <Base {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></Base>;
export const IconTag = (p: IconProps) => <Base {...p}><path d="M3 12V4h8l9 9-8 8-9-9z" /><circle cx="7.5" cy="7.5" r="1.3" /></Base>;
export const IconTools = (p: IconProps) => <Base {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></Base>;
export const IconHeadset = (p: IconProps) => <Base {...p}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /><path d="M19 20a3 3 0 0 1-3 2h-3" /></Base>;
export const IconTruck = (p: IconProps) => <Base {...p}><path d="M2 6h11v10H2zM13 10h4l4 3v3h-8" /><circle cx="6" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></Base>;
export const IconShield = (p: IconProps) => <Base {...p}><path d="M12 3 5 6v6c0 4.4 3 7.8 7 9 4-1.2 7-4.6 7-9V6z" /><path d="m9 12 2 2 4-4" /></Base>;
export const IconPackage = (p: IconProps) => <Base {...p}><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></Base>;
export const IconArrowRight = (p: IconProps) => <Base {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Base>;
export const IconUpload = (p: IconProps) => <Base {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></Base>;
export const IconBank = (p: IconProps) => <Base {...p}><path d="M3 9 12 4l9 5" /><path d="M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3 20h18" /></Base>;
export const IconChat = (p: IconProps) => <Base {...p}><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1z" /></Base>;

export function IconWhatsApp(p: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.2-1.4A9.9 9.9 0 1 0 12.04 2zm0 18.1a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3a8.2 8.2 0 1 1 7 3.9zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
    </svg>
  );
}
