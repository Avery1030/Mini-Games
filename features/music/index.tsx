'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import {
  DEMO_TRACKS,
  buildShuffleOrder,
  toPlayableSrc,
  type RepeatMode,
  type Track,
} from './tracks'
import { NowPlayingPanel } from './NowPlayingPanel'
import { LibraryPanel, type SearchHit } from './LibraryPanel'

export interface MusicProps {
  embedded?: boolean
}
export function Music({ embedded = false }: MusicProps = {}) {
  const t = useTranslations('music')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const seekDragging = useRef(false)
  const rafRef = useRef(0)
  const barsRef = useRef<HTMLCanvasElement>(null)
  const repeatRef = useRef<RepeatMode>('all')
  const goNextRef = useRef<(fromEnded?: boolean) => void>(() => {})
  const playingRef = useRef(false)

  const [tracks, setTracks] = useState<Track[]>(DEMO_TRACKS)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('all')
  const [shuffle, setShuffle] = useState(false)
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'playlist' | 'search'>('playlist')

  repeatRef.current = repeat
  playingRef.current = playing

  const current = tracks[currentIndex] ?? null

  const stopBars = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
  }, [])

  /** 不接管 MediaElement（避免 CORS / AudioContext 导致静音），仅做装饰频谱 */
  const drawBars = useCallback(() => {
    const canvas = barsRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let t = 0

    const paint = () => {
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      const barCount = 16
      const gap = 3
      const barW = (width - gap * (barCount - 1)) / barCount
      t += 0.08
      const active = playingRef.current
      for (let i = 0; i < barCount; i++) {
        const v = (0.25 + 0.55 * Math.abs(Math.sin(t + i * 0.45))) * (active ? 1 : 0.12)
        const h = Math.max(2, v * height)
        ctx.fillStyle = `rgba(245, 197, 66, ${0.35 + v * 0.65})`
        ctx.fillRect(i * (barW + gap), height - h, barW, h)
      }
      rafRef.current = requestAnimationFrame(paint)
    }

    stopBars()
    rafRef.current = requestAnimationFrame(paint)
  }, [stopBars])

  useEffect(() => {
    drawBars()
    return () => stopBars()
  }, [drawBars, stopBars])

  useEffect(() => {
    return () => {
      tracks.forEach((t) => {
        if (t.local) URL.revokeObjectURL(t.src)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !current) return
    setError(null)
    setCurrentTime(0)
    setDuration(0)
    audio.src = current.src
    audio.load()
    if (playing) {
      void audio.play().catch(() => {
        setPlaying(false)
        setError('无法播放该曲目，可换一首或添加本地文件')
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = muted ? 0 : volume
  }, [volume, muted])

  const resolveNextIndex = useCallback(
    (fromEnded: boolean) => {
      if (tracks.length === 0) return -1
      if (shuffle) {
        let order = shuffleOrder
        if (order.length !== tracks.length || !order.includes(currentIndex)) {
          order = buildShuffleOrder(tracks.length, currentIndex)
          setShuffleOrder(order)
        }
        const pos = order.indexOf(currentIndex)
        if (pos < order.length - 1) return order[pos + 1]!
        if (repeat === 'all' || !fromEnded) {
          const next = buildShuffleOrder(tracks.length, currentIndex)
          setShuffleOrder(next)
          return next[1] ?? next[0] ?? -1
        }
        return -1
      }
      if (currentIndex < tracks.length - 1) return currentIndex + 1
      if (repeat === 'all' || !fromEnded) return 0
      return -1
    },
    [tracks.length, shuffle, shuffleOrder, currentIndex, repeat],
  )

  const resolvePrevIndex = useCallback(() => {
    if (tracks.length === 0) return -1
    if (shuffle && shuffleOrder.length === tracks.length) {
      const pos = shuffleOrder.indexOf(currentIndex)
      if (pos > 0) return shuffleOrder[pos - 1]!
      return shuffleOrder[shuffleOrder.length - 1]!
    }
    return currentIndex > 0 ? currentIndex - 1 : tracks.length - 1
  }, [tracks.length, shuffle, shuffleOrder, currentIndex])

  const goNext = useCallback(
    (fromEnded = false) => {
      const next = resolveNextIndex(fromEnded)
      if (next < 0) {
        setPlaying(false)
        return
      }
      setCurrentIndex(next)
      setPlaying(true)
    },
    [resolveNextIndex],
  )
  goNextRef.current = goNext

  const goPrev = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    const prev = resolvePrevIndex()
    if (prev < 0) return
    setCurrentIndex(prev)
    setPlaying(true)
  }, [resolvePrevIndex])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => {
      if (!seekDragging.current) setCurrentTime(audio.currentTime)
    }
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      if (repeatRef.current === 'one') {
        audio.currentTime = 0
        void audio.play()
        return
      }
      goNextRef.current(true)
    }
    const onError = () => setError('加载失败，请换一首或检查网络')

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [])

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !current) return
    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        setError('播放被阻止，请再点一次播放')
      }
    } else {
      audio.pause()
    }
  }, [current])

  const playAt = useCallback(
    async (index: number) => {
      if (index === currentIndex) {
        await togglePlay()
        return
      }
      setCurrentIndex(index)
      setPlaying(true)
    },
    [currentIndex, togglePlay],
  )

  const cycleRepeat = () => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))
  }

  const toggleShuffle = () => {
    setShuffle((s) => {
      const next = !s
      if (next) setShuffleOrder(buildShuffleOrder(tracks.length, currentIndex))
      return next
    })
  }

  const onSeek = (value: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(duration) || duration <= 0) return
    audio.currentTime = value
    setCurrentTime(value)
  }

  const addLocalFiles = (files: FileList | null) => {
    if (!files?.length) return
    const added: Track[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name)) {
        continue
      }
      added.push({
        id: `local-${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        artist: t('local'),
        src: URL.createObjectURL(file),
        local: true,
        source: 'local',
      })
    }
    if (added.length === 0) return
    setTracks((prev) => [...prev, ...added])
    setTab('playlist')
  }

  const removeTrack = (id: string) => {
    setTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      if (idx < 0) return prev
      const track = prev[idx]!
      if (track.local) URL.revokeObjectURL(track.src)
      const next = prev.filter((t) => t.id !== id)
      if (next.length === 0) {
        setPlaying(false)
        setCurrentIndex(0)
        const audio = audioRef.current
        if (audio) {
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
        }
        return next
      }
      if (idx === currentIndex) {
        setCurrentIndex(Math.min(idx, next.length - 1))
      } else if (idx < currentIndex) {
        setCurrentIndex((i) => i - 1)
      }
      return next
    })
  }

  const runSearch = async () => {
    const q = query.trim()
    if (!q) {
      setSearchError(t('needKeyword'))
      return
    }
    setSearching(true)
    setSearchError(null)
    setTab('search')
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(q)}&rows=24`)
      const data = (await res.json()) as { results?: SearchHit[]; error?: string }
      if (!res.ok) {
        setHits([])
        setSearchError(data.error || t('searchFail'))
        return
      }
      setHits(data.results ?? [])
      if (!(data.results?.length)) {
        setSearchError(data.error || t('noResults'))
      }
    } catch {
      setHits([])
      setSearchError(t('networkError'))
    } finally {
      setSearching(false)
    }
  }

  const addSearchHit = async (hit: SearchHit, playNow: boolean) => {
    if (!hit.previewUrl) {
      setSearchError(t('noSource'))
      return
    }

    const trackId = `${hit.source || 'remote'}-${hit.id}`
    const existing = tracks.findIndex((t) => t.id === trackId)
    if (existing >= 0) {
      setTab('playlist')
      if (playNow) {
        setCurrentIndex(existing)
        setPlaying(true)
      }
      return
    }

    setResolvingId(hit.id)
    setSearchError(null)
    try {
      const track: Track = {
        id: trackId,
        title: hit.title,
        artist: hit.artist,
        src: toPlayableSrc(hit.previewUrl),
        durationHint: hit.durationHint,
        source: hit.source || 'audius',
      }
      setTracks((prev) => {
        if (playNow) {
          setCurrentIndex(prev.length)
          setPlaying(true)
        }
        return [...prev, track]
      })
      setTab('playlist')
    } finally {
      setResolvingId(null)
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        void togglePlay()
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        onSeek(Math.min(duration, currentTime + 5))
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        onSeek(Math.max(0, currentTime - 5))
      } else if (e.code === 'ArrowUp') {
        e.preventDefault()
        setVolume((v) => Math.min(1, v + 0.05))
        setMuted(false)
      } else if (e.code === 'ArrowDown') {
        e.preventDefault()
        setVolume((v) => Math.max(0, v - 0.05))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const coverHue = useMemo(() => {
    if (!current) return 200
    let h = 0
    for (const c of current.id) h = (h + c.charCodeAt(0) * 17) % 360
    return h
  }, [current])

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-[#e8e8e8] bg-[#1a1a1a] select-none'),
      )}
    >
      <audio ref={audioRef} preload='metadata' />

      <NowPlayingPanel
        current={current ?? undefined}
        coverHue={coverHue}
        barsRef={barsRef}
        currentTime={currentTime}
        duration={duration}
        progress={progress}
        playing={playing}
        volume={volume}
        muted={muted}
        shuffle={shuffle}
        repeat={repeat}
        error={error}
        query={query}
        searching={searching}
        seekDragging={seekDragging}
        onSeek={onSeek}
        onTogglePlay={() => void togglePlay()}
        onGoPrev={goPrev}
        onGoNext={() => goNext(false)}
        onToggleShuffle={toggleShuffle}
        onCycleRepeat={cycleRepeat}
        onVolumeChange={(v) => {
          setVolume(v)
          if (v > 0) setMuted(false)
        }}
        onToggleMute={() => setMuted((m) => !m)}
        onQueryChange={setQuery}
        onSearch={() => void runSearch()}
        onCurrentTimePreview={setCurrentTime}
      />

      <LibraryPanel
        tab={tab}
        tracks={tracks}
        hits={hits}
        currentIndex={currentIndex}
        playing={playing}
        searching={searching}
        searchError={searchError}
        resolvingId={resolvingId}
        repeat={repeat}
        shuffle={shuffle}
        fileInputRef={fileInputRef}
        onTabChange={setTab}
        onPlayAt={(index) => void playAt(index)}
        onRemoveTrack={removeTrack}
        onAddLocalFiles={addLocalFiles}
        onAddSearchHit={(hit, playNow) => void addSearchHit(hit, playNow)}
      />
    </div>
  )
}
