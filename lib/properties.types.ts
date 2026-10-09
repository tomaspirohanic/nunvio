// ============================================
// PROPERTY TYPES (SHARED)
// ============================================
// Shared TypeScript types and interfaces for properties
// - Can be imported by both server and client code
// - No server-only dependencies
// ============================================

import { Currency, ListingOffer, PropertyType } from "@prisma/client";

export interface CreatePropertyInput {
  title: string;
  description: string;
  price: number;
  currency: Currency;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  showOnMap?: boolean;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  propertyType: PropertyType;
  offerType?: ListingOffer;
  contactPhone?: string;
  isNewBuild?: boolean;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  address?: string;
  images?: string[];
}

export interface PublicPropertyFilters {
  city?: string;
  country?: string;
  propertyType?: PropertyType;
  offerType?: ListingOffer;
  minPrice?: number;
  maxPrice?: number;
  currency?: Currency;
}
