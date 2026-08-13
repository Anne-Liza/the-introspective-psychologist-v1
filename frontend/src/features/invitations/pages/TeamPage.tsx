import { useState } from "react";

import { useAuth } from "../../auth/context/AuthContext";
import { TeamMembersPanel } from "../../users/components/TeamMembersPanel";
import { InvitationsPanel } from "../components/InvitationsPanel";

type TeamTab = "members" | "invitations";

export function TeamPage() {
  const { hasPermission } = useAuth();
  const canReadInvitations = hasPermission("invitations.read");
  const canManageInvitations = hasPermission("invitations.manage");
  const [activeTab, setActiveTab] = useState<TeamTab>("members");

  const tabs: Array<{ id: TeamTab; label: string }> = [
    { id: "members", label: "Team members" },
    ...(canReadInvitations
      ? [{ id: "invitations" as const, label: "Invitations" }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#718064]">
          Practice
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#253026]">
          Team
        </h2>
        <p className="mt-2 max-w-2xl text-[#667064]">
          See who has practice access and securely invite approved staff roles.
        </p>
      </div>

      <div
        className="border-b border-[#dfe3d4]"
        role="tablist"
        aria-label="Team sections"
      >
        <div className="flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "border-[#56684b] text-[#34422f]"
                  : "border-transparent text-[#788176] hover:text-[#4f5b4d]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel">
        {activeTab === "invitations" && canReadInvitations ? (
          <InvitationsPanel canManage={canManageInvitations} />
        ) : (
          <TeamMembersPanel />
        )}
      </div>
    </div>
  );
}
