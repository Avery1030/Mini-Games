import { ImageIcon } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'
import { ImageViewerApp } from '.'

registerBuiltinApp({
  id: 'imageViewer',
  icon: ImageIcon,
  app: ImageViewerApp,
  defaultCoordinate: [3, 5],
  width: 760,
  height: 560,
  titles: { 'zh-CN': '图片查看器', 'en-US': 'Image Viewer' },
})
