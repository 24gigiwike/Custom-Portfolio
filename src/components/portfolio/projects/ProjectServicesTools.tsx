import React, { useState } from "react";
import { Plus, X, Tag, Wrench } from "lucide-react";

interface ProjectServicesToolsProps {
  services: string[];
  tools: string[];
  onServicesChange: (services: string[]) => void;
  onToolsChange: (tools: string[]) => void;
}

const COMMON_SERVICES = [
  "Brand Identity",
  "Web Design",
  "UI/UX Design",
  "Frontend Development",
  "Art Direction",
  "Creative Direction",
  "Product Strategy",
  "Design Systems",
];

const COMMON_TOOLS = [
  "Figma",
  "React",
  "TypeScript",
  "Tailwind CSS",
  "Next.js",
  "Photoshop",
  "Illustrator",
  "Blender",
  "Node.js",
];

export const ProjectServicesTools: React.FC<ProjectServicesToolsProps> = ({
  services,
  tools,
  onServicesChange,
  onToolsChange,
}) => {
  const [serviceInput, setServiceInput] = useState("");
  const [toolInput, setToolInput] = useState("");

  const handleAddService = (serviceToAdd: string) => {
    const trimmed = serviceToAdd.trim();
    if (!trimmed) return;
    if (!services.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      onServicesChange([...services, trimmed]);
    }
    setServiceInput("");
  };

  const handleRemoveService = (serviceToRemove: string) => {
    onServicesChange(services.filter((s) => s !== serviceToRemove));
  };

  const handleAddTool = (toolToAdd: string) => {
    const trimmed = toolToAdd.trim();
    if (!trimmed) return;
    if (!tools.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      onToolsChange([...tools, trimmed]);
    }
    setToolInput("");
  };

  const handleRemoveTool = (toolToRemove: string) => {
    onToolsChange(tools.filter((t) => t !== toolToRemove));
  };

  return (
    <section
      id="project-services-tools-section"
      className="bg-white border border-[#D5E6E5] rounded-2xl p-6 sm:p-8 shadow-[0_12px_32px_rgba(109,174,173,0.08)]"
    >
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-[#D5E6E5]/70">
        <div>
          <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#5C7372] block mb-1">
            03 / Services & Tools
          </span>
          <h2 className="text-lg font-medium text-[#243838] tracking-[-0.02em]">
            Capabilities & Stack
          </h2>
        </div>
        <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#6E8887]">
          Tags & Skills
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Services / Disciplines */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-3.5 h-3.5 text-[#5C7372]" />
            <label className="font-support text-[11px] uppercase tracking-[0.14em] text-[#5C7372]">
              Services Provided
            </label>
          </div>
          <p className="text-xs text-[#6E8887] font-light mb-3">
            Add disciplines or creative capabilities delivered for this project.
          </p>

          {/* Active Tags */}
          <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
            {services.map((service) => (
              <span
                key={service}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F7FBFA] border border-[#D5E6E5] rounded-2xl text-xs text-[#243838] font-medium"
              >
                <span>{service}</span>
                <button
                  type="button"
                  aria-label={`Remove ${service}`}
                  onClick={() => handleRemoveService(service)}
                  className="text-[#6E8887] hover:text-[#B93838] transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {services.length === 0 && (
              <span className="text-xs text-[#6E8887]/60 italic">No services added yet</span>
            )}
          </div>

          {/* Add Custom Service Input */}
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={serviceInput}
              onChange={(e) => setServiceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddService(serviceInput);
                }
              }}
              placeholder="Add custom service (e.g. Brand Identity)"
              className="flex-1 text-xs px-3 py-2 bg-[#F7FBFA] border border-[#D5E6E5] rounded-2xl text-[#243838] placeholder:text-[#6E8887]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors"
              maxLength={40}
            />
            <button
              type="button"
              onClick={() => handleAddService(serviceInput)}
              className="p-2 bg-white border border-[#D5E6E5] hover:border-[#6DAEAD] text-[#243838] rounded-2xl transition-colors"
              aria-label="Add service"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-1.5">
            {COMMON_SERVICES.filter((s) => !services.includes(s)).slice(0, 5).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleAddService(s)}
                className="text-[11px] px-2 py-0.5 bg-transparent border border-dashed border-[#D5E6E5] text-[#5C7372] hover:text-[#243838] hover:border-[#6DAEAD] rounded-2xl transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>

        {/* Tools & Technologies */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="w-3.5 h-3.5 text-[#5C7372]" />
            <label className="font-support text-[11px] uppercase tracking-[0.14em] text-[#5C7372]">
              Tools & Stack
            </label>
          </div>
          <p className="text-xs text-[#6E8887] font-light mb-3">
            Software, libraries, frameworks, or physical tools used.
          </p>

          {/* Active Tags */}
          <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
            {tools.map((tool) => (
              <span
                key={tool}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F7FBFA] border border-[#D5E6E5] rounded-2xl text-xs text-[#243838] font-mono font-medium"
              >
                <span>{tool}</span>
                <button
                  type="button"
                  aria-label={`Remove ${tool}`}
                  onClick={() => handleRemoveTool(tool)}
                  className="text-[#6E8887] hover:text-[#B93838] transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {tools.length === 0 && (
              <span className="text-xs text-[#6E8887]/60 italic">No tools added yet</span>
            )}
          </div>

          {/* Add Custom Tool Input */}
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={toolInput}
              onChange={(e) => setToolInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTool(toolInput);
                }
              }}
              placeholder="Add tool / technology (e.g. Figma, React)"
              className="flex-1 text-xs px-3 py-2 bg-[#F7FBFA] border border-[#D5E6E5] rounded-2xl text-[#243838] placeholder:text-[#6E8887]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors"
              maxLength={40}
            />
            <button
              type="button"
              onClick={() => handleAddTool(toolInput)}
              className="p-2 bg-white border border-[#D5E6E5] hover:border-[#6DAEAD] text-[#243838] rounded-2xl transition-colors"
              aria-label="Add tool"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-1.5">
            {COMMON_TOOLS.filter((t) => !tools.includes(t)).slice(0, 5).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleAddTool(t)}
                className="text-[11px] px-2 py-0.5 bg-transparent border border-dashed border-[#D5E6E5] text-[#5C7372] hover:text-[#243838] hover:border-[#6DAEAD] rounded-2xl transition-colors"
              >
                + {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
