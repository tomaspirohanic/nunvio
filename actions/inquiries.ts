"use server";

import { prisma } from "@/lib/db";
import { sendInquiryEmail } from "@/lib/mail";
import { getAppBaseUrl, localizedPath } from "@/lib/listing";
import { PropertyStatus } from "@prisma/client";

export type InquiryResult =
  | { ok: true; emailLogged?: boolean }
  | { ok: false; error: string };

export async function submitPropertyInquiry(input: {
  propertyId: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  locale?: string;
}): Promise<InquiryResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || null;
  const message = input.message.trim();
  const locale = (input.locale || "en").toLowerCase();

  if (!name || name.length < 2) return { ok: false, error: "invalidName" };
  if (!email || !email.includes("@")) return { ok: false, error: "invalidEmail" };
  if (!message || message.length < 10) return { ok: false, error: "invalidMessage" };
  if (message.length > 4000) return { ok: false, error: "messageTooLong" };

  const property = await prisma.property.findFirst({
    where: {
      id: input.propertyId,
      status: PropertyStatus.PUBLISHED,
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: { select: { email: true, name: true, preferredLocale: true } },
      agency: { select: { email: true, name: true } },
    },
  });

  if (!property) return { ok: false, error: "notFound" };

  await prisma.inquiry.create({
    data: {
      propertyId: property.id,
      recipientUserId: property.ownerId,
      name,
      email,
      phone,
      message,
      locale,
    },
  });

  const recipientEmail =
    property.agency?.email?.trim() ||
    property.owner.email;

  const propertyUrl = `${getAppBaseUrl()}${localizedPath(locale, `/properties/${property.id}`)}`;

  const mail = await sendInquiryEmail({
    to: recipientEmail,
    propertyTitle: property.title,
    propertyUrl,
    senderName: name,
    senderEmail: email,
    senderPhone: phone,
    message,
  });

  return { ok: true, emailLogged: mail.logged };
}
