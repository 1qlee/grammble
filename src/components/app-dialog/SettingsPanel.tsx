import { Description, Field as HeadlessField } from '@headlessui/react'
import { ThemeToggle } from '~/components/buttons/ThemeToggle'
import Label from '~/components/ui/forms/Label'
import Toggle from '~/components/ui/Toggle'
import { useSettings } from '~/utils/providers/settings-provider'

type SettingFieldProps = {
  label: string
  description?: string
  control: React.ReactNode
}

function SettingField({ label, description, control }: SettingFieldProps) {
  return (
    <HeadlessField className="bg-accent p-4 rounded-lg w-full flex justify-between items-center gap-4">
      <div className="flex flex-col">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <Description className="text-xs text-accent">
            {description}
          </Description>
        )}
      </div>
      {control}
    </HeadlessField>
  )
}

export default function SettingsPanel() {
  const {
    confirmAllGuesses,
    setConfirmAllGuesses,
    colorBlindMode,
    setColorBlindMode,
    reduceMotion,
    setReduceMotion,
  } = useSettings()

  return (
    <div className="space-y-2">
      <SettingField label="Dark Mode" control={<ThemeToggle />} />
      <SettingField
        label="Confirm All Guesses"
        description="Requires another press on the enter key to submit your guess."
        control={
          <Toggle
            checked={confirmAllGuesses}
            onChange={setConfirmAllGuesses}
            aria-label="Toggle confirm guess"
          />
        }
      />
      <SettingField
        label="Color Blind Mode"
        description="Uses a high-contrast orange and blue palette for tile feedback."
        control={
          <Toggle
            checked={colorBlindMode}
            onChange={setColorBlindMode}
            aria-label="Toggle color blind mode"
          />
        }
      />
      <SettingField
        label="Reduce Motion"
        description="Minimizes tile and board animations across the game."
        control={
          <Toggle
            checked={reduceMotion}
            onChange={setReduceMotion}
            aria-label="Toggle reduce motion"
          />
        }
      />
    </div>
  )
}
