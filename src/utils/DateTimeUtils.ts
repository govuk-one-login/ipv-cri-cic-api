/**
 * Unix timestamp in seconds
 * The unix timestamp represents seconds elapsed since 01/01/1970
 * @return Example output: 1657099344
 */
export function absoluteTimeNow (): number {
    return Math.floor(Date.now() / 1000)
}
