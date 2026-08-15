import { Description as HeadlessDescription, Dialog as HeadlessDialog, DialogPanel as HeadlessDialogPanel, DialogTitle as HeadlessDialogTitle } from '@headlessui/react'
import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import Button from '~/components/buttons/Button'

type DialogProps = {
  children?: React.ReactNode
  buttonText?: string
  title?: string
  description?: string
  onOpen?: () => void
  onClose?: () => void
  // Controlled mode — when provided, internal state is bypassed
  isOpen?: boolean
  setIsOpen?: (open: boolean) => void
}

export default function Dialog({ children, buttonText, title, description, onOpen, onClose, isOpen: isOpenProp, setIsOpen: setIsOpenProp }: DialogProps) {
  const [isOpenInternal, setIsOpenInternal] = useState(false)
  const isMounted = useRef(false)
  const onOpenRef = useRef(onOpen)
  const onCloseRef = useRef(onClose)
  onOpenRef.current = onOpen
  onCloseRef.current = onClose

  const isControlled = isOpenProp !== undefined
  const isOpen = isControlled ? isOpenProp : isOpenInternal
  const setIsOpen = isControlled ? (setIsOpenProp ?? (() => { })) : setIsOpenInternal

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      return
    }
    if (isOpen) {
      onOpenRef.current?.()
    } else {
      onCloseRef.current?.()
    }
  }, [isOpen])

  return (
    <>
      {!isControlled && (
        <button className="p-1 cursor-pointer select-none" onClick={() => setIsOpen(true)}>{buttonText}</button>
      )}
      <HeadlessDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        transition
        className="fixed inset-0 flex w-screen items-end justify-center min-[384px]:items-center bg-black/30 min-[384px]:p-4 transition duration-200 ease-out data-closed:opacity-0 z-50"
      >
        <HeadlessDialogPanel transition className="relative flex max-h-[90vh] w-full max-w-sm flex-col bg-default-shadow rounded-lg transition duration-200 ease-out data-closed:translate-y-full min-[384px]:data-closed:translate-y-0">
          <Button
            size="icon"
            onClick={(e) => {
              // Blur before closing so focus is off this button by the time
              // Headless UI marks a nested portal aria-hidden/inert during the
              // exit transition (avoids the "aria-hidden on focused element"
              // warning when a stacked dialog closes over another).
              e.currentTarget.blur()
              setIsOpen(false)
            }}
            aria-label="Close dialog"
            className="absolute top-0 right-4 z-10 -translate-y-1/2 translate-x-1/2 scale-75 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="w-5 h-5" />
          </Button>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg">
            {title && (
              <div className="mb-4">
                <HeadlessDialogTitle className="text-lg font-bold">{title}</HeadlessDialogTitle>
              </div>
            )}
            {description && <HeadlessDescription>{description}</HeadlessDescription>}
            {children}
          </div>
        </HeadlessDialogPanel>
      </HeadlessDialog>
    </>
  )
}
