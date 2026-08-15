import { Switch } from '@headlessui/react'

type ToggleProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  'aria-label': string
  className?: string
}

export default function Toggle({ checked, onChange, 'aria-label': ariaLabel, className }: ToggleProps) {
  return (
    <Switch
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      className={`group switch-track ${className ?? ''}`}
    >
      <span className="switch-thumb" />
    </Switch>
  )
}
