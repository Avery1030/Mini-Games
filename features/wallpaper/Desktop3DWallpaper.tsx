'use client'

import { useEffect, useRef } from 'react'
import { resolveWallpaperDisplayUrl } from '@/lib/wallpaper'

type Desktop3DWallpaperProps = {
  /** VFS 路径，如 /Wallpapers/3d/foo.glb */
  path: string
  enabled: boolean
}

/**
 * 3D 动态壁纸层：从 VFS 加载 GLB，缓慢自转。
 * 置于桌面背景之上、图标之下。
 */
export function Desktop3DWallpaper({ path, enabled }: Desktop3DWallpaperProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled || !path || !mountRef.current) return

    let disposed = false
    let renderer: import('three').WebGLRenderer | null = null
    let frame = 0
    const mount = mountRef.current

    const run = async () => {
      const [{ Scene, PerspectiveCamera, AmbientLight, DirectionalLight, WebGLRenderer, Color }, { GLTFLoader }] =
        await Promise.all([import('three'), import('three/examples/jsm/loaders/GLTFLoader.js')])

      if (disposed || !mount) return

      const displayUrl = await resolveWallpaperDisplayUrl(path)
      if (!displayUrl || disposed) return

      const scene = new Scene()
      scene.background = null

      const camera = new PerspectiveCamera(45, mount.clientWidth / Math.max(1, mount.clientHeight), 0.1, 100)
      camera.position.set(0, 0.6, 2.4)

      const ambient = new AmbientLight(0xffffff, 0.85)
      scene.add(ambient)
      const dir = new DirectionalLight(0xffffff, 0.9)
      dir.position.set(2, 4, 3)
      scene.add(dir)

      renderer = new WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      renderer.setClearColor(new Color(0x000000), 0)
      mount.appendChild(renderer.domElement)

      const loader = new GLTFLoader()
      const gltf = await loader.loadAsync(displayUrl)
      if (disposed) return
      const root = gltf.scene
      scene.add(root)

      const onResize = () => {
        if (!renderer || !mount) return
        const w = mount.clientWidth
        const h = Math.max(1, mount.clientHeight)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', onResize)

      const tick = () => {
        if (disposed || !renderer) return
        root.rotation.y += 0.004
        renderer.render(scene, camera)
        frame = requestAnimationFrame(tick)
      }
      tick()

      return () => {
        window.removeEventListener('resize', onResize)
      }
    }

    let extraCleanup: (() => void) | undefined
    void run().then((cleanup) => {
      extraCleanup = cleanup
    })

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      extraCleanup?.()
      if (renderer) {
        renderer.dispose()
        if (renderer.domElement.parentElement === mount) {
          mount.removeChild(renderer.domElement)
        }
      }
    }
  }, [enabled, path])

  if (!enabled || !path) return null

  return (
    <div
      ref={mountRef}
      className='pointer-events-none absolute inset-0 z-0 overflow-hidden'
      aria-hidden
    />
  )
}
