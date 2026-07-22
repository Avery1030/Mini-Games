'use client'

import { useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { Button, Panel, toast } from '@/components/ui'
import {
  exportAndDownloadAppBackup,
  importAppBackupFromFile,
} from '@/lib/storage/backupRuntime'

export function DataSection() {
  const t = useTranslations('settings')
  const { setTheme } = useTheme()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)

  const onExport = () => {
    setBusy('export')
    try {
      exportAndDownloadAppBackup()
      toast.success(t('backupExportOk'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backupExportFail'))
    } finally {
      setBusy(null)
    }
  }

  const onImportClick = () => {
    fileRef.current?.click()
  }

  const onImportFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setBusy('import')
    try {
      const { theme, appliedKeys } = await importAppBackupFromFile(file)
      if (theme) {
        document.documentElement.classList.toggle('dark', theme === 'dark')
        setTheme(theme)
      }
      toast.success(t('backupImportOk', { count: appliedKeys }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backupImportFail'))
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className='flex-1 min-h-0 overflow-y-auto p-3 space-y-3'>
      <h2 className='text-base font-bold mb-1'>{t('sections.data')}</h2>
      <p className='text-xs text-muted'>{t('backupHint')}</p>

      <Panel inset className='space-y-3'>
        <div>
          <div className='text-xs font-bold mb-1.5'>{t('backupExport')}</div>
          <p className='mb-2 text-[10px] text-muted'>{t('backupExportHint')}</p>
          <Button size='sm' loading={busy === 'export'} disabled={busy != null} onClick={onExport}>
            {t('backupExportAction')}
          </Button>
        </div>

        <div>
          <div className='text-xs font-bold mb-1.5'>{t('backupImport')}</div>
          <p className='mb-2 text-[10px] text-muted'>{t('backupImportHint')}</p>
          <input
            ref={fileRef}
            type='file'
            accept='application/json,.json'
            className='hidden'
            onChange={(e) => void onImportFile(e.target.files)}
          />
          <Button
            size='sm'
            loading={busy === 'import'}
            disabled={busy != null}
            onClick={onImportClick}
          >
            {t('backupImportAction')}
          </Button>
        </div>
      </Panel>
    </div>
  )
}
