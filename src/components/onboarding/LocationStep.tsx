import React, { useState } from "react";
import { motion } from "motion/react";
import { Button } from "../ui/Button";
import { ArrowLeft, ArrowRight, AlertCircle, MapPin } from "lucide-react";

interface LocationStepProps {
  initialLocation?: string;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (location?: string) => void;
  onBack: () => void;
}

export const LocationStep: React.FC<LocationStepProps> = ({
  initialLocation = "",
  isSubmitting,
  submitError,
  onSubmit,
  onBack,
}) => {
  const [location, setLocation] = useState(initialLocation);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(location.trim() || undefined);
  };

  const handleSkip = () => {
    onSubmit(undefined);
  };

  return (
    <motion.form
      id="onboarding-step-location"
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full flex flex-col items-start text-left"
    >
      <span className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#3E7574]">
        Step 04 — Origin
      </span>

      <h2 className="mb-3 text-3xl font-bold leading-[1.1] tracking-[-0.04em] text-[#243838] sm:text-4xl">
        Where are you based?
      </h2>

      <p className="mb-8 text-base text-[#5C7372]">
        Your city or region helps ground your presence. This is optional.
      </p>

      <div className="w-full mb-6">
        <label
          htmlFor="location-input"
          className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#3E7574]"
        >
          City, Country or Region
        </label>
        <div className="relative">
          <input
            id="location-input"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Lagos, Nigeria or London, UK"
            autoFocus
            disabled={isSubmitting}
            className="w-full rounded-xl border border-[#D5E6E5] bg-[#F7FBFA] py-3.5 pl-11 pr-4 text-xl font-semibold text-[#243838] transition-all duration-200 placeholder:text-[#8AADAC] focus:border-[#6DAEAD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6DAEAD]/30 disabled:opacity-60 sm:text-2xl"
          />
          <MapPin className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6DAEAD]" />
        </div>
      </div>

      {submitError && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex w-full items-center gap-2 rounded-2xl border border-[#F3C7C7] bg-[#FFF6F6] p-3.5 text-xs font-medium text-[#B93838]"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{submitError}</span>
        </motion.div>
      )}

      <div className="flex w-full flex-col-reverse items-center justify-between gap-3 border-t border-[#E7F4F3] pt-5 sm:flex-row">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            id="location-step-back-button"
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isSubmitting}
            leftIcon={<ArrowLeft className="w-4 h-4 mr-1 text-[#5C7372]" />}
            className="flex-1 sm:flex-initial"
          >
            Back
          </Button>
          <Button
            id="location-step-skip-button"
            type="button"
            variant="ghost"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="flex-1 sm:flex-initial text-[#5C7372]"
          >
            Skip for now
          </Button>
        </div>

        <Button
          id="location-step-submit-button"
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          rightIcon={<ArrowRight className="ml-1 h-4 w-4" />}
          className="w-full sm:w-auto min-w-[190px]"
        >
          Create my portfolio
        </Button>
      </div>
    </motion.form>
  );
};
