import React from "react";
import { UserCheck, Building, Calendar } from "lucide-react";

interface ProjectDetailsProps {
  role: string;
  client: string;
  year: string;
  onRoleChange: (value: string) => void;
  onClientChange: (value: string) => void;
  onYearChange: (value: string) => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({
  role,
  client,
  year,
  onRoleChange,
  onClientChange,
  onYearChange,
}) => {
  return (
    <section
      id="project-details-section"
      className="bg-white border border-[#E5E5E1] rounded-[2px] p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
    >
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-[#E5E5E1]/70">
        <div>
          <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#708595] block mb-1">
            02 / Details
          </span>
          <h2 className="text-lg font-medium text-[#1A1A1B] tracking-[-0.02em]">
            Engagement & Context
          </h2>
        </div>
        <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#849693]">
          Optional Details
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Role */}
        <div>
          <label
            htmlFor="project-role-input"
            className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] block mb-2"
          >
            Role / Responsibility
          </label>
          <div className="relative flex items-center">
            <UserCheck className="w-4 h-4 text-[#849693] absolute left-3 pointer-events-none" />
            <input
              type="text"
              id="project-role-input"
              value={role}
              onChange={(e) => onRoleChange(e.target.value)}
              placeholder="e.g. Lead Designer"
              className="w-full text-sm pl-9 pr-3.5 py-2.5 bg-[#F8F8F7] border border-[#E5E5E1] rounded-[2px] text-[#1A1A1B] placeholder:text-[#849693]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors"
              maxLength={80}
            />
          </div>
          <p className="text-[11px] text-[#849693] mt-1 font-light">
            Your key role on this project.
          </p>
        </div>

        {/* Client */}
        <div>
          <label
            htmlFor="project-client-input"
            className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] block mb-2"
          >
            Client / Organization
          </label>
          <div className="relative flex items-center">
            <Building className="w-4 h-4 text-[#849693] absolute left-3 pointer-events-none" />
            <input
              type="text"
              id="project-client-input"
              value={client}
              onChange={(e) => onClientChange(e.target.value)}
              placeholder="e.g. Acme Corp or Personal Project"
              className="w-full text-sm pl-9 pr-3.5 py-2.5 bg-[#F8F8F7] border border-[#E5E5E1] rounded-[2px] text-[#1A1A1B] placeholder:text-[#849693]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors"
              maxLength={80}
            />
          </div>
          <p className="text-[11px] text-[#849693] mt-1 font-light">
            Leave blank if independent work.
          </p>
        </div>

        {/* Year */}
        <div>
          <label
            htmlFor="project-year-input"
            className="font-support text-[11px] uppercase tracking-[0.14em] text-[#708595] block mb-2"
          >
            Year
          </label>
          <div className="relative flex items-center">
            <Calendar className="w-4 h-4 text-[#849693] absolute left-3 pointer-events-none" />
            <input
              type="text"
              id="project-year-input"
              value={year}
              onChange={(e) => onYearChange(e.target.value)}
              placeholder="e.g. 2026"
              className="w-full text-sm pl-9 pr-3.5 py-2.5 bg-[#F8F8F7] border border-[#E5E5E1] rounded-[2px] text-[#1A1A1B] placeholder:text-[#849693]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors"
              maxLength={20}
            />
          </div>
          <p className="text-[11px] text-[#849693] mt-1 font-light">
            Year or timeline of completion.
          </p>
        </div>
      </div>
    </section>
  );
};
