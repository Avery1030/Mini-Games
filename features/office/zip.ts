/** 无压缩 ZIP 写出，以及 STORE / DEFLATE 读取（导入 xlsx 用） */

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setUint16(0, n, true)
  return b
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function crc32(data: Uint8Array): number {
  let c = ~0
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]!
    for (let j = 0; j < 8; j++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}

export function zipStore(files: Array<{ path: string; data: Uint8Array }>, mime: string): Blob {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = enc.encode(file.path)
    const data = file.data
    const crc = crc32(data)
    const local = concatBytes([
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ])
    const central = concatBytes([
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ])
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const centralDir = concatBytes(centrals)
  const eocd = concatBytes([
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ])
  const packed = concatBytes([...locals, centralDir, eocd])
  const copy = new ArrayBuffer(packed.byteLength)
  new Uint8Array(copy).set(packed)
  return new Blob([copy], { type: mime })
}

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, true)
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true)
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('deflate')
  const copy = new ArrayBuffer(data.byteLength)
  new Uint8Array(copy).set(data)
  const ds = new DecompressionStream('deflate-raw')
  const buf = await new Response(new Blob([copy]).stream().pipeThrough(ds)).arrayBuffer()
  return new Uint8Array(buf)
}

const MAX_UNZIP = 8_000_000

function findEocd(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const min = Math.max(0, bytes.length - 22 - 0xffff)
  for (let i = bytes.length - 22; i >= min; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      const comment = readU16(view, i + 20)
      if (i + 22 + comment === bytes.length) return i
    }
  }
  throw new Error('zip')
}

/** 读取 ZIP 内文件（仅 STORE / DEFLATE） */
export async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buf)
  const view = new DataView(buf)
  const eocd = findEocd(bytes)
  const entries = readU16(view, eocd + 10)
  let central = readU32(view, eocd + 16)
  const files = new Map<string, Uint8Array>()
  const dec = new TextDecoder()
  for (let n = 0; n < entries; n++) {
    if (readU32(view, central) !== 0x02014b50) throw new Error('zip')
    const method = readU16(view, central + 10)
    const compSize = readU32(view, central + 20)
    const uncompSize = readU32(view, central + 24)
    const nameLen = readU16(view, central + 28)
    const extraLen = readU16(view, central + 30)
    const commentLen = readU16(view, central + 32)
    const localOff = readU32(view, central + 42)
    const name = dec.decode(bytes.subarray(central + 46, central + 46 + nameLen))
    if (uncompSize > MAX_UNZIP) throw new Error('zip')
    const localNameLen = readU16(view, localOff + 26)
    const localExtra = readU16(view, localOff + 28)
    const dataOff = localOff + 30 + localNameLen + localExtra
    const packed = bytes.subarray(dataOff, dataOff + compSize)
    let data: Uint8Array
    if (method === 0) data = packed.slice()
    else if (method === 8) data = await inflateRaw(packed)
    else throw new Error('zip')
    if (!name.endsWith('/')) files.set(name, data)
    central += 46 + nameLen + extraLen + commentLen
  }
  return files
}
