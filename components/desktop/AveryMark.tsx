export function AveryMark({ className, title = 'Avery' }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      width='24'
      height='24'
      className={className}
      role='img'
      aria-label={title}
      fill='currentColor'
    >
      <title>{title}</title>
      <path fill='currentColor' d='M12 2.2 3.6 21h3.35l1.55-4.1h7l1.55 4.1H20.4L12 2.2zm0 5.4 2.55 6.7h-5.1L12 7.6z' />
    </svg>
  )
}
