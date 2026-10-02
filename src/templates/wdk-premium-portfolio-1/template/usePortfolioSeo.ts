import { useLayoutEffect } from 'react'
import type { PortfolioSEO } from '../types/portfolio.ts'

type Restore = () => void

function upsertMeta(attribute: 'name' | 'property', key: string, content: string): Restore {
    const selector = `meta[${attribute}="${key}"]`
    const existing = document.head.querySelector(selector)
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

export function usePortfolioSeo(seo: PortfolioSEO) {
    useLayoutEffect(() => {
        const previousTitle = document.title
        document.title = seo.title

        const restore = [
            upsertMeta('name', 'description', seo.description),
            upsertMeta('name', 'robots', 'index, follow'),
            upsertCanonical(seo.canonicalUrl),
            upsertMeta('property', 'og:type', 'website'),
            upsertMeta('property', 'og:url', seo.canonicalUrl),
            upsertMeta('property', 'og:title', seo.ogTitle),
            upsertMeta('property', 'og:description', seo.ogDescription),
            upsertMeta('property', 'og:image', seo.ogImage),
            upsertMeta('name', 'twitter:card', 'summary_large_image'),
            upsertMeta('name', 'twitter:title', seo.twitterTitle),
            upsertMeta('name', 'twitter:description', seo.twitterDescription),
            upsertMeta('name', 'twitter:image', seo.twitterImage),
        ]

        return () => {
            document.title = previousTitle
            restore.forEach((undo) => undo())
        }
    }, [seo])
}
