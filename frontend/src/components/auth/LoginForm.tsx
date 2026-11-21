import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AxiosError } from 'axios'
import { useLogin } from '@/hooks/useAuth'
import { getErrorMessage } from '@/lib/errors'
import { loginSchema, LoginInput } from '@/utils/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginForm() {
  const login = useLogin()
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (data: LoginInput) => {
    login.mutate(data)
  }

  const errorMessage = login.error
    ? (login.error instanceof AxiosError && login.error.response?.status === 401
      ? 'Invalid username or password'
      : getErrorMessage(login.error))
    : null

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>Enter your credentials to access GatePass</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" autoComplete="username" autoCapitalize="none" autoFocus {...register('username')} />
            {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          {errorMessage && <p className="text-sm text-destructive" role="alert">{errorMessage}</p>}
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? 'Logging in...' : 'Login'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Forgot your password? Ask your company admin or the building admin to reset it.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
