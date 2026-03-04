import { Description as HeadlessDescription, Dialog as HeadlessDialog, DialogPanel as HeadlessDialogPanel, DialogTitle as HeadlessDialogTitle } from '@headlessui/react'
import { useState, useEffect } from 'react'
import { useGame } from '~/context/GameProvider'

type DialogProps = {
  children?: React.ReactNode
  buttonText: string
  title?: string
  description?: string
}

export default function Dialog({ children, buttonText, title, description }: DialogProps) {
  const { dispatch } = useGame()
  let [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (isOpen) {
      dispatch({ type: "pauseGame" })
    } else {
      dispatch({ type: "resumeGame" })
    }
  }, [isOpen])


  return (
    <>
      <button className="text-xs cursor-pointer select-none" onClick={() => setIsOpen(true)}>{buttonText}</button>
      <HeadlessDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        transition
        className="fixed inset-0 flex w-screen items-center justify-center bg-black/30 p-4 transition duration-300 ease-out data-closed:opacity-0"
      >
        <HeadlessDialogPanel className="min-w-sm bg-default shadow-default rounded-lg p-4">
          {title && <HeadlessDialogTitle className="text-center mb-4 text-lg font-bold">{title}</HeadlessDialogTitle>}
          {description && <HeadlessDescription>{description}</HeadlessDescription>}
          {children}
        </HeadlessDialogPanel>
      </HeadlessDialog>
    </>
  )
}