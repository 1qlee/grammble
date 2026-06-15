import { Description as HeadlessDescription, Dialog as HeadlessDialog, DialogPanel as HeadlessDialogPanel, DialogTitle as HeadlessDialogTitle } from '@headlessui/react'
import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

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
        className="fixed inset-0 flex w-screen items-end justify-center sm:items-center bg-black/30 sm:p-4 transition duration-200 ease-out data-closed:opacity-0 z-50"
      >
        <HeadlessDialogPanel transition className="relative w-full sm:max-w-sm bg-default-shadow rounded-lg transition duration-200 ease-out data-closed:translate-y-full sm:data-closed:translate-y-0">
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close dialog"
            className="absolute top-0 right-0 z-10 grid -translate-y-1/2 translate-x-1/2 place-items-center rounded-full bg-default-interactive p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="max-h-[90vh] overflow-y-auto rounded-lg">
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
