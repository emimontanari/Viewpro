export function parseTraceSampleRate(rawSampleRate: string | undefined) {
  const sampleRate = Number(rawSampleRate ?? 0)

  if (!Number.isFinite(sampleRate) || sampleRate < 0 || sampleRate > 1) {
    return 0
  }

  return sampleRate
}
