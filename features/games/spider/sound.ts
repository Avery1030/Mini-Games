import { isServer } from '@/lib/env'

type AudioWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext
}

let sharedCtx: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null

function getAudioContext(): AudioContext | null {
  if (isServer) return null
  const AudioCtx = window.AudioContext || (window as AudioWindow).webkitAudioContext
  if (!AudioCtx) return null
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AudioCtx()
  }
  if (sharedCtx.state === 'suspended') {
    void sharedCtx.resume()
  }
  return sharedCtx
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer
  const length = Math.ceil(ctx.sampleRate * 0.2)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  noiseBuffer = buffer
  return buffer
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** 单段极短纸牌摩擦：干、薄、偏中高，无低频轰鸣 */
function playGrain(ctx: AudioContext, when: number, volume: number, centerHz: number): void {
  const noise = ctx.createBufferSource()
  noise.buffer = getNoiseBuffer(ctx)
  const offset = Math.random() * 0.08

  const high = ctx.createBiquadFilter()
  high.type = 'highpass'
  high.frequency.value = 900

  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.setValueAtTime(centerHz, when)
  band.frequency.exponentialRampToValueAtTime(Math.max(800, centerHz * rand(0.55, 0.85)), when + 0.04)
  band.Q.value = rand(0.7, 1.4)

  const low = ctx.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 5200

  const dur = rand(0.018, 0.038)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), when + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur)

  noise.connect(high)
  high.connect(band)
  band.connect(low)
  low.connect(gain)
  gain.connect(ctx.destination)
  noise.start(when, offset, dur + 0.01)
  noise.stop(when + dur + 0.015)
}

/**
 * 手工洗牌：0.6–0.9s 内多段细碎短噪声高低错落叠加，
 * 整体由稍大慢慢减弱，干薄纸牌「哗啦哗啦」摩擦感。
 */
export function playShuffleSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const t0 = ctx.currentTime
  const duration = rand(0.62, 0.88)
  const peak = 0.16

  let t = 0
  while (t < duration) {
    const progress = t / duration
    const gap = rand(0.012, 0.028) + progress * rand(0.008, 0.018)
    const env = (1 - progress * 0.82) * (0.75 + Math.random() * 0.35)
    playGrain(ctx, t0 + t, peak * env, rand(1600, 3800))
    if (Math.random() < 0.35) {
      playGrain(ctx, t0 + t + rand(0.002, 0.01), peak * env * 0.45, rand(2800, 4500))
    }
    t += gap
  }

  t = rand(0.02, 0.05)
  while (t < duration * 0.92) {
    const progress = t / duration
    const env = (1 - progress * 0.85) * rand(0.35, 0.65)
    playGrain(ctx, t0 + t, peak * env, rand(1400, 3200))
    t += rand(0.03, 0.055)
  }
}
