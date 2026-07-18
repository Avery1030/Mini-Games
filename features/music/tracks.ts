export type RepeatMode = 'off' | 'all' | 'one'

export interface Track {
  id: string
  title: string
  artist: string
  /** 可直接给 <audio> 的地址（本地 blob、同源 public、或 /api/music/proxy） */
  src: string
  durationHint?: number
  /** 本地文件标记，卸载时 revoke */
  local?: boolean
  /** 来源标签 */
  source?: string
}

/** 外链经同源代理，避免直连被拦；已是同源路径则原样返回 */
export function toPlayableSrc(url: string): string {
  if (!url) return url
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  if (url.startsWith('/')) return url
  if (url.includes('/api/music/proxy?')) return url
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    if (typeof window !== 'undefined' && u.origin === window.location.origin) {
      return u.pathname + u.search
    }
  } catch {
    return url
  }
  return `/api/music/proxy?url=${encodeURIComponent(url)}`
}

/** 内置演示曲（经代理拉取，保证可播） */
export const DEMO_TRACKS: Track[] = [
  {
    id: 'helix-1',
    title: 'SoundHelix Song 1',
    artist: 'T. Schürger',
    src: toPlayableSrc('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'),
    source: 'demo',
  },
  {
    id: 'helix-2',
    title: 'SoundHelix Song 2',
    artist: 'T. Schürger',
    src: toPlayableSrc('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'),
    source: 'demo',
  },
  {
    id: 'helix-3',
    title: 'SoundHelix Song 3',
    artist: 'T. Schürger',
    src: toPlayableSrc('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'),
    source: 'demo',
  },
  {
    id: 'sample-filesamples',
    title: 'Sample MP3',
    artist: 'FileSamples',
    src: toPlayableSrc('https://filesamples.com/samples/audio/mp3/sample3.mp3'),
    source: 'demo',
  },
]

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function buildShuffleOrder(length: number, currentIndex: number): number[] {
  const indices = Array.from({ length }, (_, i) => i).filter((i) => i !== currentIndex)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return [currentIndex, ...indices]
}
