/** Speech models work at 16 kHz mono; this is also small enough to send inline. */
export const WAV_SAMPLE_RATE = 16_000

/** 16-bit PCM WAV bytes for mono samples in the range -1..1. */
export function encodeWav(samples: Float32Array, sampleRate: number = WAV_SAMPLE_RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const text = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)) }
  text(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE')
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return bytes
}

/**
 * Converts a recording (WebM/Opus, MP4 and so on) to 16 kHz mono WAV in the browser. Some speech services accept only
 * a few audio formats and the browser records in whichever one it supports, so this makes the input uniform.
 */
export async function blobToWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext()
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
    const length = Math.max(1, Math.ceil(decoded.duration * WAV_SAMPLE_RATE))
    const offline = new OfflineAudioContext(1, length, WAV_SAMPLE_RATE) // mixes down to mono and resamples
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start()
    const rendered = await offline.startRendering()
    return new Blob([encodeWav(rendered.getChannelData(0)) as BlobPart], { type: 'audio/wav' })
  } finally {
    ctx.close().catch(() => {})
  }
}

/** Base64 of a blob without building a giant string through spread arguments. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
