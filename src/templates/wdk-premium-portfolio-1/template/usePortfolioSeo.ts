import { useLayoutEffect } from 'react'
import type { PortfolioSEO } from '../types/portfolio.ts'

type Restore = () => void

function upsertMeta(attribute: 'name' | 'property', key: string, content: string): Restore {
    const selector = `meta[${attribute}="${key}"]`
    const existing = document.head.querySelector(selector)
    if (!content) {
        if (!existing) return () => undefined
        const previous = existing.getAttribute('content')
        existing.remove()
        return () => {
            const restored = document.createElement('meta')
            restored.setAttribute(attribute, key)
            if (previous !== null) restored.setAttribute('content', previous)
            document.head.appendChild(restored)
        }
    }
    const created = !existing
    const previous = existing?.getAttribute('content') ?? null
    const element = existing ?? document.createElement('meta')

    if (created) {
        element.setAttribute(attribute, key)
        document.head.appendChild(element)
    }
    element.setAttribute('content', content)

    return () => {
        if (created) {
            element.remove()
            return
        }
        if (previous === null) {
            element.removeAttribute('content')
            return
        }
        element.setAttribute('content', previous)
    }
}

function upsertCanonical(href: string): Restore {
    const existing = document.head.querySelector('link[rel="canonical"]')
    const created = !existing
    const previous = existing?.getAttribute('href') ?? null
    const element = existing ?? document.createElement('link')

    if (created) {
        element.setAttribute('rel', 'canonical')
        document.head.appendChild(element)
    }
    element.setAttribute('href', href)

    return () => {
        if (created) {
            element.remove()
            return
        }
        if (previous === null) {
            element.removeAttribute('href')
            return
        }
        element.setAttribute('href', previous)
    }
}

export function usePortfolioSeo(seo: PortfolioSEO, robots = 'noindex, nofollow') {
    useLayoutEffect(() => {
        const previousTitle = document.title
        document.title = seo.title

        const card = seo.ogImage || seo.twitterImage ? 'summary_large_image' : 'summary'
        const restore = [
            upsertMeta('name', 'description', seo.description),
            upsertMeta('name', 'robots', robots),
            seo.canonicalUrl ? upsertCanonical(seo.canonicalUrl) : () => undefined,
            upsertMeta('property', 'og:type', 'profile'),
            upsertMeta('property', 'og:url', seo.canonicalUrl),
            upsertMeta('property', 'og:title', seo.ogTitle || seo.title),
            upsertMeta('property', 'og:description', seo.ogDescription || seo.description),
            upsertMeta('property', 'og:image', seo.ogImage),
            upsertMeta('name', 'twitter:card', card),
            upsertMeta('name', 'twitter:title', seo.twitterTitle || seo.title),
            upsertMeta('name', 'twitter:description', seo.twitterDescription || seo.description),
            upsertMeta('name', 'twitter:image', seo.twitterImage || seo.ogImage),
        ]

        return () => {
            document.title = previousTitle
            restore.forEach((undo) => undo())
        }
    }, [seo, robots])
}
