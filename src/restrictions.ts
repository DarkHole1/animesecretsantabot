export type Restriction = {
    type: 'score' | 'episodes' | 'time'
    operator: '>' | '<'
    value: number
}
export const parseRestrictions = (text: string): Restriction[] | null => {
    const lines = text.split('\n')
    const parsedLines = lines.map((line) => {
        const match = line.match(/(score|episodes|time)(<|>)(\d+(?:\.\d+))/)
        if (!match) {
            return null
        }
        return {
            type: match[1],
            operator: match[2],
            value: parseInt(match[3]),
        } as Restriction
    })
    return parsedLines.filter((e) => e != null)
}
