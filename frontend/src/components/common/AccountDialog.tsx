import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import {
  changePasswordSchema, ChangePasswordInput, profileSchema, ProfileInput,
} from '@/utils/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from './FormField'

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const profile = useForm<ProfileInput>({ resolver: zodResolver(profileSchema) })
  const pw = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) })
  const resetProfile = profile.reset
  const resetPassword = pw.reset

  useEffect(() => {
    if (open && user) {
      resetProfile({
        first_name: user.first_name, last_name: user.last_name, email: user.email, phone: user.phone,
      })
      resetPassword({ current_password: '', new_password: '', confirm_password: '' })
    }
  }, [open, user, resetProfile, resetPassword])

  const saveProfile = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (updated) => { setUser(updated); toast.success('Profile updated.') },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const changePassword = useMutation({
    mutationFn: (d: ChangePasswordInput) => authApi.changePassword(d.current_password, d.new_password),
    onSuccess: () => { toast.success('Password changed.'); resetPassword(); onClose() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>My account</DialogTitle>
          <DialogDescription>Signed in as {user?.username}</DialogDescription>
        </DialogHeader>
        <form onSubmit={profile.handleSubmit((d) => saveProfile.mutate(d))} className="space-y-3" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="First name" error={profile.formState.errors.first_name?.message}>
              <Input {...profile.register('first_name')} />
            </FormField>
            <FormField label="Last name" error={profile.formState.errors.last_name?.message}>
              <Input {...profile.register('last_name')} />
            </FormField>
          </div>
          <FormField label="Email" error={profile.formState.errors.email?.message}>
            <Input type="email" {...profile.register('email')} />
          </FormField>
          <FormField label="Phone" hint="Used for SMS alerts about your visitors and deliveries."
            error={profile.formState.errors.phone?.message}>
            <Input type="tel" {...profile.register('phone')} />
          </FormField>
          <Button type="submit" disabled={saveProfile.isPending}>Save profile</Button>
        </form>
        <Separator />
        <form onSubmit={pw.handleSubmit((d) => changePassword.mutate(d))} className="space-y-3" noValidate>
          <h3 className="font-medium">Change password</h3>
          <FormField label="Current password" error={pw.formState.errors.current_password?.message}>
            <Input type="password" autoComplete="current-password" {...pw.register('current_password')} />
          </FormField>
          <FormField label="New password" error={pw.formState.errors.new_password?.message}>
            <Input type="password" autoComplete="new-password" {...pw.register('new_password')} />
          </FormField>
          <FormField label="Confirm new password" error={pw.formState.errors.confirm_password?.message}>
            <Input type="password" autoComplete="new-password" {...pw.register('confirm_password')} />
          </FormField>
          <Button type="submit" disabled={changePassword.isPending}>Change password</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
