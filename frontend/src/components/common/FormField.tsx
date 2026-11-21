import { ReactNode, useId, cloneElement, isValidElement } from 'react'
import { Label } from '@/components/ui/label'

interface FormFieldProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}

/** Label + control + validation message, wired together for screen readers. */
export function FormField({ label, error, hint, required, children }: FormFieldProps) {
  const id = useId()
  const control = isValidElement<{ id?: string; 'aria-invalid'?: boolean }>(children)
    ? cloneElement(children, { id: children.props.id ?? id, 'aria-invalid': !!error })
    : children
  const controlId = isValidElement<{ id?: string }>(children) ? children.props.id ?? id : id
  return (
    <div className="space-y-1.5">
      <Label htmlFor={controlId}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {control}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  )
}
