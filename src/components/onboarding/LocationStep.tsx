import React, { useState } from "react";
import { motion } from "motion/react";
import { Button } from "../ui/Button";
import { ArrowLeft, Sparkles, AlertCircle, MapPin } from "lucide-react";

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
      <span className="font-support text-[11px] uppercase tracking-[0.18em] text-[#708595] mb-2.5">
        Step 04 &mdash; Origin
      </span>

      <h1 className="text-3xl sm:text-4xl md:text-[46px] font-light md:font-[300] leading-[1.12] tracking-[-0.04em] text-[#1A1A1B] mb-3">
        Where are you based?
      </h1>

      <p className="text-base text-[#708595] mb-8 font-normal">
        Your city or region helps ground your presence. This is optional.
      </p>

      <div className="w-full mb-6">
        <label
          htmlFor="location-input"
          className="block text-xs uppercase tracking-[0.1em] font-medium text-[#708595] mb-2 font-support"
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
            className="w-full text-xl sm:text-2xl font-light text-[#1A1A1B] bg-white border border-[#E5E5E1] rounded-[2px] pl-11 pr-4 py-3.5 focus:outline-none focus:border-[#6DAEAD] focus:ring-1 focus:ring-[#6DAEAD] transition-all duration-200 placeholder:text-[#849693]/40 shadow-[0_1px_2px_rgba(0,0,0,0.02)] disabled:opacity-60"
          />
          <MapPin className="w-5 h-5 text-[#849693] absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {submitError && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full p-3.5 mb-6 bg-[#FFF5F5] border border-[#FED7D7] rounded-[2px] text-xs text-[#B93838] flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{submitError}</span>
        </motion.div>
      )}

      <div className="w-full flex flex-col-reverse sm:flex-row items-center justify-between pt-4 border-t border-[#E5E5E1]/60 gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            id="location-step-back-button"
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isSubmitting}
            leftIcon={<ArrowLeft className="w-4 h-4 mr-1 text-[#708595]" />}
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
            className="flex-1 sm:flex-initial text-[#708595]"
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
          rightIcon={<Sparkles className="w-4 h-4 ml-1.5 text-[#94CEBB]" />}
          className="w-full sm:w-auto min-w-[190px]"
        >
          Create my portfolio
        </Button>
      </div>
    </motion.form>
  );
};
