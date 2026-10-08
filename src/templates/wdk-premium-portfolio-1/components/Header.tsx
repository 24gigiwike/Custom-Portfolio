import { portfolioLogoSrc } from '../presentation/logoSrc.ts'
import type { SocialLink } from '../types/portfolio.ts'
import { SocialLinks } from './SocialLinks.tsx'

type HeaderProps = {
    brandName: string
    logo: string
    socialLinks: SocialLink[]
}

export function Header({ brandName, logo, socialLinks }: HeaderProps) {
    const logoSrc = portfolioLogoSrc(logo)
    return (
        <div className="nav-container-left">
            <div className="nav-container-left-L">
                {logoSrc ? <img alt={brandName} className="logo" src={logoSrc} decoding="async" /> : null}
            </div>
            <div className="nav-container-left-R">
                <SocialLinks links={socialLinks} />
            </div>
        </div>
    )
}
