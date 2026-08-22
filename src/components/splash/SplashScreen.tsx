import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { brand } from "../../config/branding";

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  minDuration = 2000,
}) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
      onComplete();
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration, onComplete]);

  return (
    <div
      id="splash-screen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F8F8F7] px-6 selection:bg-[#6DAEAD]/20"
    >
      {/* Foundation Accent Bar */}
      <div className="fixed left-0 top-0 w-1 h-full bg-gradient-to-b from-[#708595] to-[#6DAEAD] z-30 pointer-events-none" />

      <div className="flex flex-col items-center justify-center max-w-sm w-full">
        {/* Centered Splash Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{
            duration: 0.9,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative flex items-center justify-center mb-8"
        >
          <img
            id="splash-brand-logo"
            src={brand.splashLogoUrl}
            alt={`${brand.name} ${brand.endorsement}`}
            referrerPolicy="no-referrer"
            loading="eager"
            className="w-28 sm:w-32 md:w-36 h-auto object-contain select-none pointer-events-none"
          />
        </motion.div>

        {/* Minimalist Custom Brand Accent Loading Indicator */}
        <motion.div
          initial={{ opacity: 0, width: "0%" }}
          animate={{ opacity: 1, width: "100%" }}
          transition={{
            delay: 0.3,
            duration: 0.6,
            ease: "easeOut",
          }}
          className="w-32 sm:w-36 h-[2px] bg-[#E5E5E1] rounded-full overflow-hidden relative"
        >
          <motion.div
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-[#708595] via-[#6DAEAD] to-[#94CEBB]"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{
              duration: 1.4,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.2,
            }}
          />
        </motion.div>
      </div>
    </div>
  );
};
