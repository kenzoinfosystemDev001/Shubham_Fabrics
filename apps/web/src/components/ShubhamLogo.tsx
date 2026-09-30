import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showSubtitle?: boolean;
}

export function ShubhamLogo({ size = 'md', showSubtitle = true }: LogoProps) {
  const isHero = size === 'hero';
  const isLg = size === 'lg';
  const isSm = size === 'sm';

  const containerClass = isHero
    ? 'w-full max-w-[480px] p-6 text-center'
    : isLg
    ? 'w-64 text-center'
    : isSm
    ? 'flex items-center gap-2'
    : 'w-48 text-center';

  return (
    <div className={`flex flex-col items-center select-none ${containerClass}`}>
      {/* Official SF Intertwined Monogram */}
      <div className={`relative ${isHero ? 'w-44 h-44 mb-3' : isLg ? 'w-28 h-28 mb-2' : isSm ? 'w-9 h-9' : 'w-20 h-20 mb-2'}`}>
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full drop-shadow-sm"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Golden Weave Texture Horizontal Accents */}
          <path
            d="M35 85 Q70 80 100 85 T165 85"
            stroke="#D4AF37"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.85"
          />
          <path
            d="M30 95 Q65 90 98 95 T170 95"
            stroke="#C5A059"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M35 105 Q70 100 100 105 T165 105"
            stroke="#D4AF37"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.85"
          />
          {/* Vertical Golden Warp Strands */}
          <path d="M48 60 V130" stroke="#C5A059" strokeWidth="3" strokeLinecap="round" />
          <path d="M56 55 V135" stroke="#D4AF37" strokeWidth="3" strokeLinecap="round" />
          <path d="M64 50 V140" stroke="#B89740" strokeWidth="3" strokeLinecap="round" />
          <path d="M72 55 V135" stroke="#C5A059" strokeWidth="3" strokeLinecap="round" />

          {/* Letter S - Royal Blue with Calligraphic Serif Flares */}
          <path
            d="M100 55 C82 55 68 64 68 78 C68 94 88 98 106 104 C124 110 134 116 134 130 C134 146 116 155 94 155 C74 155 58 146 54 136"
            stroke="#163767"
            strokeWidth="15"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Letter F - Royal Blue with Serif Crossbar and Terminals */}
          <path
            d="M125 50 V155 M125 52 H168 M125 96 H156"
            stroke="#163767"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Golden Highlights on S curve intersection */}
          <path
            d="M82 82 L96 96 M75 92 L89 106 M89 75 L103 89"
            stroke="#F5E096"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Main Typographic Banner */}
      {!isSm && (
        <div className="w-full text-center">
          <h1
            className={`font-serif font-black tracking-[0.16em] text-[#163767] ${
              isHero ? 'text-3xl' : isLg ? 'text-2xl' : 'text-xl'
            }`}
            style={{ fontFamily: 'Georgia, Cambria, serif' }}
          >
            SHUBHAM
          </h1>

          {/* Flanked Rule for FABRICS INDIA */}
          <div className="flex items-center justify-center gap-2 my-1">
            <div className="h-[1px] bg-[#163767]/40 w-10"></div>
            <span
              className={`font-serif tracking-[0.25em] text-[#163767] font-semibold ${
                isHero ? 'text-xs' : 'text-[10px]'
              }`}
            >
              FABRICS INDIA
            </span>
            <div className="h-[1px] bg-[#163767]/40 w-10"></div>
          </div>

          <p
            className={`tracking-[0.22em] text-[#163767]/90 font-medium ${
              isHero ? 'text-[11px]' : 'text-[9px]'
            }`}
          >
            PRIVATE LIMITED
          </p>

          {/* Cotton Boll Emblem & Slogan */}
          {showSubtitle && (
            <div className="mt-3 flex flex-col items-center">
              <div className="flex items-center justify-center gap-3 w-full">
                <div className="h-[1px] bg-[#C5A059]/60 flex-1 max-w-[60px]"></div>
                {/* Golden Cotton Boll Symbol */}
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#C5A059]" fill="currentColor">
                  <path d="M12 2C8 2 6 5 6 7C4 7 2 9 2 11C2 13 4 15 6 15C6 17 8 20 12 20C16 20 18 17 18 15C20 15 22 13 22 11C22 9 20 7 18 7C18 5 16 2 12 2ZM12 4C14.5 4 16 6 16 7C14.5 8 13.5 10 12 12C10.5 10 9.5 8 8 7C8 6 9.5 4 12 4Z" />
                </svg>
                <div className="h-[1px] bg-[#C5A059]/60 flex-1 max-w-[60px]"></div>
              </div>
              <p
                className={`font-serif tracking-[0.18em] text-[#A68032] mt-1.5 italic font-medium ${
                  isHero ? 'text-xs' : 'text-[10px]'
                }`}
                style={{ fontFamily: 'Georgia, Cambria, serif' }}
              >
                WEAVING QUALITY, CREATING TRUST
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
