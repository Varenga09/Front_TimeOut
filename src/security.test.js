import { createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'
import { api } from './api'
import { SecurityMonitor, SecurityUtils } from './security'

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  getAssetUrl: (path) => path || null,
  getErrorMessage: (error) => error?.response?.data?.message || error?.message || 'Erro simulado',
  setAuthToken: vi.fn(),
}))

describe('Tela de acesso', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  test('renderiza a tela de login', () => {
    render(createElement(App))

    expect(screen.getByLabelText('TIMEOUT')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Boas-vindas!' })).toBeInTheDocument()
  })

  test('permite alternar entre login e cadastro', () => {
    render(createElement(App))

    fireEvent.click(screen.getByRole('button', { name: 'Cadastro' }))

    expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nome completo')).toBeInTheDocument()
    expect(screen.getByLabelText('Telefone / WhatsApp')).toBeInTheDocument()
  })

  test('permite mostrar e ocultar a senha', () => {
    render(createElement(App))

    const passwordInput = screen.getByPlaceholderText('Digite sua senha')
    const toggleButton = screen.getByRole('button', { name: 'Mostrar senha' })

    expect(passwordInput).toHaveAttribute('type', 'password')

    fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('mostra confirmação para conta ainda não verificada', () => {
    const session = {
      token: 'token-teste',
      user: {
        id: 99,
        name: 'João Madona',
        email: 'joaovitormadona50@gmail.com',
        phone: '(12) 98105-9300',
        role: 'customer',
        environmentId: 1,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
      },
    }

    localStorage.getItem.mockReturnValue(JSON.stringify(session))
    api.get.mockResolvedValue({ data: { data: { user: session.user } } })

    render(createElement(App))

    expect(screen.getByRole('heading', { name: 'Confirme sua conta' })).toBeInTheDocument()
    expect(screen.getByText('Código de verificação')).toBeInTheDocument()
  })
})

describe('Validação de senha', () => {
  test('valida os requisitos de senha forte', () => {
    let result = SecurityUtils.validatePassword('123')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('A senha deve ter entre 8 e 64 caracteres')

    result = SecurityUtils.validatePassword('password123')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('A senha deve conter pelo menos uma letra maiúscula')

    result = SecurityUtils.validatePassword('Password')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('A senha deve conter pelo menos um número')

    result = SecurityUtils.validatePassword('Password123')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('A senha deve conter pelo menos um caractere especial')

    result = SecurityUtils.validatePassword('Password123!')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('calcula força da senha corretamente', () => {
    expect(SecurityUtils.calculatePasswordStrength('123').strength).toBe('Fraca')
    expect(SecurityUtils.calculatePasswordStrength('Password123').strength).toBe('Forte')
    expect(SecurityUtils.calculatePasswordStrength('Password123!').strength).toBe('Forte')
  })
})

describe('Monitoramento de segurança', () => {
  beforeEach(() => {
    SecurityMonitor.loginAttempts.clear()
    SecurityMonitor.clearSuspiciousActivities()
  })

  test('rastreia tentativas de login', () => {
    SecurityMonitor.trackLoginAttempt('test@email.com', false)
    SecurityMonitor.trackLoginAttempt('test@email.com', false)
    SecurityMonitor.trackLoginAttempt('test@email.com', true)

    const attempts = SecurityMonitor.loginAttempts.get('test@email.com')
    expect(attempts).toHaveLength(3)
    expect(attempts[2].success).toBe(true)
  })

  test('detecta rate limiting', () => {
    for (let index = 0; index < 6; index += 1) {
      SecurityMonitor.trackLoginAttempt('test@email.com', false)
    }

    expect(SecurityMonitor.isRateLimited('test@email.com')).toBe(true)
  })
})
