'use client'

import { Sun, Moon, Laptop } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export default function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  // 挂载前渲染空白占位，解决SSR水合不匹配
  if (!mounted) {
    return (
      <div className='w-7 h-7 flex items-center justify-center border border-gray-600 bg-gray-300 rounded cursor-pointer hover:bg-gray-200' />
    )
  }

  const renderIcon = () => {
    if (theme === 'light') return <Sun className='w-4 h-4' />
    if (theme === 'dark') return <Moon className='w-4 h-4' />
    return <Laptop className='w-4 h-4' />
  }

  return (
    <div
      className='w-7 h-7 flex items-center justify-center border border-gray-600 bg-gray-300 rounded cursor-pointer hover:bg-gray-200'
      onClick={toggleTheme}
    >
      {renderIcon()}
    </div>
  )
}
