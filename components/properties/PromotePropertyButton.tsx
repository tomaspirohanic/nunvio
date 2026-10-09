"use client";

// ============================================
// PROMOTE PROPERTY BUTTON COMPONENT
// ============================================
// Client component for initiating property promotion
// Opens promotion modal to select tier
// ============================================

import { useState } from "react";
import { PromotionLevel } from "@prisma/client";
import PromotionModal from "./PromotionModal";
import { useTranslations } from "next-intl";

interface PromotePropertyButtonProps {
  propertyId: string;
  currentPromotionLevel: PromotionLevel;
  featuredUntil: Date | null;
}

export default function PromotePropertyButton({
  propertyId,
  currentPromotionLevel,
  featuredUntil,
}: PromotePropertyButtonProps) {
  const t = useTranslations("PropertyActions");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isCurrentlyFeatured =
    featuredUntil && new Date(featuredUntil) > new Date();

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
      >
        {isCurrentlyFeatured
          ? t("upgradePromotionButton")
          : t("promotePropertyButton")}
      </button>

      {isModalOpen && (
        <PromotionModal
          propertyId={propertyId}
          currentPromotionLevel={currentPromotionLevel}
          featuredUntil={featuredUntil}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
