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
    put: vi.fn(),
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

  test('preserva os dados preenchidos ao alternar abas e após erro no cadastro', async () => {
    api.post.mockRejectedValue({ response: { status: 409, data: { message: 'E-mail já cadastrado' } } })
    render(createElement(App))

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'pessoa@timeout.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastro' }))
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Pessoa Teste' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'SenhaForte#123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cadastro' }))

    expect(screen.getByLabelText('Nome completo')).toHaveValue('Pessoa Teste')
    expect(screen.getByLabelText('E-mail')).toHaveValue('pessoa@timeout.test')
    fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('E-mail já cadastrado'))
    expect(screen.getByLabelText('Nome completo')).toHaveValue('Pessoa Teste')
    expect(screen.getByLabelText('E-mail')).toHaveValue('pessoa@timeout.test')
    expect(screen.getByLabelText('Senha')).toHaveValue('SenhaForte#123')
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
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
  })

  test('tamanhos exclusivos e adicionais cumulativos formam combinações distintas no carrinho', async () => {
    const user = { id: 10, name: 'Cliente', role: 'customer', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ id: 1, environmentId: 1, role: 'customer', status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    const product = { id: 8, name: 'Açaí', price: 10, quantity: 10, imageUrl: '/acai.png', seller: { id: 20, name: 'Loja' }, sizeOptions: [
      { id: '11111111-1111-4111-8111-111111111111', name: '300 ml', price: 10, isActive: true },
      { id: '22222222-2222-4222-8222-222222222222', name: '500 ml', price: 15, imageUrl: '/500.png', isActive: true },
    ], addons: [
      { id: '33333333-3333-4333-8333-333333333333', name: 'Paçoca', price: 2, isActive: true },
      { id: '44444444-4444-4444-8444-444444444444', name: 'Leite em pó', price: 3, isActive: true },
    ] }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/products': { products: [product] }, '/categories': { categories: [] }, '/orders/my-orders': { orders: [] }, '/plans': { plans: [] },
      '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
      '/products/8': { product }, '/products/8/reviews': { reviews: [], averageRating: 0, reviewsCount: 0 },
    })[url] || {} } }))
    render(createElement(App))
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir detalhes de Açaí' }))
    const page = await screen.findByRole('region', { name: 'Detalhes de Açaí' })
    expect(screen.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /500 ml/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Paçoca/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Leite em pó/ }))
    expect(page).toHaveTextContent('R$ 20,00')
    expect(page.querySelector('.gallery-main img')).toHaveAttribute('src', '/500.png')
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }))
    fireEvent.click(screen.getByRole('button', { name: /300 ml/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Leite em pó/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }))
    fireEvent.click(screen.getByTitle('Abrir carrinho'))
    expect(await screen.findByRole('heading', { name: 'Carrinho' })).toBeInTheDocument()
    expect(document.querySelectorAll('.main-column .line-card')).toHaveLength(2)
    expect(screen.getByText('Tamanho: 500 ml - R$ 15,00')).toBeInTheDocument()
    expect(screen.getByText('Tamanho: 300 ml - R$ 10,00')).toBeInTheDocument()
    expect(screen.getAllByText('Paçoca: +R$ 2,00')).toHaveLength(2)
    api.post.mockResolvedValue({ data: { data: { order: { id: 30 }, payment: null } } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/orders', expect.objectContaining({ items: [
      expect.objectContaining({ productId: 8, selectedSizeId: product.sizeOptions[1].id, selectedAddonIds: [product.addons[0].id, product.addons[1].id] }),
      expect.objectContaining({ productId: 8, selectedSizeId: product.sizeOptions[0].id, selectedAddonIds: [product.addons[0].id] }),
    ] })))
  })

  test('foto e preço acompanham o sabor; galeria não muda a escolha e carrinho recebe a foto certa', async () => {
    const user = { id: 10, name: 'Cliente', role: 'customer', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ id: 1, environmentId: 1, role: 'customer', status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    const suco = { id: 1, name: 'Suco', imageUrl: '/suco.png', imageGallery: ['/extra.png'], flavors: [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Laranja', priceAdjustment: 0, imageUrl: '/laranja.png' },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Maracujá', priceAdjustment: 2, imageUrl: '/maracuja.png' },
      { id: '33333333-3333-4333-8333-333333333333', name: 'Uva', priceAdjustment: 1, imageUrl: null },
    ], price: 5, quantity: 5, seller: { id: 20, name: 'Loja' } }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/products': { products: [suco] }, '/categories': { categories: [] }, '/orders/my-orders': { orders: [] }, '/plans': { plans: [] },
      '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
      '/products/1': { product: suco }, '/products/1/reviews': { reviews: [], averageRating: 0, reviewsCount: 0 },
    })[url] || {} } }))
    render(createElement(App))
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir detalhes de Suco' }))
    const page = await screen.findByRole('region', { name: 'Detalhes de Suco' })
    const photo = () => page.querySelector('.gallery-main img')
    expect(photo()).toHaveAttribute('src', '/laranja.png')
    fireEvent.click(screen.getByRole('button', { name: /Maracujá/ }))
    expect(photo()).toHaveAttribute('src', '/maracuja.png')
    expect(photo()).toHaveAttribute('alt', 'Suco - Maracujá')
    expect(page).toHaveTextContent('R$ 7,00')
    fireEvent.click(page.querySelector('.gallery-thumb:nth-child(2)'))
    expect(photo()).toHaveAttribute('src', '/extra.png')
    expect(screen.getByRole('button', { name: /Maracujá/ })).toHaveClass('active')
    fireEvent.click(screen.getByRole('button', { name: /Uva/ }))
    expect(photo()).toHaveAttribute('src', '/suco.png')
    fireEvent.click(screen.getByRole('button', { name: /Laranja/ }))
    expect(photo()).toHaveAttribute('src', '/laranja.png')
    fireEvent.click(screen.getByRole('button', { name: /Maracujá/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }))
    fireEvent.click(screen.getByTitle('Abrir carrinho'))
    expect(await screen.findByRole('heading', { name: 'Carrinho' })).toBeInTheDocument()
    expect(document.querySelector('.cart-item-thumb img')).toHaveAttribute('src', '/maracuja.png')
    expect(screen.getByText(/Maracujá/)).toBeInTheDocument()
  })

  test('histórico usa a foto registrada para o sabor comprado', async () => {
    const user = { id: 10, name: 'Cliente', role: 'customer', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ id: 1, environmentId: 1, role: 'customer', status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    const order = { id: 12, status: 'delivered', totalPrice: 7, seller: { name: 'Loja', phone: '123' }, customer: user, paymentMethod: 'pix', paymentStatus: 'paid', items: [{ id: 1, product: { name: 'Suco', imageUrl: '/suco.png' }, selectedFlavor: 'Maracujá', imageUrl: '/maracuja.png', quantity: 1, unitPrice: 7, subtotal: 7 }] }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/products': { products: [] }, '/categories': { categories: [] }, '/orders/my-orders': { orders: [order] }, '/plans': { plans: [] },
      '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
    })[url] || {} } }))
    render(createElement(App))
    fireEvent.click(await screen.findByRole('button', { name: 'Histórico de compras' }))
    expect(await screen.findByRole('heading', { name: 'Pedido #12' })).toBeInTheDocument()
    expect(document.querySelector('.order-preview-image img')).toHaveAttribute('src', '/maracuja.png')
    expect(screen.getByText('1x Suco - Maracujá')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 7,00').length).toBeGreaterThan(0)
  })

  test('página do produto isola galeria e avaliações na sequência suco, coxinha, suco', async () => {
    const user = { id: 10, name: 'Cliente', role: 'customer', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ id: 1, environmentId: 1, role: 'customer', status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    const suco = { id: 1, name: 'Suco', imageUrl: '/suco.png', imageGallery: ['/suco-extra.png'], flavors: [{ name: 'Laranja', priceAdjustment: 0 }], price: 5, quantity: 5, seller: { id: 20, name: 'Loja' } }
    const coxinha = { id: 2, name: 'Coxinha', imageUrl: '/coxinha.png', imageGallery: ['/coxinha-extra.png'], flavors: [{ name: 'Frango', priceAdjustment: 0 }], price: 8, quantity: 5, seller: { id: 20, name: 'Loja' } }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/products': { products: [suco, coxinha] }, '/categories': { categories: [] }, '/orders/my-orders': { orders: [] }, '/plans': { plans: [] },
      '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
      '/products/1': { product: suco }, '/products/1/reviews': { reviews: [{ id: 1, comment: 'Comentário do suco' }], averageRating: 5, reviewsCount: 1 },
      '/products/2': { product: coxinha }, '/products/2/reviews': { reviews: [{ id: 2, comment: 'Comentário da coxinha' }], averageRating: 4, reviewsCount: 1 },
    })[url] || {} } }))

    render(createElement(App))
    await screen.findByRole('button', { name: 'Abrir detalhes de Suco' })
    for (const [name, id, image, option, comment, otherImage] of [
      ['Suco', 1, '/suco-extra.png', 'Laranja', 'Comentário do suco', '/coxinha-extra.png'],
      ['Coxinha', 2, '/coxinha-extra.png', 'Frango', 'Comentário da coxinha', '/suco-extra.png'],
      ['Suco', 1, '/suco-extra.png', 'Laranja', 'Comentário do suco', '/coxinha-extra.png'],
    ]) {
      fireEvent.click(screen.getByRole('button', { name: `Abrir detalhes de ${name}` }))
      const page = await screen.findByRole('region', { name: `Detalhes de ${name}` })
      expect(window.location.search).toContain(`produto=${id}`)
      expect(screen.queryByRole('dialog', { name: `Detalhes de ${name}` })).not.toBeInTheDocument()
      const thumbnails = page.querySelectorAll('.gallery-thumb')
      expect(thumbnails).toHaveLength(2)
      expect([...thumbnails].map((button) => button.querySelector('img').getAttribute('src'))).not.toContain(otherImage)
      fireEvent.click(thumbnails[1])
      expect(page.querySelector('.gallery-main img')).toHaveAttribute('src', image)
      expect(page).toHaveTextContent(option)
      expect(page).toHaveTextContent(comment)
      expect(page).not.toHaveTextContent(name === 'Suco' ? 'Comentário da coxinha' : 'Comentário do suco')
      fireEvent.click(screen.getByRole('navigation', { name: 'Navegação principal' }).getElementsByTagName('button')[0])
      await screen.findByRole('button', { name: `Abrir detalhes de ${name}` })
    }
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
    fireEvent.click(screen.getByRole('button', { name: 'Vitrine' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir detalhes de Coxinha' }))
    const page = await screen.findByRole('region', { name: 'Detalhes de Coxinha' })
    expect(page).toHaveTextContent('Frango')
    expect(page.querySelector('.modal-purchase-bar strong')).toHaveTextContent('R$ 10,00')
    expect(page.querySelector('.gallery-main img')).toHaveAttribute('src', '/coxinha.png')
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }))
    fireEvent.click(page.querySelector('.purchase-actions .ghost-button'))
    expect(screen.getByRole('button', { name: 'Carrinho (2)' })).toBeInTheDocument()
    resolveSuco({ data: { data: { product: suco } } })
    await waitFor(() => expect(screen.getByRole('region', { name: 'Detalhes de Coxinha' })).toBeInTheDocument())
    expect(screen.queryByRole('region', { name: 'Detalhes de Suco' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('navigation', { name: 'Navegação principal' }).getElementsByTagName('button')[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir detalhes de Suco' }))
    const sucoPage = await screen.findByRole('region', { name: 'Detalhes de Suco' })
    expect(sucoPage.querySelector('.gallery-main img')).toHaveAttribute('src', '/suco.png')
    expect(sucoPage).not.toHaveTextContent('Sabores e opções')
  })

  test('link direto abre o produto pelo ID e rejeita produto indisponível', async () => {
    const user = { id: 10, name: 'Cliente', role: 'customer', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ environmentId: 1, status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    const product = { id: 2, name: 'Coxinha', price: 8, quantity: 4, flavors: [], imageUrl: '/coxinha.png', seller: { id: 20, name: 'Loja' } }
    window.history.replaceState({}, '', '/?produto=2')
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => {
      if (url === '/products/999') throw new Error('Não encontrado')
      return { data: { data: ({
        '/auth/me': { user }, '/products': { products: [product] }, '/categories': { categories: [] }, '/orders/my-orders': { orders: [] }, '/plans': { plans: [] },
        '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
        '/products/2': { product }, '/products/2/reviews': { reviews: [], averageRating: 0, reviewsCount: 0 },
      })[url] || {} } }
    })
    render(createElement(App))
    const page = await screen.findByRole('region', { name: 'Detalhes de Coxinha' })
    expect(page.querySelector('.gallery-main img')).toHaveAttribute('src', '/coxinha.png')
    expect(screen.queryByRole('button', { name: 'Abrir detalhes de Coxinha' })).not.toBeInTheDocument()
    window.history.replaceState({}, '', '/?produto=999')
    fireEvent.popState(window, { state: {} })
    expect(await screen.findByText('Produto não encontrado ou indisponível neste ambiente.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voltar à Vitrine' })).toBeInTheDocument()
  })

  test('voltar do produto preserva a pesquisa da Vitrine', async () => {
    const user = { id: 10, name: 'Cliente', role: 'customer', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ environmentId: 1, status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    const product = { id: 1, name: 'Suco', price: 5, quantity: 2, flavors: [], seller: { id: 20, name: 'Loja' } }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/products': { products: [product] }, '/categories': { categories: [] }, '/orders/my-orders': { orders: [] }, '/plans': { plans: [] },
      '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
      '/products/1': { product }, '/products/1/reviews': { reviews: [], averageRating: 0, reviewsCount: 0 },
    })[url] || {} } }))
    render(createElement(App))
    fireEvent.click(await screen.findByRole('button', { name: 'Vitrine' }))
    fireEvent.change(screen.getByPlaceholderText('Buscar produto'), { target: { value: 'suco' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir detalhes de Suco' }))
    await screen.findByRole('region', { name: 'Detalhes de Suco' })
    window.history.replaceState({ marketScroll: 120 }, '', '/')
    fireEvent.popState(window, { state: { marketScroll: 120 } })
    expect(await screen.findByPlaceholderText('Buscar produto')).toHaveValue('suco')
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 120))
    expect(window.location.search).toBe('')
  })

  test('Comprar agora leva exatamente a variação e quantidade escolhidas ao carrinho', async () => {
    const user = { id: 10, name: 'Cliente', role: 'customer', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ environmentId: 1, status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    const product = { id: 3, name: 'Coxinha', price: 6.5, quantity: 3, flavors: [{ name: 'Tradicional', priceAdjustment: 0 }, { name: 'Especial', priceAdjustment: 2 }], seller: { id: 20, name: 'Loja' } }
    window.history.replaceState({}, '', '/?produto=3')
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/products': { products: [product] }, '/categories': { categories: [] }, '/orders/my-orders': { orders: [] }, '/plans': { plans: [] },
      '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
      '/products/3': { product }, '/products/3/reviews': { reviews: [], averageRating: 0, reviewsCount: 0 },
      '/payments/settings/sellers/20': { settings: {} },
    })[url] || {} } }))
    render(createElement(App))
    await screen.findByRole('region', { name: 'Detalhes de Coxinha' })
    fireEvent.click(screen.getByRole('button', { name: /Especial/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }))
    expect(screen.getByRole('region', { name: 'Detalhes de Coxinha' }).querySelector('.modal-purchase-bar strong')).toHaveTextContent('R$ 8,50')
    fireEvent.click(screen.getByRole('button', { name: 'Comprar agora' }))
    expect(window.location.search).toBe('')
    expect(screen.getByRole('heading', { name: 'Carrinho', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('R$ 8,50 cada - Especial')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 17,00').length).toBeGreaterThan(0)
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

describe('Galerias no cadastro do vendedor', () => {
  test('novo produto configura tamanho e adicional numa página e mantém o rascunho até salvar', async () => {
    localStorage.clear()
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
    const user = { id: 20, name: 'Vendedor', role: 'seller', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ id: 1, environmentId: 1, role: 'seller', status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/products': { products: [] }, '/categories': { categories: [{ id: 1, name: 'Doces' }] }, '/orders/my-orders': { orders: [] }, '/orders/seller-orders': { orders: [] }, '/plans': { plans: [] },
      '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
    })[url] || {} } }))
    api.post.mockResolvedValue({ data: { data: {} } })
    render(createElement(App))
    fireEvent.click(await screen.findByRole('button', { name: 'Meus produtos' }))
    fireEvent.change(screen.getByPlaceholderText('Coxinha'), { target: { value: 'Açaí' } })
    fireEvent.change(screen.getByLabelText('Preço base'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Estoque'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Configurar opções e adicionais' }))
    expect(screen.queryByRole('button', { name: 'Salvar produto' })).not.toBeInTheDocument()
    const groups = document.querySelectorAll('.option-editor')
    fireEvent.click(groups[1].querySelector('button.ghost-button'))
    fireEvent.click(groups[2].querySelector('button.ghost-button'))
    const sizeInputs = groups[1].querySelectorAll('.option-row input')
    fireEvent.change(sizeInputs[0], { target: { value: '500 ml' } })
    fireEvent.change(sizeInputs[1], { target: { value: 'Porção média' } })
    fireEvent.change(sizeInputs[2], { target: { value: '15' } })
    const addonInputs = groups[2].querySelectorAll('.option-row input')
    fireEvent.change(addonInputs[0], { target: { value: 'Paçoca' } })
    fireEvent.change(addonInputs[2], { target: { value: '2' } })
    fireEvent.click(document.querySelector('.option-preview input[type="checkbox"]'))
    expect(screen.getByText('R$ 17,00 por unidade')).toBeInTheDocument()
    const confirmDiscard = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao produto' }))
    expect(screen.getByRole('heading', { name: 'Opções e adicionais' })).toBeInTheDocument()
    confirmDiscard.mockRestore()
    fireEvent.click(screen.getByRole('button', { name: 'Concluir configuração' }))
    expect(screen.getByText(/1 tamanhos · 1 adicionais/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar produto' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/products', expect.any(FormData)))
    const payload = api.post.mock.calls.find(([path]) => path === '/products')[1]
    expect(JSON.parse(payload.get('sizeOptions'))).toMatchObject([{ name: '500 ml', description: 'Porção média', price: 15 }])
    expect(JSON.parse(payload.get('addons'))).toMatchObject([{ name: 'Paçoca', price: 2 }])
  })

  test('vendedor ordena, pausa e salva tamanhos e adicionais sem alterar sabores', async () => {
    localStorage.clear()
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
    const user = { id: 20, name: 'Vendedor', role: 'seller', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ id: 1, environmentId: 1, role: 'seller', status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    const product = { id: 8, name: 'Açaí', description: '', seller: { id: 20, name: 'Vendedor' }, flavors: [{ id: '99999999-9999-4999-8999-999999999999', name: 'Tradicional', priceAdjustment: 0 }], price: 10, quantity: 9, categoryId: 1, isActive: true,
      sizeOptions: [{ id: '11111111-1111-4111-8111-111111111111', name: '300 ml', price: 10, isActive: true }, { id: '22222222-2222-4222-8222-222222222222', name: '500 ml', price: 15, isActive: true }],
      addons: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Paçoca', price: 2, isActive: true }],
    }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/products': { products: [product] }, '/categories': { categories: [{ id: 1, name: 'Doces' }] }, '/orders/my-orders': { orders: [] }, '/orders/seller-orders': { orders: [] }, '/plans': { plans: [] },
      '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
    })[url] || {} } }))
    api.put.mockResolvedValue({ data: { data: {} } })
    render(createElement(App))
    fireEvent.click(await screen.findByRole('button', { name: 'Meus produtos' }))
    fireEvent.click(await screen.findByTitle('Editar produto'))
    fireEvent.click(screen.getByRole('button', { name: 'Configurar opções e adicionais' }))
    expect(screen.getByRole('heading', { name: 'Opções e adicionais' })).toBeInTheDocument()
    expect(screen.getByText('R$ 10,00 por unidade')).toBeInTheDocument()
    const preview = document.querySelector('.option-preview')
    fireEvent.click([...preview.querySelectorAll('button')].find((button) => button.textContent.includes('500 ml')))
    fireEvent.click(preview.querySelector('input[type="checkbox"]'))
    expect(screen.getByText('R$ 17,00 por unidade')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Subir 500 ml' }))
    const sizeRows = [...document.querySelectorAll('.option-editor')].find((section) => section.textContent.includes('Tamanhos ou porções')).querySelectorAll('.option-row')
    expect(sizeRows[0].querySelector('input').value).toBe('500 ml')
    fireEvent.change(sizeRows[0].querySelectorAll('input')[1], { target: { value: 'Porção média' } })
    fireEvent.click(sizeRows[0].querySelector('input[type="checkbox"]'))
    fireEvent.click(screen.getByRole('button', { name: 'Concluir configuração' }))
    expect(screen.getByText(/2 tamanhos · 1 adicionais/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const payload = api.put.mock.calls[0][1]
    expect(JSON.parse(payload.get('sizeOptions'))).toMatchObject([{ name: '500 ml', description: 'Porção média', price: 15, isActive: false }, { name: '300 ml', price: 10, isActive: true }])
    expect(JSON.parse(payload.get('addons'))).toMatchObject([{ name: 'Paçoca', price: 2, isActive: true }])
    expect(JSON.parse(payload.get('flavors'))).toMatchObject([{ name: 'Tradicional' }])
  })
  test('edição envia cada foto vinculada ao ID da própria opção e permite remoção', async () => {
    localStorage.clear()
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
    const user = { id: 20, name: 'Vendedor', role: 'seller', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ id: 1, environmentId: 1, role: 'seller', status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    const flavors = [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Laranja', priceAdjustment: 0, imageUrl: '/laranja.png' },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Maracujá', priceAdjustment: 2, imageUrl: '/maracuja.png' },
    ]
    const product = { id: 1, name: 'Suco', description: 'Bebida', seller: { id: 20, name: 'Vendedor' }, imageUrl: '/suco.png', imageGallery: [], flavors, addons: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Gelo', price: 1, imageUrl: '/gelo.png' }], price: 5, quantity: 5, categoryId: 1, isActive: true }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/products': { products: [product] }, '/categories': { categories: [{ id: 1, name: 'Bebidas' }] }, '/orders/my-orders': { orders: [] }, '/orders/seller-orders': { orders: [] }, '/plans': { plans: [] },
      '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
    })[url] || {} } }))
    api.put.mockResolvedValue({ data: { data: {} } })
    URL.createObjectURL = vi.fn(() => 'blob:foto')
    URL.revokeObjectURL = vi.fn()
    render(createElement(App))
    fireEvent.click(await screen.findByRole('button', { name: 'Meus produtos' }))
    fireEvent.click(await screen.findByTitle('Editar produto'))
    fireEvent.click(screen.getByRole('button', { name: 'Configurar opções e adicionais' }))
    const controls = document.querySelectorAll('.flavor-image-control')
    expect(controls).toHaveLength(3)
    fireEvent.click(controls[0].querySelector('.flavor-image-remove'))
    const photo = new File(['foto'], 'maracuja-nova.jpg', { type: 'image/jpeg' })
    fireEvent.change(controls[1].querySelector('input[type="file"]'), { target: { files: [photo] } })
    const addonPhoto = new File(['foto'], 'gelo-novo.jpg', { type: 'image/jpeg' })
    fireEvent.change(controls[2].querySelector('input[type="file"]'), { target: { files: [addonPhoto] } })
    fireEvent.click(screen.getByRole('button', { name: 'Concluir configuração' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [url, data] = api.put.mock.calls[0]
    expect(url).toBe('/products/1')
    expect(data.get('flavorImageIds')).toBe('["22222222-2222-4222-8222-222222222222"]')
    expect(data.getAll('flavorImages')).toEqual([photo])
    expect(data.get('addonImageIds')).toBe('["33333333-3333-4333-8333-333333333333"]')
    expect(data.getAll('addonImages')).toEqual([addonPhoto])
    const savedFlavors = JSON.parse(data.get('flavors'))
    expect(savedFlavors[0]).toMatchObject({ id: flavors[0].id, name: 'Laranja', removeImage: true })
    expect(savedFlavors[1]).toMatchObject({ id: flavors[1].id, name: 'Maracujá', priceAdjustment: 2 })
  })

  test('edição troca a galeria por produto e novo cadastro começa sem fotos anteriores', async () => {
    localStorage.clear()
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
    const user = { id: 20, name: 'Vendedor', role: 'seller', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ id: 1, environmentId: 1, role: 'seller', status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    const products = [
      { id: 1, name: 'Suco', description: 'Bebida', seller: { id: 20, name: 'Vendedor' }, imageUrl: '/suco.png', imageGallery: ['/suco-extra.png'], price: 5, quantity: 5, categoryId: 1, isActive: true },
      { id: 2, name: 'Coxinha', description: 'Salgado', seller: { id: 20, name: 'Vendedor' }, imageUrl: '/coxinha.png', imageGallery: ['/coxinha-extra.png'], price: 8, quantity: 5, categoryId: 1, isActive: true },
    ]
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/products': { products }, '/categories': { categories: [{ id: 1, name: 'Lanches' }] }, '/orders/my-orders': { orders: [] }, '/orders/seller-orders': { orders: [] }, '/plans': { plans: [] },
      '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
    })[url] || {} } }))
    api.put.mockResolvedValue({ data: { data: {} } })
    api.post.mockResolvedValue({ data: { data: {} } })

    render(createElement(App))
    fireEvent.click(await screen.findByRole('button', { name: 'Meus produtos' }))
    await screen.findAllByTitle('Editar produto')
    const gallery = screen.getByLabelText('Fotos extras do detalhe')
    const edit = (name) => fireEvent.click(screen.getByRole('heading', { name, level: 3 }).closest('article').querySelector('[title="Editar produto"]'))
    edit('Suco')
    expect(gallery).toHaveValue('["/suco-extra.png"]')
    edit('Coxinha')
    expect(gallery).toHaveValue('["/coxinha-extra.png"]')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [url, editedForm] = api.put.mock.calls[0]
    expect(url).toBe('/products/2')
    expect(editedForm.get('imageGallery')).toBe('["/coxinha-extra.png"]')
    expect(editedForm.getAll('images')).toHaveLength(0)

    await waitFor(() => expect(gallery).toHaveValue(''))
    fireEvent.change(screen.getByPlaceholderText('Coxinha'), { target: { value: 'Bolo novo' } })
    fireEvent.change(gallery, { target: { value: '/bolo-extra.png' } })
    fireEvent.change(screen.getByLabelText('Preço base'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('Estoque'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar produto' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/products', expect.any(FormData)))
    const createdForm = api.post.mock.calls.find(([path]) => path === '/products')[1]
    expect(createdForm.get('imageGallery')).toBe('/bolo-extra.png')
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

describe('Catálogo paginado', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
  })

  test('buscar produtos não recarrega pedidos, planos e notificações', async () => {
    const user = { id: 10, name: 'Cliente', role: 'customer', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ environmentId: 1, status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url) => ({ data: { data: ({
      '/auth/me': { user }, '/products': { products: [], total: 0, totalPages: 0 }, '/categories': { categories: [] },
      '/orders/my-orders': { orders: [] }, '/plans': { plans: [] },
      '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] },
    })[url] || {} } }))
    render(createElement(App))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/orders/my-orders'))
    const ordersBefore = api.get.mock.calls.filter(([url]) => url === '/orders/my-orders').length
    const plansBefore = api.get.mock.calls.filter(([url]) => url === '/plans').length
    const notificationsBefore = api.get.mock.calls.filter(([url]) => url === '/access/notifications').length
    const requestsBefore = api.get.mock.calls.length

    fireEvent.change(screen.getByPlaceholderText('Buscar produto'), { target: { value: 'suco' } })
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/products', { params: { page: 1, limit: 10, search: 'suco' } }))
    fireEvent.change(screen.getByPlaceholderText('Buscar produto'), { target: { value: 'suco' } })
    expect(api.get.mock.calls).toHaveLength(requestsBefore + 1)
    expect(api.get.mock.calls.filter(([url]) => url === '/orders/my-orders')).toHaveLength(ordersBefore)
    expect(api.get.mock.calls.filter(([url]) => url === '/plans')).toHaveLength(plansBefore)
    expect(api.get.mock.calls.filter(([url]) => url === '/access/notifications')).toHaveLength(notificationsBefore)
  })

  test('permite acessar produtos depois da primeira página', async () => {
    const user = { id: 10, name: 'Cliente', role: 'customer', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ environmentId: 1, status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    const first = { id: 1, name: 'Suco', price: 5, quantity: 2, seller: { id: 20, name: 'Loja' } }
    const second = { id: 2, name: 'Coxinha', price: 8, quantity: 2, seller: { id: 20, name: 'Loja' } }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url, config) => ({ data: { data: url === '/products'
      ? { products: config?.params?.page === 2 ? [second] : [first], total: 2, totalPages: 2 }
      : ({ '/auth/me': { user }, '/categories': { categories: [] }, '/orders/my-orders': { orders: [] }, '/plans': { plans: [] }, '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] } })[url] || {} } }))
    render(createElement(App))
    expect(await screen.findByRole('button', { name: 'Abrir detalhes de Suco' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver mais produtos (1 de 2)' }))
    expect(await screen.findByRole('button', { name: 'Abrir detalhes de Coxinha' })).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/products', { params: { page: 2, limit: 10 } })
  })

  test('pesquisa da Vitrine não esconde produtos do vendedor', async () => {
    const user = { id: 7, name: 'Vendedor', role: 'seller', environmentId: 1, emailVerifiedAt: new Date().toISOString(), memberships: [{ environmentId: 1, status: 'approved', environment: { id: 1, name: 'Escola', status: 'active' } }] }
    const suco = { id: 1, name: 'Suco', price: 5, quantity: 2, seller: { id: 20, name: 'Loja' } }
    const sushi = { id: 2, name: 'Sushi', price: 20, quantity: 5, isActive: true, seller: { id: 7, name: 'Vendedor' } }
    localStorage.getItem.mockImplementation((key) => key.includes('session') ? JSON.stringify({ token: 'teste', user }) : null)
    api.get.mockImplementation(async (url, config) => ({ data: { data: url === '/products'
      ? { products: config?.params?.sellerId === 7 ? [sushi] : [suco], total: 1, totalPages: 1 }
      : ({ '/auth/me': { user }, '/categories': { categories: [] }, '/orders/my-orders': { orders: [] }, '/orders/seller-orders': { orders: [] }, '/coupons': { coupons: [] }, '/payments/settings': { settings: {} }, '/payments/payout-account': { summary: {}, transactions: [] }, '/plans': { plans: [] }, '/access/me/applications': { sellerApplications: [], environmentApplications: [] }, '/access/notifications': { notifications: [] } })[url] || {} } }))
    render(createElement(App))
    fireEvent.click(await screen.findByRole('button', { name: 'Vitrine' }))
    await screen.findByRole('button', { name: 'Abrir detalhes de Suco' })
    fireEvent.change(screen.getByPlaceholderText('Buscar produto'), { target: { value: 'Suco' } })
    fireEvent.click(screen.getByRole('button', { name: 'Meus produtos' }))
    expect(await screen.findByRole('heading', { name: 'Sushi' })).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/products', { params: { page: 1, limit: 10, sellerId: 7 } })
  })
})
