import { isServer } from '@/lib/env'
import type { FruitLevel } from './fruits'

type AudioWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext
}

let sharedCtx: Nullable<AudioContext> = null

function getAudioContext(): Nullable<AudioContext> {
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

let noiseBuffer: Nullable<AudioBuffer> = null

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer
  const length = Math.ceil(ctx.sampleRate * 0.3)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  noiseBuffer = buffer
  return buffer
}

/**
 * 气球爆破：尖锐短促的「啪」——瞬态噪声 + 快速下滑的空心音。
 * 等级越高，声音略沉、略厚一点。
 */
export function playMergeSound(toLevel: FruitLevel): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const t0 = ctx.currentTime
  const power = toLevel / 10
  const volume = 0.5 + power * 0.04

  // —— 1. 主「啪」：短噪声爆破 ——
  const noise = ctx.createBufferSource()
  noise.buffer = getNoiseBuffer(ctx)

  const hipass = ctx.createBiquadFilter()
  hipass.type = 'highpass'
  hipass.frequency.setValueAtTime(900 - power * 350, t0)

  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  const bandFreq = 1400 - power * 500
  band.frequency.setValueAtTime(bandFreq, t0)
  band.frequency.exponentialRampToValueAtTime(bandFreq * 0.45, t0 + 0.06)
  band.Q.value = 0.9

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.0001, t0)
  noiseGain.gain.exponentialRampToValueAtTime(volume, t0 + 0.0015)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055 + power * 0.02)

  noise.connect(hipass)
  hipass.connect(band)
  band.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  noise.start(t0)
  noise.stop(t0 + 0.12)

  // —— 2. 空心下滑音（气球皮瘪下去的感觉）——
  const body = ctx.createOscillator()
  body.type = 'sine'
  const startF = 320 - power * 80
  body.frequency.setValueAtTime(startF, t0)
  body.frequency.exponentialRampToValueAtTime(70 + power * 20, t0 + 0.08)

  const bodyGain = ctx.createGain()
  bodyGain.gain.setValueAtTime(0.0001, t0)
  bodyGain.gain.exponentialRampToValueAtTime(volume * 0.85, t0 + 0.002)
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09)

  body.connect(bodyGain)
  bodyGain.connect(ctx.destination)
  body.start(t0)
  body.stop(t0 + 0.12)

  // —— 3. 极短高频「刺」一下，更像撕开 ——
  const snap = ctx.createOscillator()
  snap.type = 'triangle'
  snap.frequency.setValueAtTime(1800 - power * 400, t0)
  snap.frequency.exponentialRampToValueAtTime(400, t0 + 0.025)

  const snapGain = ctx.createGain()
  snapGain.gain.setValueAtTime(0.0001, t0)
  snapGain.gain.exponentialRampToValueAtTime(volume * 0.4, t0 + 0.001)
  snapGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03)

  snap.connect(snapGain)
  snapGain.connect(ctx.destination)
  snap.start(t0)
  snap.stop(t0 + 0.05)

  // —— 西瓜：稍大一点的气球，多一声闷响 ——
  if (toLevel === 10) {
    const big = ctx.createOscillator()
    big.type = 'sine'
    big.frequency.setValueAtTime(160, t0 + 0.015)
    big.frequency.exponentialRampToValueAtTime(45, t0 + 0.14)

    const bigGain = ctx.createGain()
    bigGain.gain.setValueAtTime(0.0001, t0 + 0.015)
    bigGain.gain.exponentialRampToValueAtTime(0.07, t0 + 0.02)
    bigGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15)

    big.connect(bigGain)
    bigGain.connect(ctx.destination)
    big.start(t0 + 0.015)
    big.stop(t0 + 0.18)
  }
}
