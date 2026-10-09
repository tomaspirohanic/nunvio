"use client";

// ============================================
// TEAM MANAGEMENT COMPONENT
// ============================================
// Displays list of agents and form to add new agents
// ============================================

import { useState } from "react";
import type { getAgencyAgents, addAgent } from "@/lib/agency.server";
import { useTranslations } from "next-intl";

interface Agent {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
}

interface TeamManagementProps {
  agents: Awaited<ReturnType<typeof getAgencyAgents>>;
  addAgent: typeof import("@/lib/agency.server").addAgent;
}

export default function TeamManagement({ agents, addAgent }: TeamManagementProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const t = useTranslations("TeamManagement");

  async function handleAddAgent(formData: FormData) {
    setIsAdding(true);
    setError(null);
    setSuccess(null);

    try {
      const email = formData.get("email") as string;
      const result = await addAgent(email);

      if (result.success) {
        setSuccess(t("agentAddedSuccess", { email: result.agent.email }));
        // Reset form
        const form = document.getElementById("add-agent-form") as HTMLFormElement;
        form?.reset();
        // Refresh page to show new agent
        window.location.reload();
      }
    } catch (err: any) {
      console.error("Add agent error:", err);
      setError(err.message || t("genericError"));
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Agent Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {t("addNewAgentHeading")}
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md mb-4">
            {success}
          </div>
        )}

        <form id="add-agent-form" action={handleAddAgent} className="flex gap-4">
          <input
            type="email"
            name="email"
            required
            placeholder={t("emailPlaceholder")}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isAdding}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isAdding ? t("addingText") : t("addAgentButton")}
          </button>
        </form>

        <p className="mt-2 text-sm text-gray-500">
          {t("addAgentHelpText")}
        </p>
      </div>

      {/* Agents List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {t("teamMembersHeading", { count: agents.length })}
        </h2>

        {agents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>{t("noAgentsMessage")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("tableEmail")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("tableName")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("tableRole")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("tableJoined")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {agents.map((agent) => (
                  <tr key={agent.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agent.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {agent.name || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {agent.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(agent.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
