"use client";

import { deleteProperty } from "@/lib/properties.server";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface DeletePropertyButtonProps {
  propertyId: string;
}

export default function DeletePropertyButton({ propertyId }: DeletePropertyButtonProps) {
  const t = useTranslations("PropertyActions");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(t("deleteConfirm"))) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProperty(propertyId);
      // The page will revalidate automatically via revalidatePath
    } catch (error) {
      console.error("Error deleting property:", error);
      alert(t("deleteFailedAlert"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      className="flex-1 text-center text-sm text-red-600 hover:text-red-800 py-2 px-4 rounded hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isDeleting ? t("deletingText") : t("deleteButton")}
    </button>
  );
}
