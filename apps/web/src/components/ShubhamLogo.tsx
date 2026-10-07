import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showSubtitle?: boolean;
  className?: string;
}

export function ShubhamLogo({ size = 'md', className = '' }: LogoProps) {
  // Size classes tailored for the official Shubham Fabrics crest & typemark
  const sizeClasses = {
    sm: 'h-10 w-auto max-w-[160px]',
    md: 'h-16 w-auto max-w-[220px]',
    lg: 'h-24 w-auto max-w-[300px]',
    hero: 'h-48 sm:h-56 w-auto max-w-[400px]',
  };

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      <img
        src="/shubham-logo.jpg"
        alt="Shubham Fabrics India Pvt. Ltd. - Weaving Quality, Creating Trust"
        className={`${sizeClasses[size]} object-contain drop-shadow-sm rounded-md transition-transform hover:scale-[1.01]`}
      />
    </div>
  );
}
