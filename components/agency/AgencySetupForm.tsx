"use client";

// ============================================
// AGENCY SETUP FORM COMPONENT
// ============================================
// Form for creating a new agency profile
// ============================================

import { useState } from "react";
import { useRouter } from "@/src/i18n/routing";
import type { createAgency } from "@/lib/agency.server";
import { useTranslations } from "next-intl";

interface AgencySetupFormProps {
  createAgency: typeof import("@/lib/agency.server").createAgency;
}

export default function AgencySetupForm({ createAgency }: AgencySetupFormProps) {
  const router = useRouter();
  const t = useTranslations("AgencySetupForm");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createAgency({
        name: formData.get("name") as string,
        companyId: formData.get("companyId") as string,
        address: formData.get("address") as string,
        city: formData.get("city") as string,
        country: formData.get("country") as string,
        phone: (formData.get("phone") as string) || undefined,
        email: (formData.get("email") as string) || undefined,
        website: (formData.get("website") as string) || undefined,
        logoUrl: (formData.get("logoUrl") as string) || undefined,
      });

      if (result.success) {
        router.push("/dashboard/agency/team");
        router.refresh();
      }
    } catch (err: any) {
      console.error("Agency setup error:", err);
      setError(err.message || t("genericError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          {t("agencyNameLabel")} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          className={inputClass}
          placeholder={t("agencyNamePlaceholder")}
        />
      </div>

      <div>
        <label htmlFor="companyId" className="block text-sm font-medium text-gray-700 mb-1">
          {t("companyIdLabel")} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="companyId"
          name="companyId"
          required
          className={inputClass}
          placeholder={t("companyIdPlaceholder")}
        />
        <p className="mt-1 text-sm text-gray-500">
          {t("companyIdHelpText")}
        </p>
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
          {t("addressLabel")} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="address"
          name="address"
          required
          className={inputClass}
          placeholder={t("addressPlaceholder")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
            {t("cityLabel")} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="city"
            name="city"
            required
            className={inputClass}
            placeholder={t("cityPlaceholder")}
          />
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
            {t("countryLabel")} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="country"
            name="country"
            required
            className={inputClass}
            placeholder={t("countryPlaceholder")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            className={inputClass}
            placeholder="+421..."
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Contact email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            className={inputClass}
            placeholder="info@agency.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
          {t("websiteOptionalLabel")}
        </label>
        <input
          type="url"
          id="website"
          name="website"
          className={inputClass}
          placeholder={t("websitePlaceholder")}
        />
      </div>

      <div>
        <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 mb-1">
          {t("logoUrlOptionalLabel")}
        </label>
        <input
          type="url"
          id="logoUrl"
          name="logoUrl"
          className={inputClass}
          placeholder={t("logoUrlPlaceholder")}
        />
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isSubmitting ? t("creatingAgencyText") : t("createAgencyButton")}
        </button>
      </div>
    </form>
  );
}
