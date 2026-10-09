"use client";

// ============================================
// ADD PROPERTY BUTTON COMPONENT
// ============================================
// Session-aware CTA button for adding properties
// - If authenticated → redirects to /dashboard/properties/new
// - If not authenticated → redirects to /login
// ============================================

import { useSession } from "next-auth/react";
import { useRouter } from "@/src/i18n/routing";
import { useLocale } from "next-intl";
import { useState } from "react";

interface AddPropertyButtonProps {
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  className?: string;
  children?: React.ReactNode;
}

export default function AddPropertyButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
}: AddPropertyButtonProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    setIsLoading(true);
    if (session) {
      // User is authenticated → go to create property page
      router.push("/dashboard/properties/new");
    } else {
      // User is not authenticated → go to login
      router.push("/login");
    }
  };

  const baseClasses = "font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg",
    secondary: "bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50",
  };

  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const displayText = children || "Add Property";

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || status === "loading"}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {isLoading ? "Loading..." : displayText}
    </button>
  );
}
