import type { DashboardData } from "@/types/dashboard";

export async function getDashboardData(): Promise<DashboardData> {
  return {
    userName: "John Doe",
    projectsCount: 3,
  };
}
