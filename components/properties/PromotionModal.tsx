"use client";

// ============================================
// PROMOTION MODAL COMPONENT
// ============================================
// Modal for selecting property promotion tier
// Shows pricing and duration for each tier
// Initiates Stripe checkout on selection
// ============================================

import { useState } from "react";
import { PromotionLevel } from "@prisma/client";
import { createCheckoutSession } from "@/lib/stripe.server";
import { useRouter } from "next/navigation";
import { PROMOTION_TIERS_UI } from "@/lib/stripe.config";

interface PromotionModalProps {
  propertyId: string;
  currentPromotionLevel: PromotionLevel;
  featuredUntil: Date | null;
  onClose: () => void;
}

const PROMOTION_TIERS = PROMOTION_TIERS_UI;

export default function PromotionModal({
  propertyId,
  currentPromotionLevel,
  featuredUntil,
  onClose,
}: PromotionModalProps) {
  const [selectedTier, setSelectedTier] = useState<PromotionLevel | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const isCurrentlyFeatured =
    featuredUntil && new Date(featuredUntil) > new Date();

  const handlePromote = async (tierLevel: PromotionLevel) => {
    if (!tierLevel || tierLevel === PromotionLevel.NONE) {
      alert("Please select a promotion tier.");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await createCheckoutSession(propertyId, tierLevel);

      if (result?.url) {
        // Redirect to Stripe Checkout
        window.location.href = result.url;
      } else {
        alert("Failed to create checkout session. Please try again.");
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred. Please try again.";
      alert(errorMessage);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Promote Your Property
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isProcessing}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Current Status */}
          {isCurrentlyFeatured && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Current Promotion:</strong> {currentPromotionLevel}
                {featuredUntil && (
                  <span className="ml-2">
                    (Expires: {new Date(featuredUntil).toLocaleDateString()})
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Promotion Tiers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {Object.entries(PROMOTION_TIERS).map(([tierId, tier]) => {
              const isSelected = selectedTier === tier.level;
              const isCurrentTier = currentPromotionLevel === tier.level;
              const isUpgrade =
                currentPromotionLevel !== PromotionLevel.NONE &&
                tier.level !== currentPromotionLevel;

              return (
                <div
                  key={tierId}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    isSelected
                      ? "border-blue-500 shadow-lg"
                      : "border-gray-200 hover:border-gray-300"
                  } ${isCurrentTier ? "bg-blue-50" : ""}`}
                  onClick={() => !isProcessing && setSelectedTier(tier.level)}
                >
                  <div
                    className={`bg-gradient-to-r ${tier.color} text-white rounded-lg p-3 mb-3 text-center`}
                  >
                    <div className="text-2xl font-bold">{tier.name}</div>
                  </div>
                  <div className="text-center mb-3">
                    <div className="text-3xl font-bold text-gray-900">
                      €{Number(tier.price).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">
                      for {tier.durationDays} days
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    {tier.description}
                  </div>
                  {/* Features List */}
                  {tier.features && (
                    <ul className="text-xs text-gray-500 space-y-1 mb-3">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {isCurrentTier && (
                    <div className="text-xs text-blue-600 font-medium">
                      Current Plan
                    </div>
                  )}
                  {isUpgrade && (
                    <div className="text-xs text-green-600 font-medium">
                      Upgrade Available
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Benefits List */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">
              Promotion Benefits:
            </h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✓ Featured placement at the top of listings</li>
              <li>✓ Increased visibility to potential buyers</li>
              <li>✓ Priority sorting in search results</li>
              <li>✓ Visual badge highlighting your property</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                selectedTier && handlePromote(selectedTier)
              }
              disabled={!selectedTier || isProcessing}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                "Continue to Payment"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
