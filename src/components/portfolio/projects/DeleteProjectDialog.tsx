import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../ui/Button";

interface DeleteProjectDialogProps {
  isOpen: boolean;
  projectTitle: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteProjectDialog: React.FC<DeleteProjectDialogProps> = ({
  isOpen,
  projectTitle,
  isDeleting,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="delete-project-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#243838]/35 p-4 backdrop-blur-md sm:p-6"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md rounded-[28px] border border-white/80 bg-white/90 p-6 text-[#243838] shadow-[0_24px_60px_rgba(36,56,56,0.18)] backdrop-blur-xl sm:p-8"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF6F6] text-[#B93838]">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h3 className="text-xl font-bold tracking-[-0.03em]">
              Delete this project?
            </h3>
          </div>

          <p className="mb-3 text-sm font-medium leading-relaxed text-[#5C7372]">
            Your project{" "}
            <strong className="font-bold text-[#243838]">
              {projectTitle || "Untitled"}
            </strong>{" "}
            and its saved information will be permanently removed.
          </p>

          <p className="mb-6 text-sm font-medium text-[#6E8887]">
            This action cannot be undone.
          </p>

          <div className="flex items-center justify-end gap-3 border-t border-[#E7F4F3] pt-4">
            <button
              type="button"
              id="cancel-delete-project-button"
              onClick={onCancel}
              disabled={isDeleting}
              className="rounded-xl px-4 py-2 text-sm font-bold text-[#5C7372] hover:text-[#243838]"
            >
              Cancel
            </button>
            <Button
              id="confirm-delete-project-button"
              variant="primary"
              size="sm"
              isLoading={isDeleting}
              onClick={onConfirm}
              className="border-none bg-[#B93838] text-white shadow-none hover:bg-[#9E3030] focus:ring-[#B93838]"
            >
              Delete project
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
