import type { SVGProps } from "react";

export function AquaFeedLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6.5 12c.94-3.46 4.94-6 9.5-6 3.46 0 5.63 1.51 6.37 3.65a.9.9 0 0 1-.37.99l-3.21 2.2a.9.9 0 0 1-1.16-.16L15.5 10.5"/>
      <path d="m16.56 12.55 3.21 2.2a.9.9 0 0 1 .37.99c-.74 2.14-2.91 3.65-6.37 3.65-4.56 0-8.56-2.54-9.5-6"/>
      <path d="M18.5 10.5c.6-.08 1.15.32 1.23.93l.35 2.52"/>
      <path d="M6.9 14.55c.13.9.78 1.58 1.63 1.6S10.25 15.5 10.5 14"/>
      <path d="M10.5 9.5c-.25-.9-.97-1.45-1.85-1.32s-1.5.83-1.35 1.72"/>
      <path d="m5.5 12.5 4.07-.15"/>
      <path d="M21.16 8.08c-1.3-1.15-3.06-1.9-4.66-1.9-1.97 0-3.66.96-4.69 2.16"/>
    </svg>
  );
}
