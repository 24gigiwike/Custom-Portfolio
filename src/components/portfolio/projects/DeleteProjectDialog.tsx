import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Loader2 } from "lucide-react";
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 sm:p-6"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-white border border-[#E5E5E1] rounded-[2px] p-6 sm:p-8 shadow-[0_12px_32px_rgba(0,0,0,0.12)] text-[#1A1A1B]"
        >
          <div className="flex items-center gap-3 text-[#B91C1C] mb-4">
            <div className="w-8 h-8 rounded-full bg-[#FEF2F2] border border-[#FEE2E2] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[#B91C1C]" />
            </div>
            <h3 className="text-base sm:text-lg font-medium text-[#1A1A1B] tracking-[-0.02em]">
              Delete this project?
            </h3>
          </div>

          <p className="text-xs sm:text-sm text-[#708595] font-light leading-relaxed mb-3">
            Your project <strong className="text-[#1A1A1B] font-medium font-mono text-xs px-1.5 py-0.5 bg-[#F8F8F7] border border-[#E5E5E1] rounded-[2px]">{projectTitle || "Untitled"}</strong> and its saved information will be permanently removed.
          </p>

          <p className="text-xs text-[#849693] font-light mb-6">
            This action cannot be undone.
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E5E1]">
            <button
              type="button"
              id="cancel-delete-project-button"
              onClick={onCancel}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-medium text-[#708595] hover:text-[#1A1A1B] transition-colors rounded-[2px]"
            >
              Cancel
            </button>
            <Button
              id="confirm-delete-project-button"
              variant="primary"
              size="sm"
              isLoading={isDeleting}
              onClick={onConfirm}
              className="bg-[#B91C1C] hover:bg-[#991B1B] text-white border-none shadow-none focus:ring-[#B91C1C]"
            >
              Delete project
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
