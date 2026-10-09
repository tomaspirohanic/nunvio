import {
  PrismaClient,
  UserRole,
  PropertyType,
  ListingOffer,
  Currency,
  PropertyStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "tomas.pirohanic@gmail.com";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: UserRole.SUPERADMIN },
    create: {
      email: adminEmail,
      name: "Tomáš Pirohanič",
      role: UserRole.SUPERADMIN,
      emailVerified: new Date(),
    },
  });

  console.log("✅ SUPERADMIN:", admin.email);

  let agency = await prisma.agency.findFirst({
    where: { companyId: "NUNVIO-DEMO" },
  });

  if (!agency) {
    agency = await prisma.agency.create({
      data: {
        name: "Nunvio Demo Agency",
        companyId: "NUNVIO-DEMO",
        address: "Hlavná 1",
        city: "Bratislava",
        country: "Slovakia",
        phone: "+421900000000",
        email: adminEmail,
      },
    });
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: { agencyId: agency.id, role: UserRole.SUPERADMIN, phone: "+421900000000" },
  });

  const existing = await prisma.property.count({ where: { ownerId: admin.id } });
  if (existing === 0) {
    await prisma.property.create({
      data: {
        title: "Moderný 3-izbový byt v Bratislave",
        description:
          "Svetlý byt s balkónom blízko centra. Vhodný na bývanie aj investíciu. Demo inzerát pre Nunvio.",
        price: 289000,
        currency: Currency.EUR,
        status: PropertyStatus.PUBLISHED,
        city: "Bratislava",
        country: "Slovakia",
        latitude: 48.1486,
        longitude: 17.1077,
        bedrooms: 3,
        bathrooms: 1,
        areaSqm: 78,
        propertyType: PropertyType.APARTMENT,
        offerType: ListingOffer.SALE,
        contactPhone: "+421900000000",
        ownerId: admin.id,
        agencyId: agency.id,
        images: [],
      },
    });
    console.log("✅ Demo property created");
  }

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
