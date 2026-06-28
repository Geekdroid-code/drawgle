import type { SVGProps } from "react";

export interface DrawgleLogoProps extends SVGProps<SVGSVGElement> {
  animated?: boolean;
}

export function DrawgleLogo({ className, animated = false, ...props }: DrawgleLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
      {...props}
    >
      {animated && (
        <style>
          {`
            @keyframes drawgle-breathe {
              0%, 100% {
                opacity: 0.85;
                transform: scale(0.96) rotate(0deg);
              }
              45% {
                opacity: 1;
                transform: scale(1.05) rotate(15deg);
              }
            }
            .drawgle-animated-logo {
              animation: drawgle-breathe 2.4s ease-in-out infinite;
              transform-origin: center;
            }
          `}
        </style>
      )}
      <g className={animated ? "drawgle-animated-logo" : ""}>
        <rect x="44.5" y="10" width="11" height="80" rx="5.5" />
        <rect x="44.5" y="10" width="11" height="80" rx="5.5" transform="rotate(60 50 50)" />
        <rect x="44.5" y="10" width="11" height="80" rx="5.5" transform="rotate(120 50 50)" />
      </g>
    </svg>
  );
}
