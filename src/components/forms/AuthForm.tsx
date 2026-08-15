import type { FormEventHandler, ReactNode } from 'react'

type AuthFormProps = {
  children: ReactNode
  onSubmit: FormEventHandler<HTMLFormElement>
}

export default function AuthForm({ children, onSubmit }: AuthFormProps) {
  return (
    <div className="card-wrapper bg-default-shadow">
      <form onSubmit={onSubmit}>
        {children}
      </form>
    </div>
  )
}
