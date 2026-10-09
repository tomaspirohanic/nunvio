"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav style={{ marginTop: 20 }}>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <li key={item.href} style={{ marginBottom: 10 }}>
              <Link
                href={item.href}
                style={{
                  textDecoration: "none",
                  fontWeight: isActive ? "bold" : "normal",
                }}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
