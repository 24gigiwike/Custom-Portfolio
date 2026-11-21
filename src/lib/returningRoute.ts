import { TEMPLATE_DISCOVERY_PATH } from "../components/discover/templateDiscoveryPath";
import { isPortfolioDesignPath } from "../components/portfolio-design/portfolioDesignPath";
import { isPortfolioEditorPath } from "../components/portfolio-editor/portfolioEditorPath";
import { isPortfolioPublishPath } from "../components/portfolio-publish/portfolioPublishPath";
import { isPublishingPaymentReturnPath } from "../components/portfolio-publish/publishingReturnPath";
import { isPortfolioReviewPath } from "../components/portfolio-review/portfolioReviewPath";
import { isPortfolioSeoPath } from "../components/portfolio-seo/portfolioSeoPath";
import { isPortfolioWorkspacePath, PORTFOLIO_WORKSPACE_PATH } from "../components/portfolio-workspace/portfolioWorkspacePath";

export type ReturningRouteInput = {
  phase: string;
  path: string;
  portfolioCount: number | null;
  hasReadyTemplate: boolean;
};

function pathname(path: string): string {
  return path.split("?")[0].split("#")[0] || "/";
}

export function isPortfolioToolPath(path: string): boolean {
  const current = pathname(path);
  return isPortfolioWorkspacePath(current)
    || isPortfolioEditorPath(current)
    || isPortfolioDesignPath(current)
    || isPortfolioReviewPath(current)
    || isPortfolioPublishPath(current)
    || isPortfolioSeoPath(current)
    || isPublishingPaymentReturnPath(current);
}

export function isReturningLandingPath(path: string): boolean {
  const current = pathname(path);
  return current === "/"
    || current === "/auth"
    || current === "/app"
    || current === "/onboarding"
    || current === "/discover"
    || current === TEMPLATE_DISCOVERY_PATH;
}

/**
 * Where a signed-in user should go next.
 * A null result means the current page stays.
 * Portfolio count must be known. The marketplace stays available so another portfolio can be created.
 */
export function nextSignedInPath(input: ReturningRouteInput): string | null {
  const path = pathname(input.path);
  if (input.portfolioCount === null) return null;
  if (isPortfolioToolPath(path)) return null;

  if (input.portfolioCount > 0 && (path === "/" || path === "/auth" || path === "/app" || path === "/onboarding" || path === "/discover")) {
    return PORTFOLIO_WORKSPACE_PATH;
  }

  if (path === TEMPLATE_DISCOVERY_PATH) {
    if (input.portfolioCount === 0 && input.phase === "ONBOARDING_REQUIRED") return "/onboarding";
    return null;
  }

  if (input.portfolioCount === 0 && input.phase === "ONBOARDING_REQUIRED") {
    if (path === "/" || path === "/auth" || path === "/app" || path === "/discover") return "/onboarding";
  }

  if (input.portfolioCount === 0 && input.phase === "TEMPLATE_DISCOVERY") {
    if (path === "/" || path === "/auth" || path === "/app" || path === "/onboarding" || path === "/discover") {
      return TEMPLATE_DISCOVERY_PATH;
    }
  }

  if (input.phase === "READY" && input.portfolioCount === 0) {
    if (path === "/" || path === "/auth" || path === "/onboarding") return "/app";
  }

  return null;
}
