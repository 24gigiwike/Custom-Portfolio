import { commaSeparated } from '../presentation/commaList.ts'

export function CapabilityTags({ tags }: { tags: string[] }) {
    const label = commaSeparated(tags)
    if (!label) return null
    return <h3 className="capability-tags">{label}</h3>
}
