'use client'

import LogoLoader from '@/components/ui/LogoLoader'

type ModuleKey = 'project' | 'marketing' | 'people' | 'quality' | 'sales' | 'default'

interface ModuleLoadingOverlayProps {
  module?: ModuleKey
  text?: string
  className?: string
  roundedClassName?: string
  fixed?: boolean
}

export default function ModuleLoadingOverlay({
  module = 'default',
  text = 'Sincronizando Dados...',
  className = '',
  roundedClassName = 'rounded-xl',
  fixed = false,
}: ModuleLoadingOverlayProps) {
  const positionClassName = fixed ? 'fixed inset-0 z-[80]' : 'absolute inset-0 z-50'
  const radiusClassName = fixed ? '' : roundedClassName

  return (
    <div className={`${positionClassName} flex items-center justify-center bg-[#0d0d0f]/68 backdrop-blur-[3px] transition-all duration-300 ${radiusClassName} ${className}`}>
      <LogoLoader module={module} text={text} />
    </div>
  )
}
