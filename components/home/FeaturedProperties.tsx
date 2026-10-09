/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PropertyCard, { type FeaturedProperty } from "@/components/properties/PropertyCard";

export default function FeaturedProperties({
  title,
  locale,
  properties,
}: {
  title: string;
  locale: string;
  properties: FeaturedProperty[];
}) {
  const tProperties = useTranslations("Properties");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    containScroll: "trimSnaps",
  });

  const update = useCallback(() => {
    if (!emblaApi) return;
    const snaps = emblaApi.scrollSnapList();
    setSnapCount(snaps.length);
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    update();
    if (!emblaApi) return;
    emblaApi.on("select", update);
    emblaApi.on("reInit", update);
    return () => {
      emblaApi.off("select", update);
      emblaApi.off("reInit", update);
    };
  }, [emblaApi, update]);

  const canScrollPrev = emblaApi?.canScrollPrev() ?? false;
  const canScrollNext = emblaApi?.canScrollNext() ?? false;

  const scrollPrev = () => emblaApi?.scrollPrev();
  const scrollNext = () => emblaApi?.scrollNext();

  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi]
  );

  const dots = useMemo(() => Array.from({ length: snapCount }, (_, i) => i), [snapCount]);

  return (
    <div className="w-full bg-white">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label="Prev"
          onClick={scrollPrev}
          disabled={!canScrollPrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/95 shadow-sm border border-gray-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-5 w-5 text-gray-900" />
        </button>

        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {properties.map((property) => (
              <div
                key={property.id}
                className="flex-[0_0_auto] w-[320px] sm:w-[360px] md:w-[440px] pr-4"
                style={{ scrollSnapAlign: "start" }}
              >
                <PropertyCard
                  property={property}
                  locale={locale}
                  tProperties={tProperties}
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          aria-label="Next"
          onClick={scrollNext}
          disabled={!canScrollNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/95 shadow-sm border border-gray-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-5 w-5 text-gray-900" />
        </button>
      </div>

      <div className="flex justify-center mt-6 gap-2">
        {dots.map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => scrollTo(i)}
            className="p-1 rounded-full"
          >
            <span
              className={`w-2 h-2 rounded-full transition-colors block ${
                i === selectedIndex ? "bg-gray-900" : "bg-gray-300"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

