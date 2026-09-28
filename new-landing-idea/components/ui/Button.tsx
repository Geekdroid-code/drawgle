'use client';

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'default' | 'lg';
  icon?: boolean;
  dark?: boolean; // For secondary buttons on dark backgrounds (e.g. CTA banner)
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'default',
  icon = true,
  dark = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  // Balanced paddings matching the reference exactly
  const primaryPadding = {
    sm: icon ? 'pl-3.5 pr-1' : 'px-3.5',
    default: icon ? 'pl-4.5 pr-1.5' : 'px-5',
    lg: icon ? 'pl-5.5 pr-2' : 'px-6',
  }[size];

  const secondaryPadding = {
    sm: 'px-3.5',
    default: 'px-5',
    lg: 'px-6',
  }[size];

  const heightClasses = {
    sm: 'h-8 text-xs',
    default: 'h-10 text-sm',
    lg: 'h-11 text-base',
  }[size];

  const circleClasses = {
    sm: 'w-6 h-6',
    default: 'w-7 h-7',
    lg: 'w-7.5 h-7.5',
  }[size];

  const iconClasses = {
    sm: 'w-3 h-3',
    default: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  if (variant === 'primary') {
    return (
      <button
        type="button"
        className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 shrink-0 outline-none cursor-pointer bg-[#305dde] text-white hover:bg-[#254cc4] group active:scale-[0.98] border-0 select-none shadow-none ${heightClasses} ${primaryPadding} ${className}`}
        {...props}
      >
        <span>{children}</span>
        {icon && (
          <span
            className={`relative ml-0.5 shrink-0 flex items-center justify-center overflow-hidden rounded-full bg-white ${circleClasses}`}
          >
            {/* Default chevron arrow: slides right and fades out on hover */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#305dde"
              className={`absolute transition-all duration-200 ease-out group-hover:translate-x-3 group-hover:opacity-0 ${iconClasses}`}
            >
              <path
                d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {/* Hover arrow: slides in from the left on hover */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#305dde"
              className={`absolute -translate-x-3 opacity-0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 ${iconClasses}`}
            >
              <path
                d="M18.5 12L4.99997 12"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13 18C13 18 19 13.5811 19 12C19 10.4188 13 6 13 6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </button>
    );
  }

  // Secondary Button Style
  const secondaryBg = dark
    ? 'bg-white/10 text-white hover:bg-white/15'
    : 'bg-black/[0.05] text-[rgb(20,20,20)] hover:bg-black/[0.08]';

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 shrink-0 outline-none cursor-pointer border border-transparent ${secondaryBg} transform-gpu active:translate-y-px active:scale-[0.98] group select-none shadow-none ${heightClasses} ${secondaryPadding} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
