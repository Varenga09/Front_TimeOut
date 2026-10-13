import { createElement } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'
import { api } from './api'
import { SecurityMonitor, SecurityUtils } from './security'

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
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

    expect(screen.getByLabelText('Time Out')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Boas-vindas!' })).toBeInTheDocument()
  })

  test('permite alternar entre login e cadastro', () => {
    render(createElement(App))

    fireEvent.click(screen.getByRole('button', { name: 'Cadastro' }))

    expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nome completo')).toBeInTheDocument()
    expect(screen.getByLabelText('Telefone / WhatsApp')).toBeInTheDocument()
  })

  test('cadastro não obriga código de ambiente', async () => {
    localStorage.getItem.mockReturnValue(null)
    api.post.mockResolvedValue({ data: { data: {} } })
    render(createElement(App))
    fireEvent.click(screen.getByRole('button', { name: 'Cadastro' }))
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Pessoa Teste' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'pessoa@timeout.test' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'SenhaForte#123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ email: 'pessoa@timeout.test', environmentAccessCode: undefined })))
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

  test('solicita código para recuperar a senha', async () => {
    api.post.mockResolvedValue({ data: { data: { accepted: true } } })
    render(createElement(App))

    fireEvent.click(screen.getByRole('button', { name: 'Recuperar acesso' }))
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'pessoa@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/password/forgot', {
        email: 'pessoa@example.com',
      })
    })
    expect(screen.getByLabelText('Código de recuperação')).toBeInTheDocument()
  })

  test('mostra confirmação para conta ainda não verificada', async () => {
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

    expect(await screen.findByRole('heading', { name: 'Confirme sua conta' })).toBeInTheDocument()
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

describe('Recebimentos simulados', () => {
  test('mostra conexão fictícia sem solicitar dados bancários', async () => {
    const user = {
      id: 7,
      name: 'Vendedor Teste',
      email: 'vendedor@timeout.local',
      phone: '(12) 99999-9999',
      role: 'seller',
      environmentId: 1,
      emailVerifiedAt: new Date().toISOString(),
      phoneVerifiedAt: new Date().toISOString(),
    }
    localStorage.getItem.mockReturnValue(JSON.stringify({ token: 'token-teste', user }))
    api.get.mockImplementation(async (url) => {
      const payloads = {
        '/auth/me': { user },
        '/products': { products: [] },
        '/categories': { categories: [] },
        '/orders/my-orders': { orders: [] },
        '/orders/seller-orders': { orders: [] },
        '/coupons': { coupons: [] },
        '/payments/settings': { settings: { acceptsPix: true, isActive: true } },
        '/plans': { plans: [] },
        '/payments/payout-account': { account: { status: 'not_connected' }, summary: {}, transactions: [] },
        '/access/me/applications': { sellerApplications: [], environmentApplications: [] },
        '/access/notifications': { notifications: [] },
      }
      return { data: { data: payloads[url] || {} } }
    })

    render(createElement(App))
    fireEvent.click(await screen.findByRole('button', { name: /Recebimentos/ }))

    expect(await screen.findByRole('heading', { name: 'Recebimentos', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conectar conta de recebimento para testes' })).toBeInTheDocument()
    expect(screen.queryByText(/chave pix/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/agência/i)).not.toBeInTheDocument()
  })
})

describe('Painel da equipe Time Out', () => {
  test('abre o painel interno para platform_admin após um novo login', async () => {
    const user = {
      id: 50,
      name: 'Equipe Time Out',
      email: 'equipe@timeout.test',
      role: 'platform_admin',
      environmentId: null,
      emailVerifiedAt: new Date().toISOString(),
    }
    localStorage.getItem.mockReturnValue(JSON.stringify({ token: 'token-teste', user }))
    api.get.mockImplementation(async (url) => {
      const payloads = {
        '/auth/me': { user },
        '/access/platform/dashboard': {
          applications: [],
          environments: [],
          administrators: [],
          auditLogs: [],
          identityVerificationMode: 'mock',
        },
        '/access/notifications': { notifications: [] },
      }
      return { data: { data: payloads[url] || {} } }
    })

    render(createElement(App))

    expect(await screen.findByRole('heading', { name: 'Equipe Time Out' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Equipe Time Out' })).toHaveAttribute('aria-current', 'page')
  })

  test('conta interna com participação aprovada mantém painel e pode abrir a vitrine', async () => {
    const user = { id: 50, name: 'Equipe', email: 'equipe@timeout.test', role: 'platform_admin', environmentId: 2, emailVerifiedAt: new Date().toISOString(), memberships: [{ id: 9, environmentId: 2, role: 'customer', status: 'approved', environment: { id: 2, name: 'Escola', status: 'active' } }] }
    localStorage.getItem.mockReturnValue(JSON.stringify({ token: 'teste', user }))
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/products': { products: [] }, '/categories': { categories: [] }, '/orders/my-orders': { orders: [] }, '/plans': { plans: [] },
      '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
      '/access/platform': { applications: [], sellers: [], environments: [], administrators: [], auditLogs: [] },
      '/access/admin/accounts': { users: [], total: 0, page: 1, totalPages: 0 },
      '/payments/platform/overview': { accounts: [], summary: {} },
    })[url] || {} } }))
    render(createElement(App))
    expect(await screen.findByRole('button', { name: 'Equipe Time Out' })).toBeInTheDocument()
    const market = await screen.findByRole('button', { name: 'Vitrine' })
    fireEvent.click(market)
    expect(market).toHaveAttribute('aria-current', 'page')
  })

  test('recusa de ambiente exige confirmação e motivo antes de chamar a API', async () => {
    const user = { id: 50, name: 'Equipe', email: 'equipe@timeout.test', role: 'platform_admin', environmentId: null, emailVerifiedAt: new Date().toISOString() }
    localStorage.getItem.mockReturnValue(JSON.stringify({ token: 'teste', user }))
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
      '/access/platform': { applications: [{ id: 7, institutionName: 'Escola Exemplo', responsibleName: 'Responsável', cpf: '***.456.789-**', phone: '11999999999', status: 'pending', address: 'Rua Exemplo' }], sellers: [], environments: [], administrators: [], auditLogs: [], applicationPagination: { page: 1, totalPages: 1 } },
      '/access/platform/environment-applications/7': { application: { id: 7, institutionName: 'Escola Exemplo', status: 'pending', applicant: { name: 'Responsável', email: 'responsavel@timeout.test' } }, previousApplications: [], administeredMemberships: [], decisions: [] },
      '/access/admin/accounts': { users: [], total: 0, page: 1, totalPages: 0 }, '/payments/platform/overview': { accounts: [], summary: {} },
    })[url] || {} } }))
    api.patch.mockResolvedValue({ data: { data: {} } })
    render(createElement(App))
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir análise' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Recusar' }))
    expect(api.patch).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { name: 'Recusar solicitação' })
    fireEvent.change(dialog.querySelector('textarea'), { target: { value: 'Dados insuficientes para comprovar o vínculo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/access/platform/environment-applications/7', { status: 'rejected', reason: 'Dados insuficientes para comprovar o vínculo' }))
  })
})

