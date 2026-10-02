import React, { useEffect } from "react";
import { WdkPremiumPortfolio } from "../templates/wdk-premium-portfolio-1";
import { wdkFictionalPortfolioData } from "./wdkFictionalPortfolioData";
import { wdkSamplePortfolioData } from "./wdkSamplePortfolioData";

const FONT_AWESOME_KIT = "https://kit.fontawesome.com/53480876a4.js";

function useFontAwesomeKit() {
    useEffect(() => {
        const existing = document.querySelector(`script[src="${FONT_AWESOME_KIT}"]`);
        if (existing) return;
        const script = document.createElement("script");
        script.src = FONT_AWESOME_KIT;
        script.crossOrigin = "anonymous";
        script.async = true;
        document.head.appendChild(script);
    }, []);
}

export const WdkTemplatePreview: React.FC = () => {
    useFontAwesomeKit();
    const fictional = new URLSearchParams(window.location.search).get("data") === "fictional";
    const data = fictional ? wdkFictionalPortfolioData : wdkSamplePortfolioData;

    return <WdkPremiumPortfolio data={data} />;
};
