'use client'

import { useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { Button, Panel, toast } from '@/components/ui'
import { exportAndDownloadAppBackup, importAppBackupFromFile } from '@/lib/storage/backupRuntime'
import { useVfsStore } from '@/store/vfsStore'

export function DataSection() {
  const t = useTranslations('settings')
  const { setTheme } = useTheme()
  const fileRef = useRef<HTMLInputElement>(null)
  const vfsFileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<Nullable<'export' | 'import' | 'vfs-export' | 'vfs-import'>>(null)

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

  const onImportFile = async (files: Nullable<FileList>) => {
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

  const onVfsExport = async () => {
    setBusy('vfs-export')
    try {
      const snapshot = await useVfsStore.getState().exportAll()
      const blob = new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `avery-vfs-${new Date().toISOString().slice(0, 10)}.json`
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(t('vfsExportOk'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backupExportFail'))
    } finally {
      setBusy(null)
    }
  }

  const onVfsImportFile = async (files: Nullable<FileList>) => {
    const file = files?.[0]
    if (!file) return
    setBusy('vfs-import')
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      await useVfsStore.getState().importAll(parsed)
      toast.success(t('vfsImportOk'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backupImportFail'))
    } finally {
      setBusy(null)
      if (vfsFileRef.current) vfsFileRef.current.value = ''
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

      <Panel inset className='space-y-3'>
        <div>
          <div className='text-xs font-bold mb-1.5'>{t('vfsBackup')}</div>
          <p className='mb-2 text-[10px] text-muted'>{t('vfsBackupHint')}</p>
          <div className='flex flex-wrap gap-2'>
            <Button size='sm' loading={busy === 'vfs-export'} disabled={busy != null} onClick={() => void onVfsExport()}>
              {t('vfsExportAction')}
            </Button>
            <input
              ref={vfsFileRef}
              type='file'
              accept='application/json,.json'
              className='hidden'
              onChange={(e) => void onVfsImportFile(e.target.files)}
            />
            <Button size='sm' loading={busy === 'vfs-import'} disabled={busy != null} onClick={() => vfsFileRef.current?.click()}>
              {t('vfsImportAction')}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  )
}
