"use client";

// ============================================
// XML IMPORT FORM
// ============================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { XmlImportResult } from "@/lib/import.server";

interface XmlImportFormProps {
  processXmlImport: (formData: FormData) => Promise<XmlImportResult>;
}

export default function XmlImportForm({ processXmlImport }: XmlImportFormProps) {
  const router = useRouter();
  const t = useTranslations("XmlImportForm");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<XmlImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function handleSubmit(formData: FormData) {
    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await processXmlImport(formData);
      if (result.success) {
        setSuccess(result);
        setTimeout(() => router.refresh(), 1500);
      }
    } catch (err: unknown) {
      console.error("XML import error:", err);
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setIsProcessing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setError(null);
    setSuccess(null);
  }

  return (
    <div className="space-y-6">
      <form action={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="file"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {t("selectXmlFileLabel")} <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            id="file"
            name="file"
            accept=".xml,application/xml,text/xml"
            required
            onChange={handleFileChange}
            disabled={isProcessing}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600">
              {t("selectedLabel")}{" "}
              <span className="font-medium">{selectedFile.name}</span>{" "}
              ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            <p className="font-medium">{t("errorTitle")}</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-green-900">
            <p className="font-medium">{t("importCompleteTitle")}</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>
                {t("importCreatedText", { count: success.created })}
              </li>
              <li>
                {t("importUpdatedText", { count: success.updated })}
              </li>
              <li>
                {t("importImagesText", {
                  uploaded: success.imagesUploaded,
                  failed: success.imagesFailed,
                })}
              </li>
              {success.errors > 0 && (
                <li className="text-amber-800">
                  {t("importFailedText", { errors: success.errors })}
                </li>
              )}
            </ul>
            {success.errorMessages.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium">
                  {t("viewErrorDetails")}
                </summary>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                  {success.errorMessages.map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isProcessing || !selectedFile}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {t("processingText")}
            </>
          ) : (
            t("processImportButton")
          )}
        </button>
      </form>
    </div>
  );
}