describe('Navegação e isolamento do catálogo', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  test('ignora detalhes atrasados de outro produto e não mostra opções em produto sem sabores', async () => {
    const user = { id: 10, name: 'Cliente', role: 'customer', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ id: 1, environmentId: 1, role: 'customer', status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    const suco = { id: 1, name: 'Suco', imageUrl: '/suco.png', imageGallery: [], flavors: [], price: 5, quantity: 5, seller: { id: 20, name: 'Loja' } }
    const coxinha = { id: 2, name: 'Coxinha', imageUrl: '/coxinha.png', imageGallery: [], flavors: [{ name: 'Frango', priceAdjustment: 2 }], price: 8, quantity: 5, seller: { id: 20, name: 'Loja' } }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    let resolveSuco
    let sucoRequests = 0
    api.get.mockImplementation((url) => {
      if (url === '/products/1') {
        sucoRequests += 1
        if (sucoRequests === 1) return new Promise((resolve) => { resolveSuco = resolve })
        return Promise.resolve({ data: { data: { product: suco } } })
      }
      const payloads = {
        '/auth/me': { user }, '/products': { products: [suco, coxinha] }, '/categories': { categories: [] }, '/orders/my-orders': { orders: [] }, '/plans': { plans: [] },
        '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
        '/products/1/reviews': { reviews: [], averageRating: 0, reviewsCount: 0 }, '/products/2': { product: coxinha }, '/products/2/reviews': { reviews: [], averageRating: 0, reviewsCount: 0 },
      }
      return Promise.resolve({ data: { data: payloads[url] || {} } })
    })
    render(createElement(App))
    fireEvent.click(await screen.findByRole('button', { name: 'Vitrine' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir detalhes de Suco' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalhes de Coxinha' }))
    const dialog = await screen.findByRole('dialog', { name: 'Detalhes de Coxinha' })
    expect(dialog).toHaveTextContent('Frango')
    expect(dialog.querySelector('.modal-purchase-bar strong')).toHaveTextContent('R$ 10,00')
    expect(dialog.querySelector('.gallery-main img')).toHaveAttribute('src', '/coxinha.png')
    fireEvent.click(dialog.querySelector('.purchase-actions .ghost-button'))
    expect(screen.getByRole('button', { name: 'Carrinho (1)' })).toBeInTheDocument()
    resolveSuco({ data: { data: { product: suco } } })
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Detalhes de Coxinha' })).toBeInTheDocument())
    expect(screen.queryByRole('dialog', { name: 'Detalhes de Suco' })).not.toBeInTheDocument()
    fireEvent.click(dialog.querySelector('.modal-close'))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalhes de Suco' }))
    const sucoDialog = await screen.findByRole('dialog', { name: 'Detalhes de Suco' })
    expect(sucoDialog.querySelector('.gallery-main img')).toHaveAttribute('src', '/suco.png')
    expect(sucoDialog).not.toHaveTextContent('Sabores e opções')
  })

  test('logo retorna à vitrine sem encerrar sessão ou carrinho', async () => {
    const user = { id: 10, name: 'Cliente', role: 'customer', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ id: 1, environmentId: 1, role: 'customer', status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => ({ data: { data: ({ '/auth/me': { user }, '/products': { products: [] }, '/categories': { categories: [] }, '/orders/my-orders': { orders: [] }, '/plans': { plans: [] }, '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] } })[url] || {} } }))
    render(createElement(App))
    fireEvent.click(await screen.findByRole('button', { name: 'Histórico de compras' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Ir para o início' })[1])
    expect(screen.getByRole('button', { name: 'Vitrine' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Carrinho (0)' })).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalledWith('/auth/logout')
  })

  test('notificações fecham fora ou com Escape e navegam ao destino ao serem lidas', async () => {
    const user = { id: 50, name: 'Equipe', role: 'platform_admin', environmentId: null, emailVerifiedAt: new Date().toISOString() }
    const notification = { id: 9, title: 'Nova solicitação', message: 'Há uma solicitação para revisar.', targetView: 'access', resourceType: 'environment_application', resourceId: '7', readAt: null, createdAt: new Date().toISOString() }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/access/me/applications': { sellerApplications: [], environmentApplications: [] },
      '/access/notifications': { notifications: [notification] },
      '/access/platform': { applications: [], sellers: [], environments: [], administrators: [], auditLogs: [] },
      '/access/admin/accounts': { users: [], total: 0, page: 1, totalPages: 1 },
      '/payments/platform/overview': { accounts: [], summary: {} },
    })[url] || {} } }))
    api.patch.mockResolvedValue({ data: { data: {} } })
    render(createElement(App))
    await screen.findByRole('button', { name: 'Equipe Time Out' })
    await waitFor(() => expect(screen.getByRole('button', { name: /Abrir notificações/ })).toHaveTextContent('1'))
    fireEvent.click(screen.getByRole('button', { name: /Abrir notificações/ }))
    fireEvent.pointerDown(screen.getByText('Há uma solicitação para revisar.'))
    expect(screen.getByText('Há uma solicitação para revisar.')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Há uma solicitação para revisar.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Abrir notificações/ }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByText('Há uma solicitação para revisar.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Abrir notificações/ }))
    fireEvent.click(screen.getByRole('button', { name: /Nova solicitação/ }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/access/notifications/9/read'))
    expect(screen.getByRole('button', { name: 'Solicitações' })).toHaveAttribute('aria-current', 'page')
    expect(window.location.search).toContain('timeoutView=access')
  })
})

describe('Funções por ambiente', () => {
  test('mostra vendedor e administrador em ambientes distintos sem etiqueta Cliente redundante', async () => {
    const user = { id: 50, name: 'Equipe', role: 'platform_admin', environmentId: null, emailVerifiedAt: new Date().toISOString() }
    const account = { id: 7, name: 'Pessoa', email: 'pessoa@timeout.test', role: 'customer', memberships: [
      { id: 1, environmentId: 1, role: 'seller', status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } },
      { id: 2, environmentId: 2, role: 'environment_admin', status: 'approved', environment: { id: 2, name: 'Empresa', status: 'active' } },
    ] }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
      '/access/platform': { applications: [], sellers: [], environments: [], administrators: [], auditLogs: [] },
      '/access/admin/accounts': { users: [account], total: 1, page: 1, totalPages: 1 }, '/payments/platform/overview': { accounts: [], summary: {} },
    })[url] || {} } }))
    render(createElement(App))
    fireEvent.click(await screen.findByRole('button', { name: 'Contas' }))
    expect(await screen.findByText('Vendedor · Escola')).toBeInTheDocument()
    expect(screen.getByText('Administrador · Empresa')).toBeInTheDocument()
    expect(screen.queryByText('Cliente')).not.toBeInTheDocument()
  })
})
