"use client";

// ============================================
// HERO SECTION COMPONENT
// ============================================
// Large hero section with background image and search bar
// Zillow/Airbnb style with overlay and centered content
// ============================================

import { useTranslations } from "next-intl";
import HeroSearch from "./HeroSearch";

interface HeroProps {
  propertyCount: number;
}

export default function Hero({ propertyCount }: HeroProps) {
  const t = useTranslations("Hero");

  return (
    <section className="relative w-full h-[600px] md:h-[700px] flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1920&h=1080&fit=crop&q=80"
          alt="Beautiful real estate property"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full px-4 py-12">
        <div className="w-[95%] max-w-7xl mx-auto">
          {/* Title and Subtitle */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
              {t("title")}
            </h1>
            <p className="text-lg md:text-xl text-white/90 drop-shadow-md">
              {t("subtitle", { count: propertyCount })}
            </p>
          </div>

          {/* Search Bar */}
          <HeroSearch />
        </div>
      </div>
    </section>
  );
}
