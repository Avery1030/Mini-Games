'use client'

import type { SpecialKind, TileKind } from './types'

export const TILE_VISUAL: Record<
  TileKind,
  { fill: string; stroke: string; label: string }
> = {
  ruby: { fill: '#e85d5d', stroke: '#9b2c2c', label: '红宝石' },
  sapphire: { fill: '#5b8def', stroke: '#1e4cad', label: '蓝宝石' },
  emerald: { fill: '#3ecf8e', stroke: '#1a7a4c', label: '翡翠' },
  topaz: { fill: '#f0c03a', stroke: '#a67c00', label: '黄玉' },
  amethyst: { fill: '#b07aef', stroke: '#6b2fb5', label: '紫晶' },
  amber: { fill: '#f08a3a', stroke: '#a84e10', label: '琥珀' },
}

export function TileGlyph({
  kind,
  special,
  size = 28,
}: {
  kind: TileKind
  special?: SpecialKind
  size?: number
}) {
  const v = TILE_VISUAL[kind]
  const s = size
  return (
    <svg width={s} height={s} viewBox='0 0 32 32' aria-hidden className='shrink-0 drop-shadow-sm'>
      {kind === 'ruby' && (
        <path d='M16 3 L28 12 L22 28 L10 28 L4 12 Z' fill={v.fill} stroke={v.stroke} strokeWidth='1.5' />
      )}
      {kind === 'sapphire' && (
        <circle cx='16' cy='16' r='11' fill={v.fill} stroke={v.stroke} strokeWidth='1.5' />
      )}
      {kind === 'emerald' && (
        <rect x='6' y='6' width='20' height='20' rx='3' fill={v.fill} stroke={v.stroke} strokeWidth='1.5' />
      )}
      {kind === 'topaz' && (
        <path d='M16 4 L28 16 L16 28 L4 16 Z' fill={v.fill} stroke={v.stroke} strokeWidth='1.5' />
      )}
      {kind === 'amethyst' && (
        <path
          d='M16 3 L19.5 11.5 L28 12.5 L21.5 18.5 L23.5 27 L16 22.5 L8.5 27 L10.5 18.5 L4 12.5 L12.5 11.5 Z'
          fill={v.fill}
          stroke={v.stroke}
          strokeWidth='1.2'
        />
      )}
      {kind === 'amber' && (
        <path d='M16 5 L26 10 V22 L16 27 L6 22 V10 Z' fill={v.fill} stroke={v.stroke} strokeWidth='1.5' />
      )}
      {special === 'lineH' && (
        <path d='M5 16 H27' stroke='#fff' strokeWidth='2.5' strokeLinecap='round' />
      )}
      {special === 'lineV' && (
        <path d='M16 5 V27' stroke='#fff' strokeWidth='2.5' strokeLinecap='round' />
      )}
      {special === 'blast' && (
        <>
          <path d='M16 6 L18 14 L26 16 L18 18 L16 26 L14 18 L6 16 L14 14 Z' fill='#fff' stroke={v.stroke} strokeWidth='1' />
        </>
      )}
      {special === 'color' && (
        <circle cx='16' cy='16' r='5' fill='none' stroke='#fff' strokeWidth='2.2' />
      )}
    </svg>
  )
}
