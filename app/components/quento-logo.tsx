import React from "react";

interface QuentoLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "full" | "icon" | "horizontal";
}

export function QuentoLogo({
  className = "",
  size = "md",
  variant = "full",
}: QuentoLogoProps) {
  if (variant === "horizontal") {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <svg
          viewBox="0 0 260 200"
          className={
            size === "sm" ? "h-7 w-auto" : size === "lg" ? "h-12 w-auto" : "h-9 w-auto"
          }
        >
          <g
            fill="none"
            stroke="#232629"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M 125 170 C 95 170 70 140 75 98 C 80 50 120 32 158 42 C 196 52 215 92 198 132 C 182 170 135 182 112 152 C 92 122 105 75 142 68 C 172 62 188 88 182 112 C 176 136 155 152 132 152 C 112 152 102 136 112 118 C 122 100 145 98 165 118 C 182 135 198 158 222 158" />
          </g>
          <circle cx="242" cy="125" r="14" fill="#E31E24" />
        </svg>
        <div className="flex flex-col leading-none">
          <span className="text-xl font-black tracking-tight text-[#E31E24]">
            Quento
          </span>
          <span className="text-[10px] font-extrabold tracking-[0.32em] text-[#232629] uppercase">
            CLUB
          </span>
        </div>
      </div>
    );
  }

  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 260 200"
        className={`w-auto ${
          size === "sm" ? "h-8" : size === "lg" ? "h-16" : "h-12"
        } ${className}`}
      >
        <g
          fill="none"
          stroke="#232629"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M 125 170 C 95 170 70 140 75 98 C 80 50 120 32 158 42 C 196 52 215 92 198 132 C 182 170 135 182 112 152 C 92 122 105 75 142 68 C 172 62 188 88 182 112 C 176 136 155 152 132 152 C 112 152 102 136 112 118 C 122 100 145 98 165 118 C 182 135 198 158 222 158" />
        </g>
        <circle cx="242" cy="125" r="14" fill="#E31E24" />
      </svg>
    );
  }

  // Full stacked logo (matching photo)
  const sizeClasses = {
    sm: "h-20",
    md: "h-28",
    lg: "h-36",
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg viewBox="0 0 300 310" className={`w-auto ${sizeClasses}`}>
        <g
          fill="none"
          stroke="#232629"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M 125 170 C 95 170 70 140 75 98 C 80 50 120 32 158 42 C 196 52 215 92 198 132 C 182 170 135 182 112 152 C 92 122 105 75 142 68 C 172 62 188 88 182 112 C 176 136 155 152 132 152 C 112 152 102 136 112 118 C 122 100 145 98 165 118 C 182 135 198 158 222 158" />
        </g>
        <circle cx="242" cy="125" r="14" fill="#E31E24" />
        <text
          x="150"
          y="238"
          textAnchor="middle"
          fill="#E31E24"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="46"
          fontWeight="800"
          letterSpacing="-1"
        >
          Quento
        </text>
        <text
          x="150"
          y="278"
          textAnchor="middle"
          fill="#232629"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="24"
          fontWeight="800"
          letterSpacing="9"
        >
          CLUB
        </text>
      </svg>
    </div>
  );
}
