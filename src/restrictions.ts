import axios from 'axios'

// TODO: Add status restriction
export type Restriction = {
    type: 'score' | 'episodes' | 'duration' | 'full_duration'
    operator: '>' | '<'
    value: number
}
export const parseRestrictions = (text: string): Restriction[] | null => {
    const lines = text.split('\n')
    const parsedLines = lines.map((line) => {
        const match = line.match(
            /(score|episodes|duration|full_duration)(<|>)(\d+(?:\.\d+)?)/
        )
        if (!match) {
            return null
        }
        return {
            type: match[1],
            operator: match[2],
            value: parseFloat(match[3]),
        } as Restriction
    })
    if (parsedLines.some((e) => e == null)) {
        return null
    }
    return parsedLines.filter((e) => e != null)
}

const queryShikimori = `
query($ids: String) {
  animes(ids: $ids) {
    name
    episodes
    status
    score
    duration
  }
}`

const execOp = (op: '>' | '<', a: number, b: number) =>
    op == '>' ? a > b : a < b

export const checkShikimoriRestrictions = async (
    id: number,
    restrictions: Restriction[]
) => {
    console.log(restrictions, id)
    const res = await axios.post(`https://shikimori.one/api/graphql`, {
        query: queryShikimori,
        variables: { ids: id.toString() },
    })
    const title = res.data.data?.animes?.at(0)
    if (!title) {
        return false
    }
    // TODO: Remove released restriction
    if (title.status != 'released') {
        return false
    }
    for (const restriction of restrictions) {
        switch (restriction.type) {
            case 'score':
                if (
                    !execOp(
                        restriction.operator,
                        title.score,
                        restriction.value
                    )
                ) {
                    console.log(
                        'score mismatch',
                        restriction.operator,
                        title.score,
                        restriction.value
                    )
                    return false
                }
                break
            case 'episodes':
                if (
                    !execOp(
                        restriction.operator,
                        title.episodes,
                        restriction.value
                    )
                ) {
                    console.log(
                        'episodes mismatch',
                        restriction.operator,
                        title.episodes,
                        restriction.value
                    )
                    return false
                }
                break
            case 'duration':
                if (
                    !execOp(
                        restriction.operator,
                        title.duration,
                        restriction.value
                    )
                ) {
                    console.log(
                        'duration mismatch',
                        restriction.operator,
                        title.duration,
                        restriction.value
                    )
                    return false
                }
                break
            case 'full_duration':
                if (
                    !execOp(
                        restriction.operator,
                        title.duration * title.episodes,
                        restriction.value
                    )
                ) {
                    console.log(
                        'full_duration mismatch',
                        restriction.operator,
                        title.duration * title.episodes,
                        restriction.value
                    )
                    return false
                }
                break
        }
    }
    return true
}
