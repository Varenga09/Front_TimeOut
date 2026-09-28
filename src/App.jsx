import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck,
  Ban,
  Bell,
  Building2,
  Camera,
  Check,
  ChefHat,
  ClipboardList,
  CircleDollarSign,
  Copy,
  Crown,
  FileText,
  CreditCard,
  Download,
  ExternalLink,
  BarChart3,
  Eye,
  EyeOff,
  History,
  ImagePlus,
  IdCard,
  LogOut,
  MailCheck,
  MapPin,
  Menu,
  Package,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  Tags,
  Percent,
  Trash2,
  UserCheck,
  UserCog,
  UserRound,
  UsersRound,
  Wallet,
  X,
  Mail,
  KeyRound,
  Lock,
  Hash,
  ArrowRight,
} from 'lucide-react'
import { api, getAssetUrl, getErrorMessage, setAuthToken } from './api'
import './App.css'

const SESSION_KEY = '@localfood:web:session'
const SEARCH_HISTORY_KEY = '@localfood:web:recent-searches'
const CART_KEY = '@localfood:web:cart'
const CLEAR_SESSION_PARAMS = ['clearSession', 'logoutAll']
const APP_NAVIGATION_EVENT = 'localfood:navigate'

function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('auth_token')
  localStorage.removeItem('csrf_token')
  sessionStorage.clear()
}

function shouldClearSessionFromUrl() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return CLEAR_SESSION_PARAMS.some((param) => params.has(param))
}

function cleanSessionUrl() {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  CLEAR_SESSION_PARAMS.forEach((param) => url.searchParams.delete(param))
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const statusLabels = {
  pending: 'Pendente',
  accepted: 'Aceito',
  preparing: 'Preparando',
  ready: 'Pronto',
  delivered: 'Entregue',
  canceled: 'Cancelado',
  refused: 'Recusado',
}

const paymentLabels = {
  cash: 'Dinheiro',
  pix: 'Pix',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  card_in_person: 'Cartão presencial',
  arrange_with_seller: 'Combinar',
}

const paymentStatusLabels = {
  not_required: 'Pagamento combinado',
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pagamento aprovado',
  failed: 'Pagamento recusado',
  refunded: 'Pagamento estornado',
}

const onlinePaymentMethods = ['pix', 'credit_card', 'debit_card']

const paymentMethodSettingFields = {
  pix: 'acceptsPix',
  credit_card: 'acceptsCreditCard',
  debit_card: 'acceptsDebitCard',
  cash: 'acceptsCash',
  card_in_person: 'acceptsCardInPerson',
  arrange_with_seller: 'acceptsArrangeWithSeller',
}

const defaultPaymentSettings = {
  provider: 'mercado_pago',
  providerAccountId: '',
  acceptsPix: true,
  acceptsCreditCard: false,
  acceptsDebitCard: false,
  acceptsCash: true,
  acceptsCardInPerson: true,
  acceptsArrangeWithSeller: true,
  isActive: true,
}

const deliveryLabels = {
  pickup: 'Retirar com vendedor',
  internal_delivery: 'Entrega interna',
  meeting_point: 'Ponto de encontro',
}

const verificationChannelLabels = {
  email: 'E-mail',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
}

const environmentTypeLabels = {
  school: 'Escola',
  company: 'Empresa',
  factory: 'Fábrica',
  college: 'Faculdade',
  office: 'Escritório',
  other: 'Outro',
}

const sellerStatusOptions = ['accepted', 'preparing', 'ready', 'delivered', 'refused']

function checkPasswordStrength(password) {
  if (!password) return { score: 0, feedback: [] }
  
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  }
  
  const score = Object.values(checks).filter(Boolean).length
  
  const feedback = []
  if (!checks.length) feedback.push('Mínimo 8 caracteres')
  if (!checks.uppercase) feedback.push('1 letra maiúscula')
  if (!checks.lowercase) feedback.push('1 letra minúscula')
  if (!checks.numbers) feedback.push('1 número')
  if (!checks.special) feedback.push('1 caractere especial')
  
  return { score, feedback }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function isValidPhone(phone) {
  const cleaned = String(phone || '').replace(/\D/g, '')
  const localNumber = cleaned.startsWith('55') && cleaned.length > 11
    ? cleaned.slice(2)
    : cleaned

  if (![10, 11].includes(localNumber.length)) return false

  const ddd = Number(localNumber.slice(0, 2))
  if (ddd < 11 || ddd > 99) return false

  return !/^(\d)\1+$/.test(localNumber)
}

function formatPhone(phone) {
  if (!phone) return ''
  const cleaned = String(phone).replace(/\D/g, '')
  const localNumber = cleaned.startsWith('55') && cleaned.length > 11
    ? cleaned.slice(2)
    : cleaned

  if (localNumber.length === 11) {
    return `(${localNumber.slice(0, 2)}) ${localNumber.slice(2, 7)}-${localNumber.slice(7)}`
  }

  if (localNumber.length === 10) {
    return `(${localNumber.slice(0, 2)}) ${localNumber.slice(2, 6)}-${localNumber.slice(6)}`
  }

  return phone
}

function parseProductFlavors(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeProductOption).filter(Boolean)
  }

  if (typeof value !== 'string') return []

  const trimmed = value.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeProductOption).filter(Boolean)
    }
  } catch {
    return trimmed.split(/[\n,;]+/).map(normalizeProductOption).filter(Boolean)
  }

  return []
}

function normalizeProductOption(item) {
  if (typeof item === 'string') {
    const name = item.trim()
    return name ? { name, priceAdjustment: 0 } : null
  }

  if (!item || typeof item !== 'object') return null

  const name = String(item.name || item.label || item.flavor || '').trim()
  if (!name) return null

  return {
    name,
    priceAdjustment: parseMoneyValue(item.priceAdjustment ?? item.priceDelta ?? item.additionalPrice ?? 0),
  }
}

function parseMoneyValue(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : 0
  }

  const rawValue = String(value || '')
    .trim()
    .replace(/\s/g, '')

  const normalized = rawValue.includes(',')
    ? rawValue.replace(/\./g, '').replace(',', '.')
    : rawValue

  const number = Number(normalized)
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0
}

function getOptionOriginalPrice(product, option = null) {
  return Number((Number(product.price || 0) + Number(option?.priceAdjustment || 0)).toFixed(2))
}

function getProductDiscount(product) {
  const type = product.discountType
  const value = Number(product.discountValue || 0)

  if (!type || value <= 0) return null

  const now = new Date()
  if (product.discountStartsAt && new Date(product.discountStartsAt) > now) return null
  if (product.discountEndsAt && new Date(product.discountEndsAt) < now) return null

  return { type, value }
}

function applyProductDiscount(product, price) {
  const discount = getProductDiscount(product)
  if (!discount) return price

  const discountAmount = discount.type === 'percentage'
    ? price * (discount.value / 100)
    : discount.value

  return Number(Math.max(0.01, price - discountAmount).toFixed(2))
}

function getOptionPrice(product, option = null) {
  return applyProductDiscount(product, getOptionOriginalPrice(product, option))
}

function getCartUnitPrice(item) {
  return Number(item.cartUnitPrice ?? item.unitPrice ?? item.price ?? 0)
}

function getCartItemsCount(cart) {
  return cart.reduce((sum, item) => sum + Number(item.cartQuantity || 0), 0)
}

function readStoredCart(storageKey) {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey))
    if (!Array.isArray(stored)) return []

    return stored.filter((item) =>
      item && item.id && item.seller?.id && Number(item.cartQuantity) > 0
    )
  } catch {
    return []
  }
}

function getOrderPlatformFee(order) {
  return Number(order.commissionAmount ?? order.platformFeeAmount ?? 0)
}

function getOrderSellerNet(order) {
  return Number(order.sellerNetRevenue ?? order.sellerNetAmount ?? 0)
}

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

function getAvailablePaymentMethods(settings = defaultPaymentSettings) {
  return Object.keys(paymentLabels).filter((method) => {
    const field = paymentMethodSettingFields[method]
    return !field || settings[field]
  })
}

function formatPriceAdjustment(value) {
  const adjustment = Number(value || 0)

  if (adjustment === 0) return 'Sem acréscimo'

  const prefix = adjustment > 0 ? '+' : '-'
  return `${prefix} ${money.format(Math.abs(adjustment))}`
}

function formatDiscount(product) {
  const discount = getProductDiscount(product)
  if (!discount) return ''

  return discount.type === 'percentage'
    ? `${discount.value}% OFF`
    : `${money.format(discount.value)} OFF`
}

function toDateTimeInput(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60000)
  return localDate.toISOString().slice(0, 16)
}

function parseProductGallery(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (typeof value !== 'string') return []

  const trimmed = value.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean)
    }
  } catch {
    return trimmed.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean)
  }

  return []
}

function getProductImages(product) {
  const images = [product.imageUrl, ...parseProductGallery(product.imageGallery)]
    .map((image) => getAssetUrl(image))
    .filter(Boolean)

  return Array.from(new Set(images))
}

function formatRating(value) {
  const rating = Number(value || 0)
  return rating > 0 ? rating.toFixed(1).replace('.', ',') : '0,0'
}

function toFormData(data, fileField, file) {
  const formData = new FormData()

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(
        key,
        typeof value === 'object' ? JSON.stringify(value) : value,
      )
    }
  })

  if (file) {
    formData.append(fileField, file)
  }

  return formData
}

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function App() {
  const [session, setSession] = useState(() => {
    if (shouldClearSessionFromUrl()) {
      clearStoredSession()
      cleanSessionUrl()
      return null
    }

    const stored = localStorage.getItem(SESSION_KEY)
    if (!stored) return null

    try {
      const parsed = JSON.parse(stored)
      setAuthToken(parsed.token)
      return parsed
    } catch {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
  })
  const [notice, setNotice] = useState('')
  const noticeTimerRef = useRef(null)

  const showNotice = useCallback((message) => {
    setNotice(message)
    window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 7000)
  }, [])

  useEffect(() => {
    return () => window.clearTimeout(noticeTimerRef.current)
  }, [])

  const handleSession = useCallback((nextSession) => {
    setSession(nextSession)
    setAuthToken(nextSession?.token)

    if (nextSession) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession))
    } else {
      localStorage.removeItem(SESSION_KEY)
    }
  }, [])

  useEffect(() => {
    if (!session?.token) return undefined

    let active = true

    api.get('/auth/me')
      .then((response) => {
        if (!active) return
        setSession((current) => {
          if (!current) return current
          const nextSession = { ...current, user: response.data.data.user }
          localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession))
          return nextSession
        })
      })
      .catch(() => {
        if (active) handleSession(null)
      })

    return () => {
      active = false
    }
  }, [handleSession, session?.token])

  const logout = () => {
    handleSession(null)
  }

  const updateSessionUser = (user) => {
    handleSession({ ...session, user })
  }

  if (!session) {
    return <LoginScreen onSession={handleSession} onNotice={showNotice} notice={notice} />
  }

  if (!session.user.emailVerifiedAt && !session.user.phoneVerifiedAt) {
    return (
      <VerifyEmailScreen
        session={session}
        onSession={handleSession}
        onVerified={updateSessionUser}
        onLogout={logout}
        onNotice={showNotice}
        notice={notice}
      />
    )
  }

  if (session.user.requiresTwoFactorAuth) {
    return (
      <TwoFactorAuthScreen
        session={session}
        onSession={handleSession}
        onNotice={showNotice}
        notice={notice}
      />
    )
  }

  return (
    <Dashboard
      session={session}
      notice={notice}
      onLogout={logout}
      onNotice={showNotice}
      onSessionUser={updateSessionUser}
    />
  )
}

function Logo({ className = '' }) {
  return (
    <div className={`logo-container ${className}`} aria-label="TIMEOUT">
      <svg viewBox="0 0 552 155" className="logo-svg" xmlns="http://www.w3.org/2000/svg" role="img">
        <defs>
          <radialGradient id="timeout-stopwatch-glow" cx="50%" cy="48%" r="58%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="58%" stopColor="currentColor" stopOpacity="0.12" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>

        <text className="logo-word" x="8" y="121">TIME</text>

        <g className="logo-stopwatch" transform="translate(263 7)">
          <circle className="logo-stopwatch-glow" cx="58" cy="76" r="52" />
          <circle cx="58" cy="76" r="49" stroke="currentColor" strokeWidth="7" fill="none" />
          <circle cx="58" cy="76" r="38" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.95" />
          <rect x="41" y="5" width="34" height="13" rx="4" fill="none" stroke="currentColor" strokeWidth="6" />
          <line x1="58" y1="18" x2="58" y2="29" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          <path d="M95 27l11 11" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          <circle cx="58" cy="76" r="5.8" fill="currentColor" />
          <line x1="58" y1="76" x2="89" y2="45" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          <line x1="58" y1="32" x2="58" y2="41" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
          <line x1="58" y1="111" x2="58" y2="121" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
        </g>

        <text className="logo-word" x="392" y="121">UT</text>
      </svg>
    </div>
  )
}

function LoginScreen({ onSession, onNotice, notice }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    environmentAccessCode: '',
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: [] })
  const [formErrors, setFormErrors] = useState({})
  const [recoveryCode, setRecoveryCode] = useState('')
  const [recoveryRequested, setRecoveryRequested] = useState(false)

  const validateForm = () => {
    const errors = {}
    
    if (!form.email) {
      errors.email = 'E-mail é obrigatório'
    } else if (!isValidEmail(form.email)) {
      errors.email = 'E-mail inválido'
    }
    
    if (mode === 'forgot' && !recoveryRequested) {
      setFormErrors(errors)
      return Object.keys(errors).length === 0
    }

    if (!form.password) {
      errors.password = 'Senha é obrigatória'
    } else if (['register', 'forgot'].includes(mode) && passwordStrength.feedback.length > 0) {
      errors.password = 'A senha ainda não cumpre todos os requisitos'
    }

    if (mode === 'forgot' && !/^\d{6}$/.test(recoveryCode.trim())) {
      errors.recoveryCode = 'Informe o código de 6 dígitos'
    }
    
    if (mode === 'register' && !form.name) {
      errors.name = 'Nome é obrigatório'
    }
    
    if (mode === 'register' && !form.environmentAccessCode) {
      errors.environmentAccessCode = 'Código do ambiente é obrigatório'
    }
    
    if (mode === 'register' && form.phone && !isValidPhone(form.phone)) {
      errors.phone = 'Telefone inválido'
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handlePasswordChange = (value) => {
    setForm({ ...form, password: value })
    const strength = checkPasswordStrength(value)
    setPasswordStrength(strength)
  }

  const getStrengthColor = (score) => {
    if (score === 0) return '#ef4444'
    if (score <= 2) return '#f59e0b'
    if (score === 3) return '#3b82f6'
    return '#10b981'
  }

  const getStrengthLabel = (score) => {
    if (score === 0) return 'Muito fraca'
    if (score <= 2) return 'Fraca'
    if (score === 3) return 'Média'
    return 'Forte'
  }

  async function submit(event) {
    event.preventDefault()
    
    if (!validateForm()) {
      onNotice('Por favor, corrija os erros no formulário')
      return
    }
    
    setLoading(true)
    
    try {
      if (mode === 'forgot') {
        if (!recoveryRequested) {
          const response = await api.post('/auth/password/forgot', { email: form.email })
          setRecoveryRequested(true)
          onNotice(response.data.data.developmentCode
            ? `Modo de teste: use o código ${response.data.data.developmentCode}.`
            : 'Se o e-mail estiver cadastrado, o código será enviado em instantes.')
          return
        }

        await api.post('/auth/password/reset', {
          email: form.email,
          code: recoveryCode.trim(),
          password: form.password,
        })
        setMode('login')
        setRecoveryRequested(false)
        setRecoveryCode('')
        setForm((current) => ({ ...current, password: '' }))
        setPasswordStrength({ score: 0, feedback: [] })
        onNotice('Senha alterada com sucesso. Entre com a nova senha.')
        return
      }

      if (mode === 'register') {
        await api.post('/auth/register', {
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone ? formatPhone(form.phone) : undefined,
          environmentAccessCode: form.environmentAccessCode,
        })
        onNotice('Cadastro realizado com sucesso! Faça login para continuar.')
        setMode('login')
        setFormErrors({})
        setForm((prev) => ({
          ...prev,
          password: '',
        }))
        return
      }

      const response = await api.post('/auth/login', {
        email: form.email,
        password: form.password,
      })
      onSession(response.data.data)
      onNotice(
        response.data.data.user.emailVerifiedAt || response.data.data.user.phoneVerifiedAt
          ? 'Login realizado com sucesso'
          : 'Confirme sua conta para continuar'
      )
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      onNotice(errorMessage)

      if (mode === 'register' && error.response?.status === 409) {
        setFormErrors((current) => ({ ...current, email: errorMessage }))
      }
      
      if (error.response?.status === 429) {
        onNotice('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-header">
          <Logo />
          <p className="eyebrow-accent">PEDIDOS LOCAIS PARA AMBIENTES FECHADOS</p>
        </div>

        <div className="auth-illustration-container">
          <div className="mock-feed">
            <div className="mock-feed-header">
              <span className="mock-feed-dot"></span>
              <span className="mock-feed-title">Pedidos em tempo real</span>
            </div>
            <div className="mock-feed-list">
              <div className="mock-feed-card animated-card-1">
                <div className="mock-avatar avatar-m">M</div>
                <div className="mock-card-content">
                  <div className="mock-card-top">
                    <strong>Mateus (Térreo)</strong>
                    <span className="mock-time">Agora mesmo</span>
                  </div>
                  <span className="mock-desc">pediu Coxinha de Frango + Coca Lata</span>
                </div>
                <div className="mock-status preparing">Preparando 🍳</div>
              </div>
              <div className="mock-feed-card animated-card-2">
                <div className="mock-avatar avatar-a">A</div>
                <div className="mock-card-content">
                  <div className="mock-card-top">
                    <strong>Ana Flávia (3º andar)</strong>
                    <span className="mock-time">Há 4 min</span>
                  </div>
                  <span className="mock-desc">pediu Salada de Frutas Especial</span>
                </div>
                <div className="mock-status ready">Pronto 🎒</div>
              </div>
              <div className="mock-feed-card animated-card-3">
                <div className="mock-avatar avatar-l">L</div>
                <div className="mock-card-content">
                  <div className="mock-card-top">
                    <strong>Lucas Silva (Sala 4)</strong>
                    <span className="mock-time">Há 12 min</span>
                  </div>
                  <span className="mock-desc">pediu Café Espresso Duplo</span>
                </div>
                <div className="mock-status delivered">Entregue ✔</div>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-copy">
          <h2>Venda e compre no mesmo ambiente, sem bagunça.</h2>
          <p>
            Uma plataforma de pedidos moderna e segura, com proteção de acesso feita sob medida para condomínios, escolas e escritórios.
          </p>
        </div>
      </section>

      <form className="auth-form" onSubmit={submit}>
        <div className="form-card">
          <div className="form-heading">
            <h2>{mode === 'login' ? 'Boas-vindas!' : mode === 'register' ? 'Criar conta' : 'Recuperar senha'}</h2>
            <p>
              {mode === 'login'
                ? 'Informe seu e-mail e senha para acessar o TimeOut.'
                : mode === 'register'
                  ? 'Crie sua conta gratuitamente para começar a fazer pedidos.'
                  : recoveryRequested
                    ? 'Informe o código recebido e escolha uma nova senha.'
                    : 'Informe seu e-mail para receber um código de recuperação.'}
            </p>
          </div>

          {mode !== 'forgot' ? <div className="mode-toggle">
            <button
              className={mode === 'login' ? 'active' : ''}
              type="button"
              onClick={() => {
                setMode('login')
                setFormErrors({})
              }}
            >
              Login
            </button>
            <button
              className={mode === 'register' ? 'active' : ''}
              type="button"
              onClick={() => {
                setMode('register')
                setFormErrors({})
              }}
            >
              Cadastro
            </button>
          </div> : (
            <button
              className="link-button auth-back-button"
              type="button"
              onClick={() => {
                setMode('login')
                setRecoveryRequested(false)
                setRecoveryCode('')
                setFormErrors({})
              }}
            >
              Voltar para o login
            </button>
          )}

          {mode === 'register' && (
            <div className="form-field">
              <label htmlFor="name">Nome completo</label>
              <div className="input-wrapper">
                <UserRound className="input-icon" size={18} />
                <input
                  id="name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Ex: Maria Souza"
                  required
                  className={formErrors.name ? 'error' : ''}
                />
              </div>
              {formErrors.name && <span className="error-text">{formErrors.name}</span>}
            </div>
          )}

          <div className="form-field">
            <label htmlFor="email">E-mail</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={18} />
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="Ex: seuemail@exemplo.com"
                required
                className={formErrors.email ? 'error' : ''}
                autoComplete="email"
              />
            </div>
            {formErrors.email && <span className="error-text">{formErrors.email}</span>}
          </div>

          {mode === 'forgot' && recoveryRequested ? (
            <div className="form-field">
              <label htmlFor="recoveryCode">Código de recuperação</label>
              <div className="input-wrapper">
                <Hash className="input-icon" size={18} />
                <input
                  id="recoveryCode"
                  inputMode="numeric"
                  maxLength={6}
                  value={recoveryCode}
                  onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  className={formErrors.recoveryCode ? 'error' : ''}
                />
              </div>
              {formErrors.recoveryCode && <span className="error-text">{formErrors.recoveryCode}</span>}
            </div>
          ) : null}

          {mode !== 'forgot' || recoveryRequested ? <div className="form-field">
            <label htmlFor="password">Senha</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => handlePasswordChange(event.target.value)}
                placeholder="Digite sua senha"
                minLength={['register', 'forgot'].includes(mode) ? 8 : 6}
                required
                className={formErrors.password ? 'error' : ''}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            {['register', 'forgot'].includes(mode) && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div 
                    className="strength-fill" 
                    style={{ 
                      width: `${(passwordStrength.score / 5) * 100}%`,
                      backgroundColor: getStrengthColor(passwordStrength.score)
                    }}
                  />
                </div>
                <div className="strength-meta">
                  <span className="strength-label" style={{ color: getStrengthColor(passwordStrength.score) }}>
                    Força: <strong>{getStrengthLabel(passwordStrength.score)}</strong>
                  </span>
                </div>
              </div>
            )}
            
            {['register', 'forgot'].includes(mode) && passwordStrength.feedback.length > 0 && (
              <div className="password-feedback">
                <ul>
                  {passwordStrength.feedback.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {formErrors.password && <span className="error-text">{formErrors.password}</span>}
          </div> : null}

          {mode === 'register' && (
            <>
              <div className="form-field">
                <label htmlFor="phone">Telefone / WhatsApp</label>
                <div className="input-wrapper">
                  <Phone className="input-icon" size={18} />
                  <input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="Ex: (12) 99999-9999"
                    className={formErrors.phone ? 'error' : ''}
                    autoComplete="tel"
                  />
                </div>
                {formErrors.phone && <span className="error-text">{formErrors.phone}</span>}
              </div>
              
              <div className="form-field">
                <label htmlFor="environmentAccessCode">Código do ambiente</label>
                <div className="input-wrapper">
                  <Hash className="input-icon" size={18} />
                  <input
                    id="environmentAccessCode"
                    value={form.environmentAccessCode}
                    onChange={(event) => setForm({ ...form, environmentAccessCode: event.target.value })}
                    placeholder="Ex: SENAI2026"
                    required
                    className={formErrors.environmentAccessCode ? 'error' : ''}
                  />
                </div>
                {formErrors.environmentAccessCode && <span className="error-text">{formErrors.environmentAccessCode}</span>}
              </div>
            </>
          )}

          <div className="security-card">
            <ShieldCheck size={20} className="security-icon" />
            <div className="security-content">
              <strong>Acesso protegido</strong>
              <span>Sua senha é armazenada de forma protegida e nunca aparece em texto aberto.</span>
            </div>
          </div>

          {notice ? <div className="notice auth-action-notice" role="alert">{notice}</div> : null}

          <button className="primary-button wide cta-button" type="submit" disabled={loading}>
            {loading ? (
              <span className="spinner"></span>
            ) : (
              <>
                <span>
                  {mode === 'login'
                    ? 'Entrar no TimeOut'
                    : mode === 'register'
                      ? 'Criar minha conta'
                      : recoveryRequested
                        ? 'Alterar senha'
                        : 'Enviar código'}
                </span>
                <ArrowRight size={18} />
              </>
            )}
          </button>

          {mode === 'login' && (
            <div className="login-help">
              <span className="help-text">Esqueceu sua senha?</span>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode('forgot')
                  setForm((current) => ({ ...current, password: '' }))
                  setPasswordStrength({ score: 0, feedback: [] })
                  setFormErrors({})
                }}
              >
                Recuperar acesso
              </button>
            </div>
          )}
        </div>
      </form>
    </main>
  )
}

function VerifyEmailScreen({ session, onSession, onVerified, onLogout, onNotice, notice }) {
  const [code, setCode] = useState('')
  const [channel, setChannel] = useState('email')
  const [loading, setLoading] = useState(false)
  const hasPhone = Boolean(session.user.phone)

  async function verify(event) {
    event.preventDefault()
    setLoading(true)

    try {
      const response = await api.post('/auth/verify-email', { code })
      onVerified(response.data.data.user)
      onNotice('Conta confirmada com sucesso')
    } catch (error) {
      onNotice(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    setLoading(true)

    try {
      const response = await api.post('/auth/resend-verification', { channel })
      const nextSession = {
        ...session,
        user: response.data.data.user,
      }
      onSession(nextSession)
      setCode('')
      const reason = response.data.data.verificationReason || response.data.data.emailReason
      const selectedLabel = verificationChannelLabels[channel]
      onNotice(
        reason === 'LOCAL_DELIVERY'
          ? `Modo local ativado: nenhuma mensagem real foi enviada por ${selectedLabel}. Use o código 123456.`
          : response.data.data.verificationSent || response.data.data.emailSent
          ? `Novo código enviado por ${selectedLabel}`
          : reason === 'BREVO_AUTH_FAILED'
            ? 'A chave da API do Brevo é inválida. Atualize BREVO_API_KEY no servidor'
            : reason === 'BREVO_SENDER_INVALID'
              ? 'O remetente ainda não foi confirmado no Brevo'
              : reason === 'BREVO_RATE_LIMITED'
                ? 'O limite de envios do Brevo foi atingido. Tente novamente mais tarde'
          : reason === 'SMTP_AUTH_FAILED'
            ? 'Gmail recusou o login SMTP. Gere uma nova senha de app e atualize o .env'
            : ['SMS_NOT_CONFIGURED', 'WHATSAPP_NOT_CONFIGURED'].includes(reason)
              ? `${selectedLabel} ainda precisa ser configurado no servidor`
              : `Código gerado, mas o envio por ${selectedLabel} ainda precisa ser configurado no servidor`
      )
    } catch (error) {
      onNotice(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page verification-page">
      <section className="auth-panel">
        <div className="brand-lockup">
          <div className="brand-mark">
            <MailCheck size={30} />
          </div>
          <div>
            <p className="eyebrow">Segurança da conta</p>
            <h1>Confirme sua conta</h1>
          </div>
        </div>
        <div className="auth-copy">
          <h2>Antes de comprar ou vender, confirme que este acesso pertence a você.</h2>
          <p>
            Escolha como deseja receber o código de 6 números.
            {hasPhone ? ` Telefone cadastrado: ${session.user.phone}.` : ' Para SMS ou WhatsApp, cadastre um telefone no perfil.'}
          </p>
        </div>
      </section>

      <form className="auth-form" onSubmit={verify}>
        <div className="form-heading">
          <h2>Código de verificação</h2>
          <p>Confira o canal escolhido. No e-mail, veja também a pasta de spam.</p>
        </div>

        {notice ? <div className="notice">{notice}</div> : null}

        <div className="channel-picker">
          {Object.entries(verificationChannelLabels).map(([value, label]) => {
            const disabled = value !== 'email' && !hasPhone

            return (
              <button
                key={value}
                className={channel === value ? 'active' : ''}
                type="button"
                onClick={() => setChannel(value)}
                disabled={disabled}
                title={disabled ? 'Cadastre um telefone para usar este canal' : `Receber por ${label}`}
              >
                {label}
              </button>
            )
          })}
        </div>

        <label>
          Código
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            inputMode="numeric"
            maxLength={6}
            required
          />
        </label>

        <button className="primary-button" type="submit" disabled={loading}>
          <MailCheck size={18} />
          {loading ? 'Validando...' : 'Confirmar conta'}
        </button>
        <button className="ghost-button wide" type="button" onClick={resend} disabled={loading}>
          Enviar código por {verificationChannelLabels[channel]}
        </button>
        <button className="ghost-button wide" type="button" onClick={onLogout}>
          Sair
        </button>
      </form>
    </main>
  )
}

function TwoFactorAuthScreen({ onSession, onNotice, notice }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)

  async function verify(event) {
    event.preventDefault()
    setLoading(true)

    try {
      const response = await api.post('/auth/2fa/verify', {
        code,
        rememberDevice,
      })
      onSession(response.data.data)
      onNotice('Autenticação de dois fatores concluída com sucesso')
    } catch (error) {
      onNotice(getErrorMessage(error))
      if (error.response?.status === 401) {
        onNotice('Código inválido. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function setup2FA() {
    try {
      await api.post('/auth/2fa/setup')
      onNotice('Código 2FA enviado para seu e-mail')
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-lockup">
          <div className="brand-mark">
            <ShieldCheck size={30} />
          </div>
          <div>
            <p className="eyebrow">Segurança adicional</p>
            <h1>Autenticação de Dois Fatores</h1>
          </div>
        </div>
        <div className="auth-copy">
          <h2>Proteja sua conta com uma camada extra de segurança.</h2>
          <p>
            Digite o código de 6 dígitos enviado para seu e-mail. 
            Este código muda a cada 30 segundos para maior segurança.
          </p>
        </div>
      </section>

      <form className="auth-form" onSubmit={verify}>
        <div className="form-heading">
          <h2>Código de Verificação</h2>
          <p>Verifique seu e-mail para encontrar o código de 6 dígitos.</p>
        </div>

        {notice ? <div className="notice">{notice}</div> : null}

        <label>
          Código 2FA
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            inputMode="numeric"
            maxLength={6}
            required
            autoComplete="one-time-code"
          />
        </label>

        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(event) => setRememberDevice(event.target.checked)}
          />
          <span>Lembrar este dispositivo por 30 dias</span>
        </label>

        <div className="security-notice">
          <ShieldCheck size={16} />
          <span>Nunca compartilhe seu código 2FA com ninguém.</span>
        </div>

        <button className="primary-button" type="submit" disabled={loading}>
          <BadgeCheck size={18} />
          {loading ? 'Verificando...' : 'Verificar e Entrar'}
        </button>

        <button className="ghost-button wide" type="button" onClick={setup2FA}>
          <RefreshCcw size={16} />
          Reenviar código
        </button>
      </form>
    </main>
  )
}

function Shell({
  session,
  onLogout,
  notice,
  onProfileClick,
  navigation,
  pageTitle,
  cartItemsCount,
  cartTotal,
  onCartClick,
  notifications = [],
  onNotificationRead,
  children,
}) {
  const user = session.user
  const profileImage = getAssetUrl(user.profileImageUrl)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const unreadCount = notifications.filter((item) => !item.readAt).length

  function closeMobileMenuFromNavigation(event) {
    if (event.target.closest('button')) setMobileMenuOpen(false)
  }

  return (
    <main className="app-shell">
      {mobileMenuOpen ? (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <aside className={mobileMenuOpen ? 'sidebar mobile-open' : 'sidebar'}>
        <div className="sidebar-brand">
          <Logo className="sidebar-logo" />
          <button
            className="sidebar-close-button"
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <button
          className="profile-strip profile-strip-button"
          type="button"
          onClick={() => {
            onProfileClick()
            setMobileMenuOpen(false)
          }}
        >
          <div className="profile-avatar">
            {profileImage ? <img src={profileImage} alt={user.name} /> : <UserRound size={20} />}
          </div>
          <div>
            <strong>{user.name}</strong>
            <span>{roleLabel(user.role)} {user.phone ? `- ${user.phone}` : ''}</span>
          </div>
        </button>

        <div className="sidebar-navigation" onClick={closeMobileMenuFromNavigation}>
          {navigation}
        </div>

        <footer className="sidebar-footer">
          <div className="sidebar-environment">
            <MapPin size={17} />
            <div>
              <strong>{user.environment?.name || 'Ambiente local'}</strong>
              <span>{roleLabel(user.role)}</span>
            </div>
          </div>

          <button className="sidebar-logout" type="button" onClick={onLogout}>
            <LogOut size={18} />
            Sair
          </button>
        </footer>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div className="topbar-brand">
            <Logo className="topbar-logo" />
            <div className="topbar-environment">
              <strong>{user.environment?.name || 'Ambiente local'}</strong>
              <span>{environmentTypeLabels[user.environment?.type] || 'Pedidos locais'}</span>
            </div>
          </div>
          <div className="topbar-title">
            <p className="eyebrow">Ambiente {environmentTypeLabels[user.environment?.type] || 'local'}</p>
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-actions">
            <button className="notification-button" type="button" onClick={() => setNotificationsOpen((current) => !current)} aria-label="Abrir notificações">
              <Bell size={16} />
              {unreadCount > 0 ? <b>{unreadCount}</b> : null}
            </button>
            {onCartClick ? <button className="topbar-cart-button" type="button" onClick={onCartClick} title="Abrir carrinho">
              <ShoppingCart size={18} />
              <div className="topbar-cart-copy">
                <span>Carrinho</span>
                <strong>{cartItemsCount > 0 ? money.format(cartTotal) : 'Vazio'}</strong>
              </div>
              {cartItemsCount > 0 ? <b>{cartItemsCount}</b> : null}
            </button> : null}
          </div>
          {notificationsOpen ? (
            <div className="notifications-popover">
              <div className="section-heading compact-heading"><h3>Notificações</h3><span>{unreadCount} não lidas</span></div>
              <div className="notifications-list">
                {notifications.map((item) => (
                  <button key={item.id} className={item.readAt ? 'notification-item read' : 'notification-item'} type="button" onClick={() => onNotificationRead?.(item.id)}>
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                    <small>{formatDate(item.createdAt)}</small>
                  </button>
                ))}
                {notifications.length === 0 ? <p className="muted-note">Nenhuma notificação.</p> : null}
              </div>
            </div>
          ) : null}
        </header>

        {notice ? <div className="notice">{notice}</div> : null}
        {children}
      </section>
    </main>
  )
}

function Dashboard({ session, notice, onLogout, onNotice, onSessionUser }) {
  const cartStorageKey = `${CART_KEY}:${session.user.id}:${session.user.environmentId}`
  const [view, setView] = useState(
    session.user.role === 'platform_admin'
      ? 'platform-access'
      : !session.user.environmentId
        ? 'access'
        : session.user.role === 'seller'
          ? 'seller-orders'
          : 'market',
  )
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [orders, setOrders] = useState([])
  const [sellerOrders, setSellerOrders] = useState([])
  const [users, setUsers] = useState([])
  const [coupons, setCoupons] = useState([])
  const [paymentSettings, setPaymentSettings] = useState(null)
  const [sellerPaymentSettings, setSellerPaymentSettings] = useState(defaultPaymentSettings)
  const [environments, setEnvironments] = useState([])
  const [plans, setPlans] = useState([])
  const [financialOverview, setFinancialOverview] = useState(null)
  const [adminMonetization, setAdminMonetization] = useState(null)
  const [accessData, setAccessData] = useState({ sellerApplications: [], environmentApplications: [] })
  const [environmentAccess, setEnvironmentAccess] = useState(null)
  const [platformAccess, setPlatformAccess] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [cart, setCart] = useState(() => readStoredCart(cartStorageKey))
  const [checkoutResult, setCheckoutResult] = useState(null)
  const [cartToast, setCartToast] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [productFeedback, setProductFeedback] = useState({ reviews: [], averageRating: 0, reviewsCount: 0 })
  const [productDetailsLoading, setProductDetailsLoading] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ search: '', categoryId: '' })
  const [userFilters, setUserFilters] = useState({ search: '', role: '' })
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`${SEARCH_HISTORY_KEY}:${session.user.id}`)) || []
    } catch {
      return []
    }
  })
  const cartToastTimerRef = useRef(null)
  const cartStorageKeyRef = useRef(cartStorageKey)

  const user = session.user

  useEffect(() => {
    if (cartStorageKeyRef.current !== cartStorageKey) {
      cartStorageKeyRef.current = cartStorageKey
      setCart(readStoredCart(cartStorageKey))
      return
    }

    localStorage.setItem(cartStorageKey, JSON.stringify(cart))
  }, [cart, cartStorageKey])

  useEffect(() => {
    function handleNavigation(event) {
      if (event.detail === 'profile') {
        setView('profile')
      }
    }

    window.addEventListener(APP_NAVIGATION_EVENT, handleNavigation)
    return () => window.removeEventListener(APP_NAVIGATION_EVENT, handleNavigation)
  }, [])
  const isEnvironmentAdmin = ['admin', 'environment_admin'].includes(user.role)
  const isPlatformAdmin = user.role === 'platform_admin'
  const isSeller = user.role === 'seller' || isEnvironmentAdmin
  const isApprovedSeller = user.role === 'seller'
  const isAdmin = isEnvironmentAdmin

  const loadProducts = useCallback(async () => {
    const params = {}
    if (filters.search) params.search = filters.search
    if (filters.categoryId) params.categoryId = filters.categoryId

    const response = await api.get('/products', { params })
    setProducts(response.data.data.products)
  }, [filters])

  const loadCategories = useCallback(async () => {
    const response = await api.get('/categories')
    setCategories(response.data.data.categories)
  }, [])

  const loadOrders = useCallback(async () => {
    const response = await api.get('/orders/my-orders')
    setOrders(response.data.data.orders)
  }, [])

  const loadSellerOrders = useCallback(async () => {
    const response = await api.get('/orders/seller-orders')
    setSellerOrders(response.data.data.orders)
  }, [])

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return

    const params = {}
    if (userFilters.search) params.search = userFilters.search
    if (userFilters.role) params.role = userFilters.role

    const response = await api.get('/users', { params })
    setUsers(response.data.data.users)
  }, [isAdmin, userFilters])

  const loadCoupons = useCallback(async () => {
    if (!isSeller) return

    const response = await api.get('/coupons')
    setCoupons(response.data.data.coupons)
  }, [isSeller])

  const loadPaymentSettings = useCallback(async () => {
    if (!isSeller) return

    const response = await api.get('/payments/settings')
    setPaymentSettings(response.data.data.settings)
  }, [isSeller])

  const loadEnvironments = useCallback(async () => {
    if (!isAdmin) return

    const response = await api.get('/environments')
    setEnvironments(response.data.data.environments)
  }, [isAdmin])

  const loadPlans = useCallback(async () => {
    const response = await api.get('/plans')
    setPlans(response.data.data.plans)
  }, [])

  const loadFinancialOverview = useCallback(async () => {
    if (!isApprovedSeller) return
    const response = await api.get('/plans/me')
    setFinancialOverview(response.data.data)
  }, [isApprovedSeller])

  const loadAdminMonetization = useCallback(async () => {
    if (!isAdmin) return
    const response = await api.get('/plans/admin/overview')
    setAdminMonetization(response.data.data)
  }, [isAdmin])

  const loadAccessData = useCallback(async () => {
    const [applicationsResponse, notificationsResponse] = await Promise.all([
      api.get('/access/me/applications'),
      api.get('/access/notifications'),
    ])
    setAccessData(applicationsResponse.data.data)
    setNotifications(notificationsResponse.data.data.notifications)

    if (isEnvironmentAdmin) {
      const response = await api.get('/access/environment-admin')
      setEnvironmentAccess(response.data.data)
    }
    if (isPlatformAdmin) {
      const response = await api.get('/access/platform')
      setPlatformAccess(response.data.data)
    }
  }, [isEnvironmentAdmin, isPlatformAdmin])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      if (isPlatformAdmin || !user.environmentId) {
        await loadAccessData()
        return
      }
      await Promise.all([
        loadProducts(),
        loadCategories(),
        loadOrders(),
        isSeller ? loadSellerOrders() : Promise.resolve(),
        isAdmin ? loadUsers() : Promise.resolve(),
        isSeller ? loadCoupons() : Promise.resolve(),
        isSeller ? loadPaymentSettings() : Promise.resolve(),
        isAdmin ? loadEnvironments() : Promise.resolve(),
        loadPlans(),
        isApprovedSeller ? loadFinancialOverview() : Promise.resolve(),
        isAdmin ? loadAdminMonetization() : Promise.resolve(),
        loadAccessData(),
      ])
    } catch (error) {
      onNotice(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [isAdmin, isApprovedSeller, isPlatformAdmin, isSeller, loadAccessData, loadAdminMonetization, loadCategories, loadCoupons, loadEnvironments, loadFinancialOverview, loadOrders, loadPaymentSettings, loadPlans, loadProducts, loadSellerOrders, loadUsers, onNotice, user.environmentId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refresh()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [refresh, user.environmentId, user.role])

  const sellerId = cart[0]?.seller.id
  const cartTotal = cart.reduce((sum, item) => sum + getCartUnitPrice(item) * item.cartQuantity, 0)
  const cartItemsCount = getCartItemsCount(cart)

  useEffect(() => {
    if (!sellerId) {
      return undefined
    }

    let active = true

    api.get(`/payments/settings/sellers/${sellerId}`)
      .then((response) => {
        if (active) setSellerPaymentSettings(response.data.data.settings)
      })
      .catch(() => {
        if (active) setSellerPaymentSettings(defaultPaymentSettings)
      })

    return () => {
      active = false
    }
  }, [sellerId])

  useEffect(() => {
    return () => window.clearTimeout(cartToastTimerRef.current)
  }, [])

  function rememberSearch(term) {
    const search = term.trim()
    if (!search) return

    setRecentSearches((current) => {
      const next = [search, ...current.filter((item) => item.toLowerCase() !== search.toLowerCase())].slice(0, 6)
      localStorage.setItem(`${SEARCH_HISTORY_KEY}:${user.id}`, JSON.stringify(next))
      return next
    })
  }

  function applyRecentSearch(search) {
    setFilters((current) => ({ ...current, search }))
    rememberSearch(search)
  }

  function showCartToast(message) {
    setCartToast(message)
    window.clearTimeout(cartToastTimerRef.current)
    cartToastTimerRef.current = window.setTimeout(() => setCartToast(''), 2800)
  }

  function buildCartItem(product) {
    const selectedFlavor = product.selectedFlavor || ''
    const selectedOption = parseProductFlavors(product.flavors).find((option) => option.name === selectedFlavor)
    const cartUnitPrice = product.cartUnitPrice ?? getOptionPrice(product, selectedOption)

    return {
      ...product,
      selectedFlavor,
      cartUnitPrice,
      cartQuantity: 1,
    }
  }

  function canAddProduct(product, replaceCart = false) {
    if (Number(product.seller?.id || product.userId) === Number(user.id)) {
      onNotice('Você não pode comprar seu próprio produto')
      return false
    }

    if (product.quantity <= 0) {
      onNotice('Produto sem estoque')
      return false
    }

    if (!replaceCart && cart.length > 0 && Number(sellerId) !== Number(product.seller.id)) {
      onNotice('Escolha produtos de um vendedor por pedido')
      return false
    }

    return true
  }

  async function openProduct(product) {
    setSelectedProduct(product)
    setProductFeedback({ reviews: [], averageRating: 0, reviewsCount: 0 })
    setProductDetailsLoading(true)

    try {
      const [productResponse, reviewsResponse] = await Promise.all([
        api.get(`/products/${product.id}`),
        api.get(`/products/${product.id}/reviews`),
      ])

      setSelectedProduct(productResponse.data.data.product)
      setProductFeedback(reviewsResponse.data.data)
    } catch (error) {
      onNotice(getErrorMessage(error))
    } finally {
      setProductDetailsLoading(false)
    }
  }

  async function saveProductReview(productId, payload) {
    setReviewSubmitting(true)

    try {
      await api.post(`/products/${productId}/reviews`, payload)
      const response = await api.get(`/products/${productId}/reviews`)
      setProductFeedback(response.data.data)
      onNotice('Avaliação salva')
    } catch (error) {
      onNotice(getErrorMessage(error))
    } finally {
      setReviewSubmitting(false)
    }
  }

  function addToCart(product) {
    if (!canAddProduct(product)) return

    const cartItem = buildCartItem(product)

    setCart((current) => {
      const existing = current.find((item) =>
        item.id === cartItem.id && (item.selectedFlavor || '') === cartItem.selectedFlavor
      )
      if (existing) {
        return current.map((item) =>
          item.id === cartItem.id && (item.selectedFlavor || '') === cartItem.selectedFlavor
            ? { ...item, cartQuantity: Math.min(item.cartQuantity + 1, item.quantity) }
            : item,
        )
      }

      return [...current, cartItem]
    })

    showCartToast(`${product.name} foi adicionado ao carrinho`)
  }

  function buyNow(product) {
    if (!canAddProduct(product, true)) return

    const cartItem = buildCartItem(product)
    setCart([cartItem])
    setSelectedProduct(null)
    setView('cart')
    showCartToast(`${product.name} pronto para finalizar`)
  }

  function removeFromCart(productId, selectedFlavor = '') {
    setCart((current) => current.filter((item) =>
      !(item.id === productId && (item.selectedFlavor || '') === selectedFlavor)
    ))
  }

  function changeCartQuantity(productId, delta, selectedFlavor = '') {
    setCart((current) =>
      current
        .map((item) =>
          item.id === productId && (item.selectedFlavor || '') === selectedFlavor
            ? { ...item, cartQuantity: Math.max(1, Math.min(item.quantity, item.cartQuantity + delta)) }
            : item,
        )
        .filter((item) => item.cartQuantity > 0),
    )
  }

  async function createOrder(formData) {
    if (cart.length === 0) {
      onNotice('Adicione produtos ao carrinho')
      return
    }

    try {
      const response = await api.post('/orders', {
        sellerId,
        paymentMethod: formData.paymentMethod,
        deliveryType: formData.deliveryType,
        deliveryLocation: formData.deliveryLocation,
        observation: formData.observation,
        couponCode: formData.couponCode || undefined,
        items: cart.map((item) => ({
          productId: item.id,
          selectedFlavor: item.selectedFlavor || undefined,
          quantity: item.cartQuantity,
        })),
      })

      const { order, payment } = response.data.data
      setCart([])
      const wasAutoApproved = payment?.isSimulated && payment.status === 'approved'
      setCheckoutResult(payment && !wasAutoApproved ? { order, payment } : null)
      setView(payment && !wasAutoApproved ? 'checkout-payment' : 'my-orders')
      onNotice(wasAutoApproved
        ? 'Pedido criado e pagamento de teste aprovado automaticamente.'
        : payment
          ? 'Pedido criado. Finalize o pagamento para confirmar.'
          : 'Pedido enviado para o vendedor')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function simulatePayment(orderId, status) {
    try {
      const response = await api.post(`/payments/orders/${orderId}/simulate`, { status })
      const { order, transaction } = response.data.data
      setCheckoutResult({ order, payment: transaction })
      const messages = {
        approved: 'Pagamento de teste aprovado. O pedido foi liberado para o vendedor.',
        pending: 'Pagamento de teste mantido como pendente.',
        declined: 'Pagamento de teste recusado.',
      }
      onNotice(messages[status])
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function cancelOrder(orderId) {
    try {
      await api.patch(`/orders/${orderId}/cancel`)
      onNotice('Pedido cancelado')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function updateOrderStatus(orderId, status) {
    try {
      await api.patch(`/orders/${orderId}/status`, { status })
      onNotice('Status atualizado')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function saveProduct(payload, productId = null) {
    const { imageFile, galleryFiles = [], ...productData } = payload
    const requestData = toFormData(productData, 'image', imageFile)
    galleryFiles.forEach((file) => requestData.append('images', file))

    try {
      if (productId) {
        await api.put(`/products/${productId}`, requestData)
        onNotice('Produto atualizado')
      } else {
        await api.post('/products', requestData)
        onNotice('Produto criado')
      }

      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function deleteProduct(productId) {
    try {
      await api.delete(`/products/${productId}`)
      onNotice('Produto removido')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function toggleProduct(product) {
    try {
      await api.patch(`/products/${product.id}/status`, { isActive: !product.isActive })
      onNotice(product.isActive ? 'Produto pausado' : 'Produto ativado')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function saveCoupon(payload, couponId = null) {
    try {
      if (couponId) {
        await api.put(`/coupons/${couponId}`, payload)
        onNotice('Cupom atualizado')
      } else {
        await api.post('/coupons', payload)
        onNotice('Cupom criado')
      }

      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function toggleCoupon(coupon) {
    try {
      await api.patch(`/coupons/${coupon.id}/status`, { isActive: !coupon.isActive })
      onNotice(coupon.isActive ? 'Cupom pausado' : 'Cupom ativado')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function deleteCoupon(couponId) {
    try {
      await api.delete(`/coupons/${couponId}`)
      onNotice('Cupom removido')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function savePaymentSettings(payload) {
    try {
      const response = await api.put('/payments/settings', payload)
      setPaymentSettings(response.data.data.settings)
      onNotice('Formas de pagamento atualizadas')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function saveProfile(payload) {
    const { profileImageFile, ...profileData } = payload
    const requestData = toFormData(profileData, 'profileImage', profileImageFile)

    try {
      const response = await api.put(`/users/${user.id}`, requestData)

      if (profileData.password) {
        onNotice('Senha alterada. Entre novamente com a nova senha.')
        onLogout()
        return true
      }

      onSessionUser(response.data.data.user)
      onNotice('Perfil atualizado')
      await refresh()
      return true
    } catch (error) {
      onNotice(getErrorMessage(error))
      return false
    }
  }

  async function joinEnvironment(accessCode) {
    try {
      const response = await api.post('/environments/join', { accessCode })
      onSessionUser(response.data.data.user)
      setView(response.data.data.pendingApproval ? 'access' : 'market')
      onNotice(response.data.data.pendingApproval ? 'Solicitação de entrada enviada para aprovação' : 'Você entrou no ambiente')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function switchEnvironment(environmentId) {
    try {
      const response = await api.patch(`/environments/${environmentId}/switch`)
      onSessionUser(response.data.data.user)
      setView('market')
      onNotice('Ambiente alterado')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function deleteUser(userId) {
    try {
      await api.delete(`/users/${userId}`)
      onNotice('Usuário removido')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function changeMyPlan(planCode) {
    try {
      await api.patch('/plans/me', { planCode })
      onNotice('Plano experimental alterado. Nenhuma cobrança real foi feita.')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function changeSellerPlan(userId, planCode) {
    try {
      await api.patch(`/plans/admin/sellers/${userId}`, { planCode })
      onNotice('Plano experimental do vendedor atualizado')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function reviewSellerRequest(applicationId, action, reason = '') {
    try {
      await api.patch(`/access/environment-admin/seller-applications/${applicationId}`, {
        status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action,
        reason: reason || (action === 'reject' ? 'Solicitação recusada pelo administrador do ambiente.' : undefined),
      })
      onNotice(action === 'approve' ? 'Vendedor aprovado no plano Básico' : 'Solicitação atualizada')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function submitSellerApplication(payload) {
    try {
      await api.post('/access/seller-applications', payload)
      onNotice('Solicitação de vendedor enviada para análise')
      await refresh()
      return true
    } catch (error) { onNotice(getErrorMessage(error)); return false }
  }

  async function submitEnvironmentApplication(payload) {
    try {
      await api.post('/access/environment-applications', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
      onNotice('Solicitação de ambiente enviada para a equipe TimeOut')
      await refresh()
      return true
    } catch (error) { onNotice(getErrorMessage(error)); return false }
  }

  async function reviewMembership(id, status) {
    try {
      await api.patch(`/access/environment-admin/memberships/${id}`, { status })
      onNotice('Participação atualizada')
      await refresh()
    } catch (error) { onNotice(getErrorMessage(error)) }
  }

  async function rotateEnvironmentCode() {
    try {
      const response = await api.post('/access/environment-admin/access-code/rotate')
      onNotice(`Novo código: ${response.data.data.accessCode}`)
      await refresh()
    } catch (error) { onNotice(getErrorMessage(error)) }
  }

  async function toggleEnvironmentCode(enabled) {
    try {
      await api.patch('/access/environment-admin/access-code', { enabled })
      onNotice(`Código ${enabled ? 'ativado' : 'desativado'}`)
      await refresh()
    } catch (error) { onNotice(getErrorMessage(error)) }
  }

  async function reviewEnvironmentApplication(id, status, reason = '') {
    try {
      const response = await api.patch(`/access/platform/environment-applications/${id}`, { status, reason })
      const code = response.data.data.generatedCode
      onNotice(code ? `Ambiente aprovado. Código inicial: ${code}` : 'Solicitação atualizada')
      await refresh()
    } catch (error) { onNotice(getErrorMessage(error)) }
  }

  async function toggleEnvironmentStatus(id, suspended) {
    try {
      await api.patch(`/access/platform/environments/${id}/status`, { suspended })
      onNotice(suspended ? 'Ambiente suspenso' : 'Ambiente reativado')
      await refresh()
    } catch (error) { onNotice(getErrorMessage(error)) }
  }

  async function transferEnvironment(id, userId) {
    try {
      await api.patch(`/access/platform/environments/${id}/transfer`, { userId: Number(userId) })
      onNotice('Responsável pelo ambiente atualizado')
      await refresh()
    } catch (error) { onNotice(getErrorMessage(error)) }
  }

  async function toggleAdministratorStatus(id, suspended) {
    try {
      await api.patch(`/access/platform/administrators/${id}/status`, { suspended })
      onNotice(suspended ? 'Administrador suspenso' : 'Administrador reativado')
      await refresh()
    } catch (error) { onNotice(getErrorMessage(error)) }
  }

  async function viewApplicationDocument(id) {
    try {
      const response = await api.get(`/access/platform/environment-applications/${id}/document`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) { onNotice(getErrorMessage(error)) }
  }

  async function markNotificationRead(id) {
    try {
      await api.patch(`/access/notifications/${id}/read`)
      await loadAccessData()
    } catch (error) { onNotice(getErrorMessage(error)) }
  }

  async function revealApplicationCpf(type, id) {
    try {
      const response = await api.get(`/access/applications/${type}/${id}/cpf`)
      onNotice(`CPF verificado: ${response.data.data.cpf}`)
    } catch (error) { onNotice(getErrorMessage(error)) }
  }

  async function saveInstitutionalConfig(payload) {
    try {
      await api.put('/plans/admin/institutional', payload)
      onNotice('Configuração institucional salva em modo experimental')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function saveCategory(name, categoryId = null) {
    try {
      if (categoryId) {
        await api.put(`/categories/${categoryId}`, { name })
        onNotice('Categoria atualizada')
      } else {
        await api.post('/categories', { name })
        onNotice('Categoria criada')
      }

      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function deleteCategory(categoryId) {
    try {
      await api.delete(`/categories/${categoryId}`)
      onNotice('Categoria removida')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  const primaryTabs = isPlatformAdmin
    ? []
    : user.environmentId
      ? [
          ['market', 'Vitrine', ShoppingBag],
          ['cart', `Carrinho (${cartItemsCount})`, ShoppingCart],
          ['my-orders', 'Histórico de compras', History],
          ['plans', 'Planos', Crown],
          ['access', 'Solicitações', FileText],
        ]
      : [['access', 'Solicitações', FileText]]
  const sellerTabs = []
  const adminTabs = []

  if (isSeller) {
    sellerTabs.push(['sales-dashboard', 'Visão geral', BarChart3])
    sellerTabs.push(['seller-orders', 'Pedidos recebidos', ChefHat])
    sellerTabs.push(['sales-history', 'Histórico de vendas', ClipboardList])
    sellerTabs.push(['seller-products', 'Meus produtos', Package])
    sellerTabs.push(['seller-coupons', 'Cupons', Percent])
    sellerTabs.push(['seller-payments', 'Pagamentos', CreditCard])
    if (isApprovedSeller) sellerTabs.push(['seller-financial', 'Financeiro', CircleDollarSign])
  }

  if (isAdmin) {
    adminTabs.push(['admin-access', 'Acessos e aprovações', UserCog])
    adminTabs.push(['admin-users', 'Usuários', UsersRound])
    adminTabs.push(['admin-environments', 'Ambientes', Building2])
    adminTabs.push(['admin-categories', 'Categorias', Tags])
    adminTabs.push(['admin-monetization', 'Monetização', Crown])
  }

  if (isPlatformAdmin) {
    adminTabs.push(['platform-access', 'Equipe TimeOut', ShieldCheck])
  }

  const allTabs = [...primaryTabs, ...sellerTabs, ...adminTabs]
  const pageTitle = allTabs.find(([id]) => id === view)?.[1]
    || (view === 'profile' ? 'Meu perfil' : view === 'checkout-payment' ? 'Pagamento' : 'TimeOut')

  const navigation = (
    <nav className="sidebar-nav-groups" aria-label="Navegação principal">
      <div className="sidebar-nav-group">
        <span className="sidebar-nav-label">Principal</span>
        {primaryTabs.map(([id, label, Icon]) => (
          <button
            key={id}
            className={view === id ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
            type="button"
            onClick={() => setView(id)}
            aria-current={view === id ? 'page' : undefined}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {sellerTabs.length > 0 ? (
        <div className="sidebar-nav-group">
          <span className="sidebar-nav-label">Vendedor</span>
          {sellerTabs.map(([id, label, Icon]) => (
            <button
              key={id}
              className={view === id ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
              type="button"
              onClick={() => setView(id)}
              aria-current={view === id ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {adminTabs.length > 0 ? (
        <div className="sidebar-nav-group">
          <span className="sidebar-nav-label">Administração</span>
          {adminTabs.map(([id, label, Icon]) => (
            <button
              key={id}
              className={view === id ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
              type="button"
              onClick={() => setView(id)}
              aria-current={view === id ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      ) : null}

      <button className="sidebar-refresh" type="button" onClick={refresh}>
        <RefreshCcw size={17} className={loading ? 'spin' : ''} />
        Atualizar dados
      </button>
    </nav>
  )

  return (
    <Shell
      session={session}
      notice={notice}
      onLogout={onLogout}
      onProfileClick={() => setView('profile')}
      navigation={navigation}
      pageTitle={pageTitle}
      cartItemsCount={cartItemsCount}
      cartTotal={cartTotal}
      onCartClick={!isPlatformAdmin && user.environmentId ? () => setView('cart') : null}
      notifications={notifications}
      onNotificationRead={markNotificationRead}
    >

      {view === 'market' && (
        <MarketView
          products={products}
          categories={categories}
          filters={filters}
          onFilter={setFilters}
          onAdd={addToCart}
          onOpen={openProduct}
          onRememberSearch={rememberSearch}
          recentSearches={recentSearches}
          onUseRecentSearch={applyRecentSearch}
          currentUserId={user.id}
        />
      )}

      {view === 'cart' && (
        <CartView
          cart={cart}
          total={cartTotal}
          sellerPaymentSettings={sellerPaymentSettings}
          onRemove={removeFromCart}
          onQuantity={changeCartQuantity}
          onSubmit={createOrder}
        />
      )}

      {view === 'checkout-payment' && checkoutResult && (
        <CheckoutPaymentView
          result={checkoutResult}
          onOrders={() => setView('my-orders')}
          onRefresh={refresh}
          onSimulate={simulatePayment}
        />
      )}

      {view === 'plans' && (
        <PlansView
          plans={plans}
          subscription={financialOverview?.subscription}
          userRole={user.role}
          onChoose={changeMyPlan}
          onProfile={() => setView('profile')}
        />
      )}

      {view === 'access' && (
        <AccessCenterView
          user={user}
          data={accessData}
          onSellerApply={submitSellerApplication}
          onEnvironmentApply={submitEnvironmentApplication}
          onJoinEnvironment={joinEnvironment}
        />
      )}

      {view === 'my-orders' && (
        <OrdersView orders={orders} mode="customer" onCancel={cancelOrder} title="Histórico de compras" />
      )}

      {view === 'sales-dashboard' && (
        <SalesDashboard orders={sellerOrders} products={products.filter((product) => product.seller.id === user.id || isEnvironmentAdmin)} />
      )}

      {view === 'seller-orders' && (
        <OrdersView orders={sellerOrders} mode="seller" onStatus={updateOrderStatus} />
      )}

      {view === 'sales-history' && (
        <OrdersView orders={sellerOrders} mode="seller" onStatus={updateOrderStatus} title="Histórico de vendas" />
      )}

      {view === 'seller-products' && (
        <SellerProductsView
          products={products.filter((product) => product.seller.id === user.id || isEnvironmentAdmin)}
          categories={categories}
          onSave={saveProduct}
          onToggle={toggleProduct}
          onDelete={deleteProduct}
        />
      )}

      {view === 'seller-coupons' && (
        <CouponManagerView
          coupons={coupons}
          onSave={saveCoupon}
          onToggle={toggleCoupon}
          onDelete={deleteCoupon}
        />
      )}

      {view === 'seller-payments' && (
        <PaymentSettingsView
          key={paymentSettings?.updatedAt || paymentSettings?.id || 'payment-settings-default'}
          settings={paymentSettings || defaultPaymentSettings}
          onSave={savePaymentSettings}
        />
      )}

      {view === 'seller-financial' && (
        <SellerFinancialView
          overview={financialOverview}
          onPlans={() => setView('plans')}
        />
      )}

      {view === 'profile' && (
        <ProfileView
          user={user}
          onSave={saveProfile}
          onJoinEnvironment={joinEnvironment}
          onSwitchEnvironment={switchEnvironment}
          onOpenAccess={() => setView('access')}
        />
      )}

      {view === 'admin-users' && (
        <AdminUsersView
          users={users}
          currentUserId={user.id}
          filters={userFilters}
          onFilter={setUserFilters}
          onDelete={deleteUser}
        />
      )}

      {view === 'admin-categories' && (
        <AdminCategoriesView
          categories={categories}
          onSave={saveCategory}
          onDelete={deleteCategory}
        />
      )}

      {view === 'admin-environments' && (
        <AdminEnvironmentsView
          environments={environments}
          activeEnvironmentId={user.environmentId}
          onSwitch={switchEnvironment}
        />
      )}

      {view === 'admin-monetization' && (
        <AdminMonetizationView
          overview={adminMonetization}
          plans={plans}
          onReviewRequest={reviewSellerRequest}
          onChangePlan={changeSellerPlan}
          onSaveInstitutional={saveInstitutionalConfig}
        />
      )}

      {view === 'admin-access' && (
        <EnvironmentAccessAdminView
          data={environmentAccess}
          onReviewSeller={reviewSellerRequest}
          onReviewMembership={reviewMembership}
          onRotateCode={rotateEnvironmentCode}
          onToggleCode={toggleEnvironmentCode}
          onRevealCpf={(id) => revealApplicationCpf('seller', id)}
        />
      )}

      {view === 'platform-access' && (
        <PlatformAccessView
          data={platformAccess}
          onReviewApplication={reviewEnvironmentApplication}
          onToggleEnvironment={toggleEnvironmentStatus}
          onTransferEnvironment={transferEnvironment}
          onToggleAdministrator={toggleAdministratorStatus}
          onViewDocument={viewApplicationDocument}
          onRevealCpf={(id) => revealApplicationCpf('environment', id)}
        />
      )}

      {cartToast ? (
        <div className="cart-toast" role="status">
          <BadgeCheck size={18} />
          <span>{cartToast}</span>
        </div>
      ) : null}

      {cartItemsCount > 0 ? (
        <button className="floating-cart" type="button" onClick={() => setView('cart')}>
          <ShoppingCart size={22} />
          <span>{cartItemsCount}</span>
          <strong>{money.format(cartTotal)}</strong>
        </button>
      ) : null}

      {selectedProduct ? (
        <ProductDetailModal
          key={`${selectedProduct.id}-${productDetailsLoading ? 'loading' : 'loaded'}`}
          product={selectedProduct}
          feedback={productFeedback}
          loading={productDetailsLoading}
          currentUserId={user.id}
          onClose={() => setSelectedProduct(null)}
          onAdd={addToCart}
          onBuyNow={buyNow}
          onReview={saveProductReview}
          reviewSubmitting={reviewSubmitting}
        />
      ) : null}
    </Shell>
  )
}

function MarketView({
  products,
  categories,
  filters,
  onFilter,
  onAdd,
  onOpen,
  onRememberSearch,
  recentSearches,
  onUseRecentSearch,
  currentUserId,
}) {
  const featuredProduct = products.find((product) => getAssetUrl(product.imageUrl)) || products[0]

  return (
    <section className="content-grid two-columns">
      <div className="main-column">
        <article
          className="market-hero"
          style={featuredProduct && getAssetUrl(featuredProduct.imageUrl)
            ? { backgroundImage: `linear-gradient(90deg, rgba(4, 40, 70, 0.94) 0%, rgba(4, 40, 70, 0.66) 48%, rgba(4, 40, 70, 0.08) 100%), url(${getAssetUrl(featuredProduct.imageUrl)})` }
            : undefined}
        >
          <div className="market-hero-copy">
            <span>Em destaque hoje</span>
            <h2>{featuredProduct?.name || 'Sabores feitos no seu ambiente'}</h2>
            <p>{featuredProduct?.description || 'Descubra produtos locais preparados por vendedores perto de você.'}</p>
            {featuredProduct ? (
              <button type="button" onClick={() => onOpen(featuredProduct)}>
                Ver produto
                <ArrowRight size={17} />
              </button>
            ) : null}
          </div>
        </article>

        <div className="toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              value={filters.search}
              onChange={(event) => onFilter({ ...filters, search: event.target.value })}
              onBlur={(event) => onRememberSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onRememberSearch(event.currentTarget.value)
              }}
              placeholder="Buscar produto"
            />
          </div>
          <select
            value={filters.categoryId}
            onChange={(event) => onFilter({ ...filters, categoryId: event.target.value })}
          >
            <option value="">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="category-filter-row" aria-label="Filtrar por categoria">
          <button
            className={!filters.categoryId ? 'active' : ''}
            type="button"
            onClick={() => onFilter({ ...filters, categoryId: '' })}
          >
            Todos
          </button>
          {categories.map((category) => (
            <button
              className={String(filters.categoryId) === String(category.id) ? 'active' : ''}
              key={category.id}
              type="button"
              onClick={() => onFilter({ ...filters, categoryId: String(category.id) })}
            >
              {category.name}
            </button>
          ))}
        </div>

        {recentSearches.length > 0 ? (
          <div className="recent-searches">
            <span>Últimas pesquisas</span>
            {recentSearches.map((search) => (
              <button key={search} type="button" onClick={() => onUseRecentSearch(search)}>
                {search}
              </button>
            ))}
          </div>
        ) : null}

        <div className="product-grid">
          {products.map((product) => {
            const isOwnProduct = Number(product.seller?.id) === Number(currentUserId)
            const isUnavailable = product.quantity <= 0 || isOwnProduct
            const productOptions = parseProductFlavors(product.flavors)
            const optionPrices = productOptions.map((option) => getOptionPrice(product, option))
            const lowestPrice = optionPrices.length
              ? Math.min(getOptionPrice(product), ...optionPrices)
              : getOptionPrice(product)
            const hasVariablePrice = optionPrices.some((price) => price !== getOptionPrice(product))
            const discountLabel = formatDiscount(product)

            return (
              <article
                className={!isUnavailable ? 'product-card' : 'product-card muted'}
                key={product.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(product)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onOpen(product)
                  }
                }}
                aria-label={`Abrir detalhes de ${product.name}`}
              >
                <div className="product-visual">
                  {getAssetUrl(product.imageUrl) ? (
                    <img src={getAssetUrl(product.imageUrl)} alt={product.name} />
                  ) : (
                    <ChefHat size={34} />
                  )}
                </div>
                <div className="product-copy">
                  <div>
                    <span className="category-chip">{product.category?.name}</span>
                    {discountLabel ? <span className="discount-badge">{discountLabel}</span> : null}
                    <h3>{product.name}</h3>
                    <p>{product.description || 'Produto local disponível no ambiente.'}</p>
                    <span className="mini-contact">
                      <Phone size={14} />
                      {product.seller?.phone || 'Telefone não informado'}
                    </span>
                    {isOwnProduct ? <span className="mini-contact">Seu produto</span> : null}
                  </div>
                  <div className="product-footer">
                    <div>
                      <strong>
                        {hasVariablePrice ? `A partir de ${money.format(lowestPrice)}` : money.format(getOptionPrice(product))}
                      </strong>
                      {discountLabel ? <small className="old-price">{money.format(Number(product.price))}</small> : null}
                      <span>{product.quantity} disponíveis</span>
                    </div>
                    <button
                      className="icon-button primary"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        if (productOptions.length > 0) {
                          onOpen(product)
                          return
                        }

                        onAdd(product)
                      }}
                      disabled={isUnavailable}
                      title={
                        isOwnProduct
                          ? 'Você não pode comprar seu próprio produto'
                          : product.quantity > 0
                            ? 'Adicionar ao carrinho'
                            : 'Produto sem estoque'
                      }
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {products.length === 0 ? <EmptyState text="Nenhum produto encontrado." /> : null}
      </div>

      <aside className="side-panel">
        <PanelHeader icon={ShieldCheck} title="Compra local" />
        <p>
          Produtos aparecem apenas para pessoas do mesmo ambiente. Pagamento e
          retirada são combinados diretamente com o vendedor.
        </p>
        <div className="info-list">
          <span><Wallet size={16} /> Pix, dinheiro ou cartão presencial</span>
          <span><MapPin size={16} /> Retirada, entrega interna ou ponto de encontro</span>
          <span><Store size={16} /> Vendedores do seu ambiente</span>
        </div>
      </aside>
    </section>
  )
}

function ProductDetailModal({
  product,
  feedback,
  loading,
  currentUserId,
  onClose,
  onAdd,
  onBuyNow,
  onReview,
  reviewSubmitting,
}) {
  const reviews = feedback?.reviews || []
  const flavors = parseProductFlavors(product.flavors)
  const productImages = getProductImages(product)
  const [activeImage, setActiveImage] = useState(() => productImages[0] || '')
  const sellerImage = getAssetUrl(product.seller?.profileImageUrl)
  const isOwnProduct = Number(product.seller?.id || product.userId) === Number(currentUserId)
  const isUnavailable = product.quantity <= 0 || isOwnProduct
  const myReview = reviews.find((review) => Number(review.user?.id) === Number(currentUserId))
  const [selectedFlavor, setSelectedFlavor] = useState(() => flavors[0]?.name || '')
  const selectedOption = flavors.find((flavor) => flavor.name === selectedFlavor)
  const selectedUnitPrice = getOptionPrice(product, selectedOption)
  const selectedOriginalPrice = getOptionOriginalPrice(product, selectedOption)
  const discountLabel = formatDiscount(product)
  const [reviewForm, setReviewForm] = useState(() => ({
    rating: myReview?.rating || 5,
    comment: myReview?.comment || '',
  }))

  async function submitReview(event) {
    event.preventDefault()
    await onReview(product.id, reviewForm)
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="product-modal" role="dialog" aria-modal="true" aria-label={`Detalhes de ${product.name}`}>
        <button className="icon-button modal-close" type="button" onClick={onClose} title="Fechar">
          <X size={18} />
        </button>

        <div className="product-modal-visual">
          <div className="gallery-main">
            {activeImage ? <img src={activeImage} alt={product.name} /> : <ChefHat size={42} />}
          </div>

          {productImages.length > 1 ? (
            <div className="gallery-strip">
              {productImages.map((image) => (
                <button
                  key={image}
                  className={activeImage === image ? 'gallery-thumb active' : 'gallery-thumb'}
                  type="button"
                  onClick={() => setActiveImage(image)}
                  aria-label={`Ver foto de ${product.name}`}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="product-modal-body">
          <div className="product-modal-heading">
            <span className="category-chip">{product.category?.name}</span>
            {discountLabel ? <span className="discount-badge">{discountLabel}</span> : null}
            <h2>{product.name}</h2>
            <p>{product.description || 'O vendedor ainda não adicionou uma descrição detalhada.'}</p>
          </div>

          <div className="rating-summary">
            <RatingStars value={feedback?.averageRating || 0} />
            <strong>{formatRating(feedback?.averageRating)}</strong>
            <span>{feedback?.reviewsCount || 0} avaliações</span>
          </div>

          <div className="detail-section">
            <h3>Sabores e opções</h3>
            {flavors.length > 0 ? (
              <div className="flavor-list">
                {flavors.map((flavor) => (
                  <button
                    key={flavor.name}
                    className={selectedFlavor === flavor.name ? 'active' : ''}
                    type="button"
                    onClick={() => setSelectedFlavor(flavor.name)}
                  >
                    <span>{flavor.name}</span>
                    <small>{formatPriceAdjustment(flavor.priceAdjustment)}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted-note">O vendedor ainda não informou sabores ou opções.</p>
            )}
          </div>

          <div className="seller-card">
            <div className="profile-avatar">
              {sellerImage ? <img src={sellerImage} alt={product.seller?.name} /> : <UserRound size={20} />}
            </div>
            <div>
              <strong>{product.seller?.name}</strong>
              <span><Phone size={14} /> {product.seller?.phone || 'Telefone não informado'}</span>
            </div>
          </div>

          <div className="modal-purchase-bar">
            <div>
              <strong>{money.format(selectedUnitPrice)}</strong>
              {discountLabel ? <small className="old-price">Antes {money.format(selectedOriginalPrice)}</small> : null}
              {selectedOption && selectedOption.priceAdjustment !== 0 ? (
                <small>Preço base {money.format(Number(product.price))}</small>
              ) : null}
              <span>{product.quantity} disponíveis</span>
            </div>
            <div className="purchase-actions">
              <button
                className="primary-button compact-button"
                type="button"
                onClick={() => onBuyNow({ ...product, selectedFlavor, cartUnitPrice: selectedUnitPrice })}
                disabled={isUnavailable}
              >
                <CreditCard size={18} />
                Comprar agora
              </button>
              <button
                className="ghost-button compact-button"
                type="button"
                onClick={() => onAdd({ ...product, selectedFlavor, cartUnitPrice: selectedUnitPrice })}
                disabled={isUnavailable}
              >
                <Plus size={18} />
                Carrinho
              </button>
            </div>
          </div>

          <div className="detail-section">
            <div className="section-heading compact-heading">
              <h3>Comentários</h3>
              {loading ? <span>Carregando...</span> : <span>{reviews.length} registros</span>}
            </div>

            <div className="review-list">
              {reviews.map((review) => {
                const reviewImage = getAssetUrl(review.user?.profileImageUrl)

                return (
                  <article className="review-card" key={review.id}>
                    <div className="profile-avatar">
                      {reviewImage ? <img src={reviewImage} alt={review.user?.name} /> : <UserRound size={18} />}
                    </div>
                    <div>
                      <div className="review-header">
                        <strong>{review.user?.name}</strong>
                        <RatingStars value={review.rating} />
                      </div>
                      <p>{review.comment || 'Avaliação sem comentário.'}</p>
                    </div>
                  </article>
                )
              })}
            </div>

            {!loading && reviews.length === 0 ? (
              <p className="muted-note">Nenhum cliente avaliou este produto ainda.</p>
            ) : null}

            {isOwnProduct ? (
              <p className="muted-note">Você está vendo seu próprio produto, então a avaliação fica bloqueada.</p>
            ) : (
              <form className="review-form" onSubmit={submitReview}>
                <label>
                  Sua avaliação
                  <RatingStars
                    value={reviewForm.rating}
                    onChange={(rating) => setReviewForm({ ...reviewForm, rating })}
                  />
                </label>
                <label>
                  Comentário
                  <textarea
                    value={reviewForm.comment}
                    onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })}
                    placeholder="Conte como foi o pedido"
                  />
                </label>
                <button className="primary-button compact-button" type="submit" disabled={reviewSubmitting}>
                  <Send size={17} />
                  Salvar avaliação
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function RatingStars({ value, onChange }) {
  const rating = Number(value || 0)
  const roundedRating = Math.round(rating)
  const interactive = Boolean(onChange)

  return (
    <div className={interactive ? 'rating-stars interactive' : 'rating-stars'}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= roundedRating

        return interactive ? (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            aria-label={`${star} estrelas`}
          >
            <Star size={17} fill={filled ? 'currentColor' : 'none'} />
          </button>
        ) : (
          <Star key={star} size={16} fill={filled ? 'currentColor' : 'none'} />
        )
      })}
    </div>
  )
}

function CartView({ cart, total, sellerPaymentSettings, onRemove, onQuantity, onSubmit }) {
  const [form, setForm] = useState({
    paymentMethod: 'pix',
    deliveryType: 'meeting_point',
    deliveryLocation: 'Pátio principal',
    observation: '',
    couponCode: '',
  })
  const availablePaymentMethods = getAvailablePaymentMethods(sellerPaymentSettings)
  const selectedPaymentMethod = availablePaymentMethods.includes(form.paymentMethod)
    ? form.paymentMethod
    : availablePaymentMethods[0] || form.paymentMethod

  return (
    <section className="content-grid two-columns">
      <div className="main-column">
        <div className="section-heading">
          <h2>Carrinho</h2>
          <span>{getCartItemsCount(cart)} itens</span>
        </div>

        <div className="stack">
          {cart.map((item) => {
            const unitPrice = getCartUnitPrice(item)

            return (
              <article className="line-card" key={`${item.id}-${item.selectedFlavor || 'default'}`}>
                <div className="cart-item-thumb">
                  {getAssetUrl(item.imageUrl) ? (
                    <img src={getAssetUrl(item.imageUrl)} alt="" />
                  ) : (
                    <ChefHat size={20} />
                  )}
                </div>
                <div>
                  <h3>{item.name}</h3>
                  <p>
                    {money.format(unitPrice)} cada
                    {item.selectedFlavor ? ` - ${item.selectedFlavor}` : ''}
                  </p>
                </div>
                <div className="quantity-control">
                  <button type="button" onClick={() => onQuantity(item.id, -1, item.selectedFlavor || '')}>-</button>
                  <span>{item.cartQuantity}</span>
                  <button type="button" onClick={() => onQuantity(item.id, 1, item.selectedFlavor || '')}>+</button>
                </div>
                <strong>{money.format(unitPrice * item.cartQuantity)}</strong>
                <button className="icon-button danger" type="button" onClick={() => onRemove(item.id, item.selectedFlavor || '')}>
                  <Trash2 size={18} />
                </button>
              </article>
            )
          })}
        </div>

        {cart.length === 0 ? <EmptyState text="Seu carrinho está vazio." /> : null}
      </div>

      <aside className="side-panel">
        <PanelHeader icon={CreditCard} title="Fechar pedido" />
        <div className="payment-methods">
          <span>Pagamento</span>
          <div className="payment-method-grid">
            {availablePaymentMethods.map((method) => (
              <button
                key={method}
                className={selectedPaymentMethod === method ? 'active' : ''}
                type="button"
                onClick={() => setForm({ ...form, paymentMethod: method })}
              >
                <Wallet size={16} />
                {paymentLabels[method]}
              </button>
            ))}
          </div>
          <p className="muted-note">Ambiente experimental: o pagamento será aprovado automaticamente, sem cobrança real.</p>
        </div>
        <label>
          Entrega ou retirada
          <select
            value={form.deliveryType}
            onChange={(event) => setForm({ ...form, deliveryType: event.target.value })}
          >
            {Object.entries(deliveryLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Cupom do vendedor
          <input
            value={form.couponCode}
            onChange={(event) => setForm({ ...form, couponCode: event.target.value.toUpperCase() })}
            placeholder="Ex: BROWNIE10"
          />
        </label>
        <p className="muted-note">O cupom é validado quando o pedido é enviado.</p>
        <label>
          Local combinado
          <input
            value={form.deliveryLocation}
            onChange={(event) => setForm({ ...form, deliveryLocation: event.target.value })}
            placeholder="Sala 12, pátio, portaria..."
          />
        </label>
        <label>
          Observação
          <textarea
            value={form.observation}
            onChange={(event) => setForm({ ...form, observation: event.target.value })}
            placeholder="Ex: entregar no intervalo"
          />
        </label>
        <div className="checkout-summary">
          <div className="total-row">
            <span>Subtotal</span>
            <strong>{money.format(total)}</strong>
          </div>
          <div className="total-row total-row-strong">
            <span>Total</span>
            <strong>{money.format(total)}</strong>
          </div>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => onSubmit({ ...form, paymentMethod: selectedPaymentMethod })}
        >
          <ShoppingCart size={18} />
          Enviar pedido
        </button>
      </aside>
    </section>
  )
}

function CheckoutPaymentView({ result, onOrders, onRefresh, onSimulate }) {
  const payment = result.payment || {}
  const order = result.order || {}
  const isMock = payment.isSimulated || order.isPaymentSimulated || order.paymentProvider === 'mock'
  const simulatedStatus = payment.status || (order.paymentStatus === 'paid' ? 'approved' : order.paymentStatus === 'failed' ? 'declined' : 'pending')
  const isPix = (payment.method || payment.paymentMethod) === 'pix'
  const qrImage = payment.qrCodeBase64 ? `data:image/png;base64,${payment.qrCodeBase64}` : ''
  const isConfigured = payment.failureReason !== 'MERCADO_PAGO_NOT_CONFIGURED'

  async function copyPixCode() {
    if (!payment.qrCode) return
    await navigator.clipboard.writeText(payment.qrCode)
  }

  return (
    <section className="content-grid two-columns">
      <div className="main-column">
        <div className="payment-confirmation">
          <div>
            <span className="category-chip">Pedido #{order.id}</span>
            <h2>{isMock ? 'Simular pagamento' : 'Finalize o pagamento'}</h2>
            <p>
              {isMock
                ? 'Escolha abaixo como o pagamento deve responder neste teste. Nenhuma cobrança real será realizada.'
                : 'O vendedor recebe o pedido com segurança depois que o gateway confirmar o valor integral.'}
            </p>
          </div>

          <div className="payment-total-card">
            <span>Total da compra</span>
            <strong>{money.format(Number(order.totalPrice || payment.amount || 0))}</strong>
            <small>{paymentLabels[order.paymentMethod] || paymentLabels[payment.method || payment.paymentMethod]}</small>
          </div>

          {isMock ? (
            <div className="mock-payment-panel">
              <div className="experimental-banner">
                <ShieldCheck size={19} />
                <div>
                  <strong>Pagamento simulado</strong>
                  <span>Use estes controles apenas para validar o fluxo do pedido.</span>
                </div>
              </div>
              <div className={`mock-payment-status ${simulatedStatus}`}>
                Status atual: <strong>{simulatedStatus === 'approved' ? 'Aprovado' : simulatedStatus === 'declined' ? 'Recusado' : 'Pendente'}</strong>
              </div>
              <div className="mock-payment-actions">
                <button type="button" className="success-action" onClick={() => onSimulate(order.id, 'approved')}>
                  <Check size={17} /> Aprovar
                </button>
                <button type="button" className="pending-action" onClick={() => onSimulate(order.id, 'pending')}>
                  <History size={17} /> Deixar pendente
                </button>
                <button type="button" className="danger-action" onClick={() => onSimulate(order.id, 'declined')}>
                  <X size={17} /> Recusar
                </button>
              </div>
            </div>
          ) : !isConfigured ? (
            <div className="notice">
              Configure o Mercado Pago no servidor para gerar pagamentos reais.
            </div>
          ) : null}

          {!isMock && isPix ? (
            <div className="pix-panel">
              <div className="pix-qr">
                {qrImage ? <img src={qrImage} alt="QR Code Pix" /> : <Wallet size={48} />}
              </div>
              <div>
                <h3>Pix dinâmico</h3>
                <p>
                  O QR Code já vem com o valor exato. O pedido será liberado automaticamente quando o pagamento for aprovado.
                </p>
                {payment.qrCode ? (
                  <button className="ghost-button compact-button" type="button" onClick={copyPixCode}>
                    <Copy size={16} />
                    Copiar código Pix
                  </button>
                ) : null}
                {payment.checkoutUrl ? (
                  <a className="external-link" href={payment.checkoutUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} />
                    Abrir pagamento
                  </a>
                ) : null}
              </div>
            </div>
          ) : !isMock ? (
            <div className="pix-panel">
              <div className="pix-qr">
                <CreditCard size={48} />
              </div>
              <div>
                <h3>Checkout seguro</h3>
                <p>
                  O cartão é processado pelo ambiente seguro do gateway. O TimeOut não armazena dados de cartão.
                </p>
                {payment.checkoutUrl ? (
                  <a className="primary-button compact-button external-link-button" href={payment.checkoutUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} />
                    Ir para o pagamento
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="side-panel">
        <PanelHeader icon={ShieldCheck} title={isMock ? 'Ambiente de teste' : 'Confirmação automática'} />
        <div className="info-list">
          <span><BadgeCheck size={16} /> {isMock ? 'Nenhum valor será cobrado' : 'Webhook confirma pagamento aprovado'}</span>
          <span><Wallet size={16} /> O vendedor só avança após aprovação</span>
          <span><ClipboardList size={16} /> Resultado registrado para auditoria</span>
        </div>
        <button className="primary-button" type="button" onClick={onRefresh}>
          <RefreshCcw size={18} />
          Atualizar status
        </button>
        <button className="ghost-button wide" type="button" onClick={onOrders}>
          Ver histórico de compras
        </button>
      </aside>
    </section>
  )
}

function PaymentSettingsView({ settings, onSave }) {
  const [form, setForm] = useState(() => ({ ...defaultPaymentSettings, ...settings }))

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <section className="content-grid two-columns">
      <div className="main-column">
        <div className="section-heading">
          <h2>Formas de pagamento</h2>
          <span>configuração do vendedor</span>
        </div>

        <div className="payment-settings-grid">
          {Object.entries(paymentMethodSettingFields).map(([method, field]) => (
            <label className="payment-toggle-card" key={method}>
              <input
                type="checkbox"
                checked={Boolean(form[field])}
                onChange={(event) => updateField(field, event.target.checked)}
              />
              <span>
                <strong>{paymentLabels[method]}</strong>
                <small>
                  {onlinePaymentMethods.includes(method)
                    ? 'Pagamento online com confirmação automática'
                    : 'Pagamento combinado fora do app'}
                </small>
              </span>
            </label>
          ))}
        </div>
      </div>

      <aside className="side-panel">
        <PanelHeader icon={CreditCard} title="Modo experimental" />
        <div className="experimental-banner compact-banner">
          <ShieldCheck size={18} />
          <div>
            <strong>Pagamentos simulados</strong>
            <span>Estas opções definem o que aparece no checkout, sem movimentar dinheiro.</span>
          </div>
        </div>
        <label>
          Identificação de teste
          <input value="Simulador interno TimeOut" disabled />
        </label>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={Boolean(form.isActive)}
            onChange={(event) => updateField('isActive', event.target.checked)}
          />
          Pagamentos ativos
        </label>
        <p className="muted-note">
          A integração com pagamento real permanece desativada nesta fase de validação.
        </p>
        <button className="primary-button" type="button" onClick={() => onSave(form)}>
          <Check size={18} />
          Salvar formas de pagamento
        </button>
      </aside>
    </section>
  )
}

function SalesDashboard({ orders, products }) {
  const [activeDayIndex, setActiveDayIndex] = useState(6)
  const deliveredOrders = orders.filter((order) => order.status === 'delivered')
  const grossTotal = deliveredOrders.reduce((sum, order) => sum + Number(order.grossSalesAmount || order.totalPrice), 0)
  const platformFeeTotal = deliveredOrders.reduce((sum, order) => sum + getOrderPlatformFee(order), 0)
  const sellerNetTotal = deliveredOrders.reduce((sum, order) => sum + getOrderSellerNet(order), 0)
  const pendingOrders = orders.filter((order) => ['pending', 'accepted', 'preparing', 'ready'].includes(order.status)).length
  const averageTicket = deliveredOrders.length ? grossTotal / deliveredOrders.length : 0
  const lastSevenDays = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    return date
  })
  const dailySales = lastSevenDays.map((date) => {
    const nextDate = new Date(date)
    nextDate.setDate(date.getDate() + 1)
    const total = deliveredOrders
      .filter((order) => {
        const orderDate = new Date(order.createdAt)
        return orderDate >= date && orderDate < nextDate
      })
      .reduce((sum, order) => sum + getOrderSellerNet(order), 0)

    return {
      label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      total,
    }
  })
  const maxDailyTotal = Math.max(...dailySales.map((day) => day.total), 1)
  const productTotals = new Map()

  deliveredOrders.forEach((order) => {
    order.items.forEach((item) => {
      const current = productTotals.get(item.product.id) || {
        name: item.product.name,
        quantity: 0,
        total: 0,
      }

      current.quantity += item.quantity
      current.total += Number(item.subtotal)
      productTotals.set(item.product.id, current)
    })
  })

  const topProducts = Array.from(productTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)

  function exportSalesReport() {
    const rows = [
      ['Data', 'Receita líquida'],
      ...dailySales.map((day) => [day.label, day.total.toFixed(2).replace('.', ',')]),
    ]
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `relatorio-vendas-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="content-grid two-columns">
      <div className="main-column">
        <div className="section-heading">
          <div>
            <h2>Resumo de vendas</h2>
            <p className="section-subtitle">Acompanhe o desempenho dos últimos sete dias.</p>
          </div>
          <div className="heading-actions">
            <span>{orders.length} pedidos recebidos</span>
            <button className="export-button" type="button" onClick={exportSalesReport}>
              <Download size={15} />
              Exportar
            </button>
          </div>
        </div>

        <div className="metrics-grid">
          <article className="metric-card">
            <span>Faturamento bruto</span>
            <strong>{money.format(grossTotal)}</strong>
          </article>
          <article className="metric-card">
            <span>Comissões TimeOut</span>
            <strong>{money.format(platformFeeTotal)}</strong>
          </article>
          <article className="metric-card">
            <span>Receita líquida</span>
            <strong>{money.format(sellerNetTotal)}</strong>
          </article>
          <article className="metric-card">
            <span>Pedidos em aberto</span>
            <strong>{pendingOrders}</strong>
          </article>
          <article className="metric-card">
            <span>Ticket médio</span>
            <strong>{money.format(averageTicket)}</strong>
          </article>
          <article className="metric-card">
            <span>Produtos cadastrados</span>
            <strong>{products.length}</strong>
          </article>
        </div>

        <div className="chart-card">
          <div className="section-heading compact-heading">
            <h3>Receita líquida dos últimos 7 dias</h3>
            <span>{money.format(sellerNetTotal)}</span>
          </div>
          <div className="bar-chart">
            {dailySales.map((day) => (
              <button
                className={activeDayIndex === dailySales.indexOf(day) ? 'bar-column active' : 'bar-column'}
                key={day.label}
                type="button"
                onClick={() => setActiveDayIndex(dailySales.indexOf(day))}
                title={`${day.label}: ${money.format(day.total)}`}
              >
                <div className="bar-track">
                  <span style={{ height: `${Math.max(8, (day.total / maxDailyTotal) * 100)}%` }} />
                </div>
                <strong>{day.label}</strong>
                <small>{money.format(day.total)}</small>
              </button>
            ))}
          </div>
          <div className="chart-selection">
            <span>Dia selecionado: <strong>{dailySales[activeDayIndex]?.label}</strong></span>
            <span>Receita líquida: <strong>{money.format(dailySales[activeDayIndex]?.total || 0)}</strong></span>
          </div>
        </div>
      </div>

      <aside className="side-panel">
        <PanelHeader icon={BarChart3} title="Mais vendidos" />
        <div className="ranking-list">
          {topProducts.map((product, index) => (
            <article key={product.name}>
              <span>{index + 1}</span>
              <div>
                <strong>{product.name}</strong>
                <small>{product.quantity} unidades - {money.format(product.total)}</small>
              </div>
            </article>
          ))}
        </div>
        {topProducts.length === 0 ? <p>Nenhuma venda entregue ainda.</p> : null}
      </aside>
    </section>
  )
}

function OrdersView({ orders, mode, onCancel, onStatus, title }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [orderSearch, setOrderSearch] = useState('')
  const normalizedSearch = orderSearch.trim().toLocaleLowerCase('pt-BR')
  const visibleOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    const contactName = mode === 'seller' ? order.customer?.name : order.seller?.name
    const matchesSearch = !normalizedSearch || [
      String(order.id),
      contactName,
      ...order.items.map((item) => item.product?.name),
    ].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(normalizedSearch))

    return matchesStatus && matchesSearch
  })

  return (
    <section className="main-column full">
      <div className="orders-header">
        <div>
          <h2>{title || (mode === 'seller' ? 'Pedidos recebidos' : 'Histórico de compras')}</h2>
          <p>Consulte pedidos, produtos e atualizações de status.</p>
        </div>
        <div className="orders-search search-field">
          <Search size={17} />
          <input
            value={orderSearch}
            onChange={(event) => setOrderSearch(event.target.value)}
            placeholder="Buscar pedido ou produto"
          />
        </div>
      </div>

      <div className="order-filters" aria-label="Filtrar pedidos por status">
        {[
          ['all', 'Todos'],
          ['pending', 'Pendentes'],
          ['preparing', 'Preparando'],
          ['ready', 'Prontos'],
          ['delivered', 'Entregues'],
          ['canceled', 'Cancelados'],
        ].map(([value, label]) => (
          <button
            className={statusFilter === value ? 'active' : ''}
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </button>
        ))}
        <span>{visibleOrders.length} de {orders.length}</span>
      </div>

      <div className="order-grid">
        {visibleOrders.map((order) => (
          <article className="order-card" key={order.id}>
            <header>
              <div>
                <span className={`status-badge ${order.status}`}>{statusLabels[order.status]}</span>
                <h3>Pedido #{order.id}</h3>
              </div>
              <strong>{money.format(Number(order.totalPrice))}</strong>
            </header>

            {order.items[0] ? (
              <div className="order-preview">
                <div className="order-preview-image">
                  {getAssetUrl(order.items[0].product?.imageUrl) ? (
                    <img src={getAssetUrl(order.items[0].product.imageUrl)} alt="" />
                  ) : (
                    <ChefHat size={20} />
                  )}
                </div>
                <div>
                  <strong>{order.items[0].product.name}</strong>
                  <span>
                    {order.items[0].quantity} unidade(s)
                    {order.items.length > 1 ? ` e mais ${order.items.length - 1} item(ns)` : ''}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="order-meta">
              <span><UserRound size={15} /> {mode === 'seller' ? order.customer.name : order.seller.name}</span>
              <span><Phone size={15} /> {mode === 'seller' ? order.customer.phone : order.seller.phone}</span>
              <span><Wallet size={15} /> {paymentLabels[order.paymentMethod]}</span>
              <span><CreditCard size={15} /> {paymentStatusLabels[order.paymentStatus] || 'Pagamento pendente'}</span>
              {order.isPaymentSimulated || order.paymentProvider === 'mock' ? (
                <span><ShieldCheck size={15} /> Pagamento simulado</span>
              ) : null}
              {Number(order.couponDiscount || 0) > 0 ? (
                <span><Percent size={15} /> Cupom {order.couponCode}: -{money.format(Number(order.couponDiscount))}</span>
              ) : null}
              {mode === 'seller' ? (
                <>
                  <span>
                    <Percent size={15} /> Comissão TimeOut ({formatPercent(order.commissionRate ?? order.platformFeeRate)}):{' '}
                    {order.status === 'delivered' ? `-${money.format(getOrderPlatformFee(order))}` : 'confirmada na entrega'}
                  </span>
                  <span>
                    <Wallet size={15} /> Receita líquida:{' '}
                    {order.status === 'delivered' ? money.format(getOrderSellerNet(order)) : 'aguardando entrega'}
                  </span>
                </>
              ) : null}
              <span><MapPin size={15} /> {order.deliveryLocation || deliveryLabels[order.deliveryType]}</span>
              <span><History size={15} /> {formatDate(order.createdAt)}</span>
            </div>

            <ul className="items-list">
              {order.items.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.quantity}x {item.product.name}
                    {item.selectedFlavor ? ` - ${item.selectedFlavor}` : ''}
                  </span>
                  <strong>{money.format(Number(item.subtotal))}</strong>
                </li>
              ))}
            </ul>

            {mode === 'customer' && order.status === 'pending' ? (
              <button className="ghost-button danger-text" type="button" onClick={() => onCancel(order.id)}>
                <X size={17} />
                Cancelar pedido
              </button>
            ) : null}

            {mode === 'seller' &&
            order.paymentProvider !== 'mock' &&
            onlinePaymentMethods.includes(order.paymentMethod) &&
            order.paymentStatus !== 'paid' &&
            !['canceled', 'refused'].includes(order.status) ? (
              <p className="muted-note">Aguarde a confirmação automática do pagamento para avançar este pedido.</p>
            ) : null}

            {mode === 'seller' &&
            !['delivered', 'canceled', 'refused'].includes(order.status) &&
            (order.paymentProvider === 'mock' || !onlinePaymentMethods.includes(order.paymentMethod) || order.paymentStatus === 'paid') ? (
              <div className="status-actions">
                {sellerStatusOptions.map((status) => (
                  <button key={status} type="button" onClick={() => onStatus(order.id, status)}>
                    {statusLabels[status]}
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {visibleOrders.length === 0 ? <EmptyState text="Nenhum pedido encontrado neste filtro." /> : null}
    </section>
  )
}

function SellerProductsView({ products, categories, onSave, onToggle, onDelete }) {
  const emptyForm = {
    name: '',
    description: '',
    flavors: [],
    price: '',
    discountType: '',
    discountValue: '',
    discountStartsAt: '',
    discountEndsAt: '',
    quantity: '',
    categoryId: '',
    imageUrl: '',
    imageGallery: '',
    imageFile: null,
    galleryFiles: [],
    isActive: true,
  }
  const [editingProduct, setEditingProduct] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [productSearch, setProductSearch] = useState('')
  const [productStatus, setProductStatus] = useState('all')
  const imageFilePreview = useMemo(
    () => (form.imageFile ? URL.createObjectURL(form.imageFile) : null),
    [form.imageFile],
  )
  const galleryFilePreviews = useMemo(
    () => form.galleryFiles.map((file) => URL.createObjectURL(file)),
    [form.galleryFiles],
  )
  const preview = imageFilePreview || getAssetUrl(form.imageUrl)
  const galleryPreviews = [
    ...parseProductGallery(form.imageGallery).map((image) => getAssetUrl(image)).filter(Boolean),
    ...galleryFilePreviews,
  ]
  const normalizedProductSearch = productSearch.trim().toLocaleLowerCase('pt-BR')
  const visibleProducts = products.filter((product) => {
    const matchesSearch = !normalizedProductSearch || [
      product.name,
      product.description,
      product.category?.name,
    ].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(normalizedProductSearch))
    const matchesStatus = productStatus === 'all'
      || (productStatus === 'active' && product.isActive && product.quantity > 0)
      || (productStatus === 'paused' && !product.isActive)
      || (productStatus === 'out-of-stock' && product.quantity <= 0)

    return matchesSearch && matchesStatus
  })

  useEffect(() => {
    return () => {
      if (imageFilePreview) URL.revokeObjectURL(imageFilePreview)
    }
  }, [imageFilePreview])

  useEffect(() => {
    return () => {
      galleryFilePreviews.forEach((previewUrl) => URL.revokeObjectURL(previewUrl))
    }
  }, [galleryFilePreviews])

  function resetForm() {
    setEditingProduct(null)
    setForm(emptyForm)
  }

  function editProduct(product) {
    setEditingProduct(product)
    setForm({
      name: product.name,
      description: product.description || '',
      flavors: parseProductFlavors(product.flavors),
      price: product.price,
      discountType: product.discountType || '',
      discountValue: product.discountValue || '',
      discountStartsAt: toDateTimeInput(product.discountStartsAt),
      discountEndsAt: toDateTimeInput(product.discountEndsAt),
      quantity: String(product.quantity),
      categoryId: String(product.categoryId),
      imageUrl: product.imageUrl || '',
      imageGallery: JSON.stringify(parseProductGallery(product.imageGallery)),
      imageFile: null,
      galleryFiles: [],
      isActive: product.isActive,
    })
  }

  async function submit(event) {
    event.preventDefault()
    await onSave(
      {
        ...form,
        price: parseMoneyValue(form.price),
        discountType: form.discountType || '',
        discountValue: form.discountType ? parseMoneyValue(form.discountValue) : '',
        discountStartsAt: form.discountType ? form.discountStartsAt || '' : '',
        discountEndsAt: form.discountType ? form.discountEndsAt || '' : '',
        flavors: form.flavors
          .map((option) => ({
            name: option.name.trim(),
            priceAdjustment: parseMoneyValue(option.priceAdjustment),
          }))
          .filter((option) => option.name),
        quantity: Number(form.quantity),
        categoryId: Number(form.categoryId || categories[0]?.id),
        isActive: Boolean(form.isActive),
        imageGallery: form.imageGallery,
      },
      editingProduct?.id,
    )
    resetForm()
  }

  function addProductOption() {
    setForm((current) => ({
      ...current,
      flavors: [...current.flavors, { name: '', priceAdjustment: 0 }],
    }))
  }

  function updateProductOption(index, patch) {
    setForm((current) => ({
      ...current,
      flavors: current.flavors.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...patch } : option
      ),
    }))
  }

  function removeProductOption(index) {
    setForm((current) => ({
      ...current,
      flavors: current.flavors.filter((_, optionIndex) => optionIndex !== index),
    }))
  }

  return (
    <section className="content-grid two-columns">
      <div className="main-column">
        <div className="section-heading">
          <h2>Meus produtos</h2>
          <span>{visibleProducts.length} de {products.length} produtos</span>
        </div>

        <div className="product-management-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Buscar produto"
            />
          </div>
          <select value={productStatus} onChange={(event) => setProductStatus(event.target.value)}>
            <option value="all">Todos os produtos</option>
            <option value="active">Ativos</option>
            <option value="paused">Pausados</option>
            <option value="out-of-stock">Sem estoque</option>
          </select>
        </div>

        <div className="stack">
          {visibleProducts.map((product) => (
            <article className="line-card product-line" key={product.id}>
              <div className="product-thumb">
                {getAssetUrl(product.imageUrl) ? (
                  <img src={getAssetUrl(product.imageUrl)} alt={product.name} />
                ) : (
                  <ChefHat size={18} />
                )}
              </div>
              <div>
                <h3>{product.name}</h3>
                <p>
                  {product.quantity} em estoque - {money.format(getOptionPrice(product))}
                  {parseProductFlavors(product.flavors).length > 0
                    ? ` - ${parseProductFlavors(product.flavors).length} opções`
                    : ''}
                </p>
                {formatDiscount(product) ? <span className="discount-badge">{formatDiscount(product)}</span> : null}
              </div>
              <span className={product.isActive ? 'mini-status active' : 'mini-status'}>
                {product.isActive ? 'Ativo' : 'Inativo'}
              </span>
              <div className="row-actions">
                <button className="icon-button" type="button" onClick={() => editProduct(product)} title="Editar produto">
                  <Pencil size={17} />
                </button>
                <button className="ghost-button" type="button" onClick={() => onToggle(product)}>
                  {product.isActive ? 'Pausar' : 'Ativar'}
                </button>
                <button className="icon-button danger" type="button" onClick={() => onDelete(product.id)} title="Remover produto">
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
        {visibleProducts.length === 0 ? <EmptyState text="Nenhum produto encontrado neste filtro." /> : null}
      </div>

      <form className="side-panel" onSubmit={submit}>
        <PanelHeader icon={editingProduct ? Pencil : Plus} title={editingProduct ? 'Editar produto' : 'Novo produto'} />
        <div className="image-picker">
          <div className="image-preview">
            {preview ? <img src={preview} alt="Prévia do produto" /> : <Camera size={26} />}
          </div>
          <label className="file-button">
            <Camera size={16} />
            Alterar imagem
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setForm({ ...form, imageFile: event.target.files?.[0] || null })}
            />
          </label>
        </div>
        <div className="detail-section">
          <label>
            Fotos extras do detalhe
            <textarea
              value={form.imageGallery}
              onChange={(event) => setForm({ ...form, imageGallery: event.target.value })}
              placeholder="URLs de imagens extras, uma por linha"
            />
          </label>
          <label className="file-button">
            <ImagePlus size={16} />
            Adicionar fotos extras
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setForm({
                ...form,
                galleryFiles: Array.from(event.target.files || []).slice(0, 8),
              })}
            />
          </label>
          {galleryPreviews.length > 0 ? (
            <div className="gallery-preview-grid">
              {galleryPreviews.map((image) => (
                <img key={image} src={image} alt="Foto extra do produto" />
              ))}
            </div>
          ) : null}
        </div>
        <label>
          Nome
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
            placeholder="Coxinha"
          />
        </label>
        <label>
          Descrição
          <textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Detalhes do produto"
          />
        </label>
        <div className="option-editor">
          <div className="option-editor-heading">
            <div>
              <strong>Opções e variações</strong>
              <span>Cadastre acréscimos ou descontos sobre o preço base.</span>
            </div>
            <button className="ghost-button" type="button" onClick={addProductOption}>
              <Plus size={16} />
              Adicionar
            </button>
          </div>
          {form.flavors.map((option, index) => (
            <div className="option-row" key={index}>
              <label>
                Nome da opção
                <input
                  value={option.name}
                  onChange={(event) => updateProductOption(index, { name: event.target.value })}
                  placeholder="Ex: Recheado com brigadeiro"
                />
              </label>
              <label>
                Acréscimo/desconto
                <input
                  type="number"
                  step="0.01"
                  value={option.priceAdjustment}
                  onChange={(event) => updateProductOption(index, { priceAdjustment: event.target.value })}
                  placeholder="0,00"
                />
              </label>
              <button className="icon-button danger" type="button" onClick={() => removeProductOption(index)} title="Remover opção">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {form.flavors.length === 0 ? (
            <p className="muted-note">
              Exemplo: Brownie recheado com brigadeiro + R$ 2,00 ou Brownie grande + R$ 6,00.
            </p>
          ) : null}
        </div>
        <label>
          Categoria
          <select
            value={form.categoryId}
            onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
            required
          >
            <option value="">Selecione</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Preço base
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
              required
            />
          </label>
          <label>
            Estoque
            <input
              type="number"
              min="0"
              value={form.quantity}
              onChange={(event) => setForm({ ...form, quantity: event.target.value })}
              required
            />
          </label>
        </div>
        <div className="option-editor">
          <div className="option-editor-heading">
            <div>
              <strong>Desconto temporário</strong>
              <span>Use para promoções rápidas do produto.</span>
            </div>
          </div>
          <label>
            Tipo de desconto
            <select
              value={form.discountType}
              onChange={(event) => setForm({
                ...form,
                discountType: event.target.value,
                discountValue: event.target.value ? form.discountValue : '',
                discountStartsAt: event.target.value ? form.discountStartsAt : '',
                discountEndsAt: event.target.value ? form.discountEndsAt : '',
              })}
            >
              <option value="">Sem desconto</option>
              <option value="percentage">Percentual</option>
              <option value="fixed">Valor fixo</option>
            </select>
          </label>
          {form.discountType ? (
            <>
              <label>
                Valor do desconto
                <input
                  type="number"
                  min="0"
                  max={form.discountType === 'percentage' ? 90 : undefined}
                  step="0.01"
                  value={form.discountValue}
                  onChange={(event) => setForm({ ...form, discountValue: event.target.value })}
                  placeholder={form.discountType === 'percentage' ? '10' : '2,00'}
                />
              </label>
              <div className="form-row">
                <label>
                  Começa em
                  <input
                    type="datetime-local"
                    value={form.discountStartsAt}
                    onChange={(event) => setForm({ ...form, discountStartsAt: event.target.value })}
                  />
                </label>
                <label>
                  Termina em
                  <input
                    type="datetime-local"
                    value={form.discountEndsAt}
                    onChange={(event) => setForm({ ...form, discountEndsAt: event.target.value })}
                  />
                </label>
              </div>
            </>
          ) : null}
        </div>
        <button className="primary-button" type="submit">
          <Check size={18} />
          {editingProduct ? 'Salvar alterações' : 'Salvar produto'}
        </button>
        {editingProduct ? (
          <button className="ghost-button wide" type="button" onClick={resetForm}>
            Cancelar edição
          </button>
        ) : null}
      </form>
    </section>
  )
}

function CouponManagerView({ coupons, onSave, onToggle, onDelete }) {
  const emptyForm = {
    id: null,
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: '',
    startsAt: '',
    endsAt: '',
    usageLimit: '',
    isActive: true,
  }
  const [form, setForm] = useState(emptyForm)

  async function submit(event) {
    event.preventDefault()
    await onSave(
      {
        code: form.code,
        description: form.description,
        discountType: form.discountType,
        discountValue: parseMoneyValue(form.discountValue),
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        isActive: Boolean(form.isActive),
      },
      form.id,
    )
    setForm(emptyForm)
  }

  function editCoupon(coupon) {
    setForm({
      id: coupon.id,
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      startsAt: toDateTimeInput(coupon.startsAt),
      endsAt: toDateTimeInput(coupon.endsAt),
      usageLimit: coupon.usageLimit || '',
      isActive: coupon.isActive,
    })
  }

  return (
    <section className="content-grid two-columns">
      <div className="main-column">
        <div className="section-heading">
          <h2>Cupons e promoções</h2>
          <span>{coupons.length} cupons</span>
        </div>

        <div className="stack">
          {coupons.map((coupon) => (
            <article className="line-card coupon-line" key={coupon.id}>
              <div className="product-thumb">
                <Percent size={18} />
              </div>
              <div>
                <h3>{coupon.code}</h3>
                <p>
                  {coupon.discountType === 'percentage'
                    ? `${Number(coupon.discountValue)}% de desconto`
                    : `${money.format(Number(coupon.discountValue))} de desconto`}
                  {coupon.endsAt ? ` - até ${formatDate(coupon.endsAt)}` : ''}
                </p>
                <span className="mini-contact">{coupon.usedCount} usos{coupon.usageLimit ? ` de ${coupon.usageLimit}` : ''}</span>
              </div>
              <span className={coupon.isActive ? 'mini-status active' : 'mini-status'}>
                {coupon.isActive ? 'Ativo' : 'Inativo'}
              </span>
              <div className="row-actions">
                <button className="icon-button" type="button" onClick={() => editCoupon(coupon)} title="Editar cupom">
                  <Pencil size={17} />
                </button>
                <button className="ghost-button" type="button" onClick={() => onToggle(coupon)}>
                  {coupon.isActive ? 'Pausar' : 'Ativar'}
                </button>
                <button className="icon-button danger" type="button" onClick={() => onDelete(coupon.id)} title="Remover cupom">
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>

        {coupons.length === 0 ? <EmptyState text="Nenhum cupom criado ainda." /> : null}
      </div>

      <form className="side-panel" onSubmit={submit}>
        <PanelHeader icon={Percent} title={form.id ? 'Editar cupom' : 'Novo cupom'} />
        <label>
          Código
          <input
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
            placeholder="BROWNIE10"
            required
          />
        </label>
        <label>
          Descrição
          <input
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Promoção do intervalo"
          />
        </label>
        <div className="form-row">
          <label>
            Tipo
            <select
              value={form.discountType}
              onChange={(event) => setForm({ ...form, discountType: event.target.value })}
            >
              <option value="percentage">Percentual</option>
              <option value="fixed">Valor fixo</option>
            </select>
          </label>
          <label>
            Valor
            <input
              type="number"
              min="0"
              max={form.discountType === 'percentage' ? 90 : undefined}
              step="0.01"
              value={form.discountValue}
              onChange={(event) => setForm({ ...form, discountValue: event.target.value })}
              required
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Começa em
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
            />
          </label>
          <label>
            Termina em
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
            />
          </label>
        </div>
        <label>
          Limite de usos
          <input
            type="number"
            min="1"
            value={form.usageLimit}
            onChange={(event) => setForm({ ...form, usageLimit: event.target.value })}
            placeholder="Deixe vazio para ilimitado"
          />
        </label>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
          />
          Cupom ativo
        </label>
        <button className="primary-button" type="submit">
          <Check size={18} />
          {form.id ? 'Salvar cupom' : 'Criar cupom'}
        </button>
        {form.id ? (
          <button className="ghost-button wide" type="button" onClick={() => setForm(emptyForm)}>
            Cancelar edição
          </button>
        ) : null}
      </form>
    </section>
  )
}

function getPlanFeatures(plan) {
  if (Array.isArray(plan?.features)) return plan.features
  try {
    const parsed = JSON.parse(plan?.features || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function PlansView({ plans, subscription, userRole, onChoose, onProfile }) {
  const activeCode = subscription?.plan?.code
  const canChoose = userRole === 'seller'

  return (
    <section className="main-column full monetization-page">
      <div className="section-heading plans-heading">
        <div>
          <span className="eyebrow">Modelo comercial experimental</span>
          <h2>Planos para vender no TimeOut</h2>
          <p className="section-subtitle">Compare mensalidade e comissão. Nenhuma cobrança real é feita nesta fase.</p>
        </div>
        <span className="experimental-pill"><ShieldCheck size={15} /> Ambiente de teste</span>
      </div>

      <div className="plans-grid">
        {plans.map((plan) => {
          const isActive = plan.code === activeCode
          const isInstitutional = plan.code === 'institutional'

          return (
            <article className={`plan-card ${plan.code === 'pro' ? 'featured' : ''}`} key={plan.id}>
              <div className="plan-card-header">
                <div className="plan-icon">{plan.code === 'pro' ? <Crown size={22} /> : plan.code === 'institutional' ? <Building2 size={22} /> : <Store size={22} />}</div>
                {isActive ? <span className="active-plan-badge"><Check size={14} /> Plano atual</span> : null}
              </div>
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <div className="plan-price">
                <strong>{money.format(Number(plan.monthlyPrice))}</strong>
                <span>/mês</span>
              </div>
              <div className="commission-highlight">
                <span>Comissão por venda entregue</span>
                <strong>{formatPercent(plan.commissionRate)}</strong>
              </div>
              <ul className="plan-features">
                {getPlanFeatures(plan).map((feature) => (
                  <li key={feature}><Check size={15} /> {feature}</li>
                ))}
              </ul>
              {isInstitutional ? (
                <button className="ghost-button wide" type="button" disabled>Configurado pelo administrador</button>
              ) : canChoose ? (
                <button className={isActive ? 'ghost-button wide' : 'primary-button wide'} type="button" onClick={() => onChoose(plan.code)} disabled={isActive}>
                  {isActive ? 'Plano ativo' : `Testar plano ${plan.name}`}
                </button>
              ) : (
                <button className="primary-button wide" type="button" onClick={onProfile}>Solicitar perfil de vendedor</button>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function SellerFinancialView({ overview, onPlans }) {
  if (!overview) return <EmptyState text="Carregando dados financeiros..." />

  const { subscription, summary, transactions = [] } = overview
  const plan = subscription?.plan

  return (
    <section className="main-column full monetization-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Financeiro experimental</span>
          <h2>Receita e comissões</h2>
          <p className="section-subtitle">Os valores só são confirmados quando o pedido é marcado como entregue.</p>
        </div>
        <button className="ghost-button" type="button" onClick={onPlans}><Crown size={16} /> Ver planos</button>
      </div>

      <div className="financial-plan-strip">
        <div>
          <span>Plano atual</span>
          <strong>{plan?.name || 'Básico'}</strong>
        </div>
        <div>
          <span>Mensalidade simulada</span>
          <strong>{money.format(Number(subscription?.monthlyPrice || 0))}</strong>
        </div>
        <div>
          <span>Comissão</span>
          <strong>{formatPercent(subscription?.commissionRate)}</strong>
        </div>
        <span className="experimental-pill"><ShieldCheck size={15} /> Sem cobrança real</span>
      </div>

      <div className="metrics-grid financial-metrics">
        <article className="metric-card"><span>Vendas entregues</span><strong>{summary.deliveredOrders}</strong></article>
        <article className="metric-card"><span>Faturamento bruto</span><strong>{money.format(summary.grossRevenue)}</strong></article>
        <article className="metric-card"><span>Comissões TimeOut</span><strong>{money.format(summary.commissions)}</strong></article>
        <article className="metric-card"><span>Receita líquida</span><strong>{money.format(summary.netRevenue)}</strong></article>
      </div>

      <div className="financial-history">
        <div className="section-heading compact-heading">
          <h3>Histórico de pagamentos simulados</h3>
          <span>{transactions.length} registros</span>
        </div>
        <div className="financial-table" role="table">
          {transactions.map((transaction) => (
            <div className="financial-row" role="row" key={transaction.id}>
              <div><strong>Pedido #{transaction.orderId}</strong><span>{formatDate(transaction.simulatedAt || transaction.createdAt)}</span></div>
              <span>{paymentLabels[transaction.paymentMethod] || transaction.paymentMethod}</span>
              <strong>{money.format(Number(transaction.amount))}</strong>
              <span className={`transaction-status ${transaction.status}`}>
                {transaction.status === 'approved' ? 'Aprovado' : transaction.status === 'declined' ? 'Recusado' : 'Pendente'}
              </span>
            </div>
          ))}
        </div>
        {transactions.length === 0 ? <EmptyState text="Nenhum pagamento simulado registrado ainda." /> : null}
      </div>
    </section>
  )
}

const accessStatusLabels = {
  pending: 'Pendente',
  under_review: 'Em análise',
  changes_requested: 'Correções solicitadas',
  approved: 'Aprovado',
  rejected: 'Recusado',
  suspended: 'Suspenso',
  revoked: 'Revogado',
}

function ApplicationHistory({ application }) {
  const history = Array.isArray(application?.history) ? application.history : []
  if (history.length === 0) return null
  return (
    <div className="approval-history">
      {history.map((item, index) => (
        <span key={`${item.at}-${index}`}><strong>{accessStatusLabels[item.status] || item.status}</strong> {item.note || ''} <small>{formatDate(item.at)}</small></span>
      ))}
    </div>
  )
}

function AccessCenterView({ user, data, onSellerApply, onEnvironmentApply, onJoinEnvironment }) {
  const [sellerForm, setSellerForm] = useState({
    fullName: user.name || '', cpf: '', birthDate: '', phone: user.phone || '', storeName: '',
    activityDescription: '', productCategories: '', reason: '', acceptedTerms: false,
  })
  const [environmentForm, setEnvironmentForm] = useState({
    responsibleName: user.name || '', cpf: '', phone: user.phone || '', institutionName: '',
    institutionType: 'school', cnpj: '', address: '', relationship: '', justification: '',
    environmentDescription: '', document: null,
  })
  const [accessCode, setAccessCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const sellerApplications = data?.sellerApplications || []
  const environmentApplications = data?.environmentApplications || []
  const activeStatuses = ['pending', 'under_review']
  const sellerApplicationActive = sellerApplications.some((item) => activeStatuses.includes(item.status))
  const environmentApplicationActive = environmentApplications.some((item) => activeStatuses.includes(item.status))

  async function submitSeller(event) {
    event.preventDefault()
    setSubmitting(true)
    await onSellerApply({ ...sellerForm, productCategories: sellerForm.productCategories.split(',').map((item) => item.trim()).filter(Boolean) })
    setSubmitting(false)
  }

  async function submitEnvironment(event) {
    event.preventDefault()
    const formData = new FormData()
    Object.entries(environmentForm).forEach(([key, value]) => {
      if (value !== '' && value !== null) formData.append(key, value)
    })
    setSubmitting(true)
    await onEnvironmentApply(formData)
    setSubmitting(false)
  }

  return (
    <section className="main-column full access-page">
      <div className="section-heading">
        <div><span className="eyebrow">Acesso e responsabilidades</span><h2>Central de solicitações</h2><p className="section-subtitle">Acompanhe decisões e envie dados para análise interna.</p></div>
        <span className="experimental-pill"><ShieldCheck size={15} /> Verificação {data?.identityVerificationMode === 'mock' ? 'de teste' : 'ativa'}</span>
      </div>

      {!user.environmentId ? (
        <article className="approval-panel">
          <PanelHeader icon={KeyRound} title="Entrar em um ambiente" />
          <div className="inline-access-form"><input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Código de acesso" /><button className="primary-button" type="button" disabled={!accessCode.trim()} onClick={() => onJoinEnvironment(accessCode)}><ArrowRight size={17} /> Solicitar entrada</button></div>
        </article>
      ) : null}

      <div className="approval-columns">
        {user.environmentId && user.role === 'customer' ? (
          <form className="approval-panel" onSubmit={submitSeller}>
            <PanelHeader icon={Store} title="Solicitar perfil de vendedor" />
            <div className="approval-form-grid">
              <label>Nome completo<input required value={sellerForm.fullName} onChange={(event) => setSellerForm({ ...sellerForm, fullName: event.target.value })} /></label>
              <label>CPF<input required value={sellerForm.cpf} onChange={(event) => setSellerForm({ ...sellerForm, cpf: event.target.value })} placeholder="000.000.000-00" /></label>
              <label>Data de nascimento<input required type="date" value={sellerForm.birthDate} onChange={(event) => setSellerForm({ ...sellerForm, birthDate: event.target.value })} /></label>
              <label>Telefone<input required value={sellerForm.phone} onChange={(event) => setSellerForm({ ...sellerForm, phone: event.target.value })} /></label>
              <label>Nome da loja<input required value={sellerForm.storeName} onChange={(event) => setSellerForm({ ...sellerForm, storeName: event.target.value })} /></label>
              <label>Categorias<input required value={sellerForm.productCategories} onChange={(event) => setSellerForm({ ...sellerForm, productCategories: event.target.value })} placeholder="Salgados, bebidas" /></label>
              <label className="wide-field">Atividade<textarea required minLength={10} value={sellerForm.activityDescription} onChange={(event) => setSellerForm({ ...sellerForm, activityDescription: event.target.value })} /></label>
              <label className="wide-field">Por que deseja vender?<textarea required minLength={10} value={sellerForm.reason} onChange={(event) => setSellerForm({ ...sellerForm, reason: event.target.value })} /></label>
            </div>
            <label className="checkbox-row"><input type="checkbox" checked={sellerForm.acceptedTerms} onChange={(event) => setSellerForm({ ...sellerForm, acceptedTerms: event.target.checked })} /> Confirmo que os dados são verdadeiros e aceito os termos.</label>
            <p className="muted-note">CPF validado apenas quanto ao formato. A identidade ainda não foi verificada por um serviço externo.</p>
            <button className="primary-button" disabled={submitting || sellerApplicationActive || !sellerForm.acceptedTerms}><Send size={17} /> {sellerApplicationActive ? 'Solicitação já em análise' : 'Enviar solicitação'}</button>
          </form>
        ) : null}

        {user.role !== 'platform_admin' ? (
          <form className="approval-panel" onSubmit={submitEnvironment}>
            <PanelHeader icon={Building2} title="Solicitar novo ambiente" />
            <div className="approval-form-grid">
              <label>Responsável<input required value={environmentForm.responsibleName} onChange={(event) => setEnvironmentForm({ ...environmentForm, responsibleName: event.target.value })} /></label>
              <label>CPF<input required value={environmentForm.cpf} onChange={(event) => setEnvironmentForm({ ...environmentForm, cpf: event.target.value })} /></label>
              <label>Telefone<input required value={environmentForm.phone} onChange={(event) => setEnvironmentForm({ ...environmentForm, phone: event.target.value })} /></label>
              <label>Instituição<input required value={environmentForm.institutionName} onChange={(event) => setEnvironmentForm({ ...environmentForm, institutionName: event.target.value })} /></label>
              <label>Tipo<select value={environmentForm.institutionType} onChange={(event) => setEnvironmentForm({ ...environmentForm, institutionType: event.target.value })}>{Object.entries(environmentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>CNPJ opcional<input value={environmentForm.cnpj} onChange={(event) => setEnvironmentForm({ ...environmentForm, cnpj: event.target.value })} /></label>
              <label className="wide-field">Endereço<input required minLength={5} value={environmentForm.address} onChange={(event) => setEnvironmentForm({ ...environmentForm, address: event.target.value })} /></label>
              <label>Relação com o local<input required value={environmentForm.relationship} onChange={(event) => setEnvironmentForm({ ...environmentForm, relationship: event.target.value })} placeholder="Diretor, síndico, colaborador" /></label>
              <label>Comprovante opcional<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setEnvironmentForm({ ...environmentForm, document: event.target.files?.[0] || null })} /></label>
              <label className="wide-field">Justificativa<textarea required minLength={10} value={environmentForm.justification} onChange={(event) => setEnvironmentForm({ ...environmentForm, justification: event.target.value })} /></label>
              <label className="wide-field">Descrição do ambiente<textarea required minLength={10} value={environmentForm.environmentDescription} onChange={(event) => setEnvironmentForm({ ...environmentForm, environmentDescription: event.target.value })} /></label>
            </div>
            <button className="primary-button" disabled={submitting || environmentApplicationActive}><Send size={17} /> {environmentApplicationActive ? 'Solicitação já em análise' : 'Enviar para a equipe TimeOut'}</button>
          </form>
        ) : null}
      </div>

      <div className="approval-columns">
        <ApplicationList title="Solicitações de vendedor" applications={sellerApplications} />
        <ApplicationList title="Solicitações de ambiente" applications={environmentApplications} />
      </div>
    </section>
  )
}

function ApplicationList({ title, applications }) {
  return (
    <article className="approval-panel">
      <div className="section-heading compact-heading"><h3>{title}</h3><span>{applications.length}</span></div>
      <div className="stack">
        {applications.map((application) => (
          <div className="application-card" key={application.id}>
            <div><strong>{application.storeName || application.institutionName || `Solicitação #${application.id}`}</strong><span className={`status-badge ${application.status}`}>{accessStatusLabels[application.status] || application.status}</span></div>
            {application.correctionNotes ? <p><strong>Correções:</strong> {application.correctionNotes}</p> : null}
            {application.decisionReason ? <p><strong>Motivo:</strong> {application.decisionReason}</p> : null}
            <ApplicationHistory application={application} />
          </div>
        ))}
        {applications.length === 0 ? <EmptyState text="Nenhuma solicitação enviada." /> : null}
      </div>
    </article>
  )
}

function EnvironmentAccessAdminView({ data, onReviewSeller, onReviewMembership, onRotateCode, onToggleCode, onRevealCpf }) {
  const [reason, setReason] = useState('')
  if (!data) return <EmptyState text="Carregando aprovações..." />
  const pendingMemberships = (data.memberships || []).filter((item) => item.status !== 'approved')
  return (
    <section className="main-column full access-page">
      <div className="section-heading"><div><span className="eyebrow">Administrador do ambiente</span><h2>Acessos e aprovações</h2></div><span className="experimental-pill"><ShieldCheck size={15} /> {data.identityVerificationMode === 'mock' ? 'Ambiente de teste: validações externas estão desativadas.' : 'Fluxo interno'}</span></div>
      <article className="approval-panel code-management">
        <div><PanelHeader icon={KeyRound} title="Código de acesso" /><p>Código atual: <strong>{data.accessCode?.codePreview || 'Código legado ativo'}</strong></p></div>
        <div className="row-actions"><button className="ghost-button" type="button" onClick={onRotateCode}><RefreshCcw size={16} /> Gerar novo</button>{data.environment?.accessCodeEnabled ? <button className="ghost-button" type="button" onClick={() => onToggleCode(false)}><Lock size={16} /> Desativar</button> : <button className="ghost-button" type="button" onClick={() => onToggleCode(true)}><Check size={16} /> Ativar</button>}</div>
      </article>
      <label className="decision-reason">Justificativa para correção, recusa ou suspensão<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explique a decisão para o solicitante" /></label>
      <div className="approval-columns">
        <article className="approval-panel"><div className="section-heading compact-heading"><h3>Vendedores</h3><span>{data.sellerApplications?.length || 0}</span></div><div className="stack">
          {(data.sellerApplications || []).map((application) => <div className="application-card" key={application.id}><div><strong>{application.fullName || application.user?.name}</strong><span className={`status-badge ${application.status}`}>{accessStatusLabels[application.status]}</span></div><p>{application.storeName} · CPF protegido</p><p>{application.activityDescription}</p><div className="row-actions"><button className="ghost-button" type="button" onClick={() => onRevealCpf(application.id)}><Eye size={15} /> Ver CPF</button><button className="primary-button compact-button" type="button" onClick={() => onReviewSeller(application.id, 'approve')}><Check size={15} /> {application.status === 'suspended' ? 'Reativar' : 'Aprovar'}</button><button className="ghost-button" type="button" onClick={() => onReviewSeller(application.id, 'changes_requested', reason)}>Corrigir</button>{application.status !== 'suspended' ? <button className="ghost-button danger-text" type="button" onClick={() => onReviewSeller(application.id, application.status === 'approved' ? 'suspended' : 'reject', reason)}><Ban size={15} /> {application.status === 'approved' ? 'Suspender' : 'Recusar'}</button> : null}</div><ApplicationHistory application={application} /></div>)}
        </div></article>
        <article className="approval-panel"><div className="section-heading compact-heading"><h3>Entradas no ambiente</h3><span>{pendingMemberships.length}</span></div><div className="stack">
          {pendingMemberships.map((membership) => <div className="application-card" key={membership.id}><div><strong>{membership.user?.name}</strong><span className={`status-badge ${membership.status}`}>{accessStatusLabels[membership.status]}</span></div><p>{membership.user?.email} · {membership.user?.phone || 'Sem telefone'}</p><div className="row-actions"><button className="primary-button compact-button" type="button" onClick={() => onReviewMembership(membership.id, 'approved')}><Check size={15} /> Aprovar</button><button className="ghost-button danger-text" type="button" onClick={() => onReviewMembership(membership.id, membership.status === 'suspended' ? 'approved' : 'suspended')}>{membership.status === 'suspended' ? 'Reativar' : 'Suspender'}</button></div></div>)}
          {pendingMemberships.length === 0 ? <EmptyState text="Nenhuma entrada pendente." /> : null}
        </div></article>
      </div>
    </section>
  )
}

function PlatformAccessView({ data, onReviewApplication, onToggleEnvironment, onTransferEnvironment, onToggleAdministrator, onViewDocument, onRevealCpf }) {
  const [reason, setReason] = useState('')
  const [transfers, setTransfers] = useState({})
  if (!data) return <EmptyState text="Carregando painel da equipe TimeOut..." />
  return (
    <section className="main-column full access-page">
      <div className="section-heading"><div><span className="eyebrow">Equipe interna TimeOut</span><h2>Governança da plataforma</h2><p className="section-subtitle">Aprovações, ambientes, responsáveis e auditoria.</p></div><span className="experimental-pill"><ShieldCheck size={15} /> {data.identityVerificationMode === 'mock' ? 'Ambiente de teste: validações externas estão desativadas.' : 'Acesso restrito'}</span></div>
      <label className="decision-reason">Justificativa da decisão<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Obrigatória para correções e recusas" /></label>
      <article className="approval-panel"><div className="section-heading compact-heading"><h3>Solicitações de ambiente</h3><span>{data.applications?.length || 0}</span></div><div className="stack">
        {(data.applications || []).map((application) => <div className="application-card" key={application.id}><div><strong>{application.institutionName}</strong><span className={`status-badge ${application.status}`}>{accessStatusLabels[application.status]}</span></div><p>{application.responsibleName} · CPF {application.cpf} · {application.phone}</p><p>{application.address}</p><p>{application.relationship}: {application.justification}</p><div className="row-actions"><button className="ghost-button" type="button" onClick={() => onRevealCpf(application.id)}><Eye size={15} /> Ver CPF</button>{application.documentPath ? <button className="ghost-button" type="button" onClick={() => onViewDocument(application.id)}><FileText size={15} /> Comprovante</button> : null}<button className="primary-button compact-button" type="button" onClick={() => onReviewApplication(application.id, 'approved')}><Check size={15} /> Aprovar</button><button className="ghost-button" type="button" onClick={() => onReviewApplication(application.id, 'changes_requested', reason)}>Pedir correção</button><button className="ghost-button danger-text" type="button" onClick={() => onReviewApplication(application.id, 'rejected', reason)}><X size={15} /> Recusar</button></div><ApplicationHistory application={application} /></div>)}
      </div></article>
      <div className="approval-columns">
        <article className="approval-panel"><div className="section-heading compact-heading"><h3>Ambientes</h3><span>{data.environments?.length || 0}</span></div><div className="stack">{(data.environments || []).map((environment) => <div className="application-card" key={environment.id}><div><strong>{environment.name}</strong><span className={`status-badge ${environment.status}`}>{environment.status === 'suspended' ? 'Suspenso' : 'Ativo'}</span></div><p>{environmentTypeLabels[environment.type] || environment.type} · {environment.isPrivate ? 'Privado' : 'Público'}</p><div className="inline-access-form"><input type="number" min="1" value={transfers[environment.id] || ''} onChange={(event) => setTransfers({ ...transfers, [environment.id]: event.target.value })} placeholder="ID do novo responsável" /><button className="ghost-button" type="button" disabled={!transfers[environment.id]} onClick={() => onTransferEnvironment(environment.id, transfers[environment.id])}>Transferir</button><button className="ghost-button danger-text" type="button" onClick={() => onToggleEnvironment(environment.id, environment.status !== 'suspended')}>{environment.status === 'suspended' ? 'Reativar' : 'Suspender'}</button></div></div>)}</div></article>
        <article className="approval-panel"><div className="section-heading compact-heading"><h3>Administradores</h3><span>{data.administrators?.length || 0}</span></div><div className="stack">{(data.administrators || []).map((administrator) => { const membership = administrator.memberships?.find((item) => Number(item.environmentId) === Number(administrator.environmentId)); const suspended = membership?.status === 'suspended'; return <div className="application-card" key={administrator.id}><div><strong>{administrator.name}</strong><span className={`status-badge ${suspended ? 'suspended' : 'approved'}`}>{suspended ? 'Suspenso' : 'Ativo'}</span></div><p>{administrator.email} · ambiente #{administrator.environmentId || '-'}</p><button className="ghost-button danger-text" type="button" onClick={() => onToggleAdministrator(administrator.id, !suspended)}>{suspended ? 'Reativar' : 'Suspender'}</button></div> })}</div></article>
      </div>
      <article className="approval-panel"><div className="section-heading compact-heading"><h3>Auditoria recente</h3><span>{data.auditLogs?.length || 0}</span></div><div className="audit-list">{(data.auditLogs || []).map((log) => <div key={log.id}><strong>{log.summary}</strong><span>{log.actor?.name || 'Sistema'} · {log.action} · {formatDate(log.createdAt)}</span></div>)}</div></article>
    </section>
  )
}

function AdminMonetizationView({ overview, plans, onReviewRequest, onChangePlan, onSaveInstitutional }) {
  const initialConfig = overview?.environment?.institutionalPlanConfig || {}
  const [institutional, setInstitutional] = useState({
    displayName: initialConfig.displayName || '',
    imageUrl: initialConfig.imageUrl || '',
    monthlyPrice: initialConfig.monthlyPrice ?? 99,
    commissionRate: initialConfig.commissionRate ?? 0,
    notes: initialConfig.notes || '',
  })

  if (!overview) return <EmptyState text="Carregando administração financeira..." />

  const pendingRequests = overview.requests?.filter((request) => request.status === 'pending') || []
  const selectablePlans = plans.filter((plan) => ['basic', 'pro'].includes(plan.code))

  return (
    <section className="main-column full monetization-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Administração</span>
          <h2>Monetização do ambiente</h2>
          <p className="section-subtitle">Aprove vendedores, acompanhe comissões e gerencie os planos de teste.</p>
        </div>
        <span className="experimental-pill"><ShieldCheck size={15} /> Pagamentos simulados</span>
      </div>

      <div className="metrics-grid admin-financial-metrics">
        <article className="metric-card"><span>Vendedores ativos</span><strong>{overview.subscriptions?.length || 0}</strong></article>
        <article className="metric-card"><span>Solicitações pendentes</span><strong>{pendingRequests.length}</strong></article>
        <article className="metric-card"><span>Vendas entregues</span><strong>{overview.summary.deliveredOrders}</strong></article>
        <article className="metric-card"><span>Comissões confirmadas</span><strong>{money.format(overview.summary.commissions)}</strong></article>
      </div>

      <div className="admin-monetization-grid">
        <div className="admin-monetization-section">
          <div className="section-heading compact-heading"><h3>Solicitações de vendedor</h3><span>{pendingRequests.length} pendentes</span></div>
          <div className="stack">
            {pendingRequests.map((request) => (
              <article className="line-card seller-request-row" key={request.id}>
                <div className="product-thumb avatar-thumb"><UserRound size={18} /></div>
                <div><h3>{request.user?.name}</h3><p>{request.user?.email}</p><span>{request.user?.phone || 'Telefone não informado'}</span></div>
                <span className="status-badge pending">Aguardando análise</span>
                <div className="row-actions">
                  <button className="primary-button compact-button" type="button" onClick={() => onReviewRequest(request.id, 'approve')}><Check size={16} /> Aprovar</button>
                  <button className="ghost-button danger-text" type="button" onClick={() => onReviewRequest(request.id, 'reject')}><X size={16} /> Rejeitar</button>
                </div>
              </article>
            ))}
          </div>
          {pendingRequests.length === 0 ? <EmptyState text="Nenhuma solicitação pendente." /> : null}
        </div>

        <div className="admin-monetization-section">
          <div className="section-heading compact-heading"><h3>Planos dos vendedores</h3><span>{overview.subscriptions?.length || 0} ativos</span></div>
          <div className="financial-table">
            {overview.subscriptions?.map((subscription) => (
              <div className="financial-row subscription-row" key={subscription.id}>
                <div><strong>{subscription.seller?.name}</strong><span>{subscription.seller?.email}</span></div>
                <select value={subscription.plan?.code || 'basic'} onChange={(event) => onChangePlan(subscription.userId, event.target.value)}>
                  {selectablePlans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name} - {formatPercent(plan.commissionRate)}</option>)}
                </select>
                <span className="experimental-pill">Simulado</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <form className="institutional-config" onSubmit={(event) => { event.preventDefault(); onSaveInstitutional({
        ...institutional,
        monthlyPrice: institutional.monthlyPrice === '' ? null : Number(institutional.monthlyPrice),
        commissionRate: institutional.commissionRate === '' ? null : Number(institutional.commissionRate),
      }) }}>
        <div className="section-heading compact-heading"><div><h3>Plano institucional</h3><p className="section-subtitle">Personalização local, ainda sem contrato ou cobrança.</p></div></div>
        <div className="institutional-fields">
          <label>Nome de exibição<input value={institutional.displayName} onChange={(event) => setInstitutional({ ...institutional, displayName: event.target.value })} placeholder="Ex: TimeOut SENAI" /></label>
          <label>Imagem institucional<input type="url" value={institutional.imageUrl} onChange={(event) => setInstitutional({ ...institutional, imageUrl: event.target.value })} placeholder="https://..." /></label>
          <label>Mensalidade simulada<input type="number" min="0" step="0.01" value={institutional.monthlyPrice} onChange={(event) => setInstitutional({ ...institutional, monthlyPrice: event.target.value })} /></label>
          <label>Comissão<input type="number" min="0" max="100" step="0.01" value={institutional.commissionRate} onChange={(event) => setInstitutional({ ...institutional, commissionRate: event.target.value })} /></label>
          <label className="wide-field">Observações<textarea value={institutional.notes} onChange={(event) => setInstitutional({ ...institutional, notes: event.target.value })} placeholder="Condições e observações internas" /></label>
        </div>
        <button className="primary-button" type="submit"><Check size={17} /> Salvar configuração</button>
      </form>
    </section>
  )
}

function ProfileView({
  user,
  onSave,
  onJoinEnvironment,
  onSwitchEnvironment,
  onOpenAccess,
}) {
  const [environmentCode, setEnvironmentCode] = useState('')
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    password: '',
    currentPassword: '',
    profileImageUrl: user.profileImageUrl || '',
    profileImageFile: null,
  })
  const profileFilePreview = useMemo(
    () => (form.profileImageFile ? URL.createObjectURL(form.profileImageFile) : null),
    [form.profileImageFile],
  )
  const preview = profileFilePreview || getAssetUrl(form.profileImageUrl)
  const memberships = user.memberships || []

  useEffect(() => {
    return () => {
      if (profileFilePreview) URL.revokeObjectURL(profileFilePreview)
    }
  }, [profileFilePreview])

  async function submit(event) {
    event.preventDefault()
    const payload = {
      ...form,
      password: form.password || undefined,
      currentPassword: form.password ? form.currentPassword : undefined,
    }

    const saved = await onSave(payload)
    if (saved) {
      setForm((current) => ({ ...current, password: '', currentPassword: '', profileImageFile: null }))
    }
  }

  return (
    <section className="content-grid two-columns">
      <div className="main-column">
        <div className="section-heading">
          <h2>Perfil</h2>
          <span>{roleLabel(user.role)}</span>
        </div>
        <article className="profile-card">
          <div className="profile-photo large">
            {preview ? <img src={preview} alt={user.name} /> : <UserRound size={38} />}
          </div>
          <div>
            <h3>{user.name}</h3>
            <p>{user.email}</p>
            <span><Phone size={15} /> {user.phone || 'Telefone não informado'}</span>
            <span>
              <MailCheck size={15} />
              {user.emailVerifiedAt ? 'E-mail confirmado' : 'E-mail pendente'}
            </span>
            <span>
              <Phone size={15} />
              {phoneStatusLabel(user)}
            </span>
            {user.role !== 'customer' ? (
              <span>
                <IdCard size={15} />
                {user.cpfVerifiedAt ? 'CPF matematicamente validado' : 'CPF não validado'}
              </span>
            ) : null}
          </div>
        </article>

        {user.role === 'customer' ? (
          <article className="profile-card seller-upgrade">
            <div className="profile-photo">
              <Store size={28} />
            </div>
            <div>
              <h3>Começar a vender</h3>
              <p>Preencha a solicitação completa para que o administrador do ambiente faça a análise.</p>
              <button
                className="primary-button compact-button"
                type="button"
                onClick={onOpenAccess}
              >
                <UserCheck size={17} />
                Abrir solicitações
              </button>
            </div>
          </article>
        ) : null}
      </div>

      <form className="side-panel" onSubmit={submit}>
        <PanelHeader icon={UserRound} title="Editar perfil" />
        <div className="detail-section">
          <PanelHeader icon={Building2} title="Meus lugares" />
          <div className="places-list">
            {memberships.map((membership) => {
              const environment = membership.environment
              const isActive = Number(environment?.id) === Number(user.environmentId)

              return (
                <article className="place-row" key={membership.id || environment?.id}>
                  <div>
                    <strong>{environment?.name || 'Ambiente'}</strong>
                    <span>{environmentTypeLabels[environment?.type] || 'Local'} - {roleLabel(membership.role)} - {accessStatusLabels[membership.status] || membership.status}</span>
                  </div>
                  <button
                    className={isActive ? 'ghost-button active-place' : 'ghost-button'}
                    type="button"
                    onClick={() => onSwitchEnvironment(environment.id)}
                    disabled={isActive || membership.status !== 'approved'}
                  >
                    {isActive ? 'Atual' : membership.status === 'approved' ? 'Usar' : 'Aguardando'}
                  </button>
                </article>
              )
            })}
          </div>
          <label>
            Entrar em outro lugar
            <input
              value={environmentCode}
              onChange={(event) => setEnvironmentCode(event.target.value)}
              placeholder="Código do ambiente"
            />
          </label>
          <button
            className="ghost-button wide"
            type="button"
            onClick={() => {
              onJoinEnvironment(environmentCode)
              setEnvironmentCode('')
            }}
            disabled={!environmentCode.trim()}
          >
            <MapPin size={17} />
            Entrar e trocar para este lugar
          </button>
        </div>

        <div className="detail-section create-place-panel">
          <PanelHeader icon={FileText} title="Novo ambiente" />
          <p>A criação de ambientes passa por análise da equipe TimeOut.</p>
          <button className="ghost-button wide" type="button" onClick={onOpenAccess}>
            <FileText size={17} /> Abrir formulário de solicitação
          </button>
        </div>

        <div className="image-picker">
          <div className="image-preview avatar-preview">
            {preview ? <img src={preview} alt="Prévia do perfil" /> : <UserRound size={28} />}
          </div>
          <label className="file-button">
            <Camera size={16} />
            Alterar foto
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setForm({ ...form, profileImageFile: event.target.files?.[0] || null })}
            />
          </label>
        </div>
        <label>
          Nome
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
        </label>
        <label>
          E-mail
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </label>
        <label>
          Telefone
          <input
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder="12999999999"
          />
        </label>
        <label>
          Nova senha
          <input
            type="password"
            minLength={8}
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="Preencha apenas se quiser trocar"
          />
        </label>
        {form.password ? (
          <label>
            Senha atual
            <input
              type="password"
              value={form.currentPassword}
              onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
              placeholder="Confirme sua senha atual"
              autoComplete="current-password"
              required
            />
          </label>
        ) : null}
        <button className="primary-button" type="submit">
          <Check size={18} />
          Salvar perfil
        </button>
      </form>
    </section>
  )
}

function AdminUsersView({ users, currentUserId, filters, onFilter, onDelete }) {
  return (
    <section className="main-column full">
      <div className="section-heading">
        <h2>Usuários do ambiente</h2>
        <span>{users.length} usuários</span>
      </div>

      <div className="toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            value={filters.search}
            onChange={(event) => onFilter({ ...filters, search: event.target.value })}
            placeholder="Buscar por nome ou e-mail"
          />
        </div>
        <select
          value={filters.role}
          onChange={(event) => onFilter({ ...filters, role: event.target.value })}
        >
          <option value="">Todos os perfis</option>
          <option value="customer">Clientes</option>
          <option value="seller">Vendedores</option>
          <option value="environment_admin">Administradores</option>
        </select>
      </div>

      <div className="stack">
        {users.map((item) => (
          <article className="line-card user-line" key={item.id}>
            <div className="product-thumb avatar-thumb">
              {getAssetUrl(item.profileImageUrl) ? (
                <img src={getAssetUrl(item.profileImageUrl)} alt={item.name} />
              ) : (
                <UserRound size={18} />
              )}
            </div>
            <div>
              <h3>{item.name}</h3>
              <p>{item.email}</p>
              <span className="mini-contact">
                <Phone size={14} />
                {item.phone || 'Telefone não informado'}
              </span>
              <span className="mini-contact">
                <MailCheck size={14} />
                {item.emailVerifiedAt ? 'E-mail confirmado' : 'E-mail pendente'}
              </span>
              <span className="mini-contact">
                <Phone size={14} />
                {phoneStatusLabel(item)}
              </span>
              <span className="mini-contact">
                <IdCard size={14} />
                {item.cpfVerifiedAt ? 'CPF matematicamente validado' : 'CPF não validado'}
              </span>
            </div>
            <span className={`role-badge ${item.role}`}>{roleLabel(item.role)}</span>
            <div className="row-actions">
              <button
                className="icon-button danger"
                type="button"
                onClick={() => onDelete(item.id)}
                disabled={Number(item.id) === Number(currentUserId)}
                title={Number(item.id) === Number(currentUserId) ? 'Você não pode remover seu próprio usuário' : 'Remover usuário'}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {users.length === 0 ? <EmptyState text="Nenhum usuário encontrado." /> : null}
    </section>
  )
}

function AdminEnvironmentsView({ environments, activeEnvironmentId, onSwitch }) {
  return (
    <section className="content-grid two-columns">
      <div className="main-column">
        <div className="section-heading">
          <h2>Ambientes de venda</h2>
          <span>{environments.length} ambientes</span>
        </div>

        <div className="stack">
          {environments.map((environment) => {
            const isActive = Number(environment.id) === Number(activeEnvironmentId)

            return (
              <article className="line-card environment-line" key={environment.id}>
                <div className="product-thumb">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3>{environment.name}</h3>
                  <p>{environmentTypeLabels[environment.type] || 'Outro'} - {environment.isPrivate ? 'Privado' : 'Público'}</p>
                  {environment.address ? <span className="mini-contact"><MapPin size={14} /> {environment.address}</span> : null}
                </div>
                <span className={isActive ? 'mini-status active' : 'mini-status'}>
                  {isActive ? 'Atual' : 'Disponível'}
                </span>
                <div className="row-actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => onSwitch(environment.id)}
                    disabled={isActive}
                  >
                    Usar
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <aside className="side-panel">
        <PanelHeader icon={ShieldCheck} title="Criação protegida" />
        <p>Novos ambientes são criados somente após aprovação da equipe TimeOut. O código de acesso é administrado no painel de acessos.</p>
      </aside>
    </section>
  )
}

function AdminCategoriesView({ categories, onSave, onDelete }) {
  const emptyForm = { id: null, name: '' }
  const [form, setForm] = useState(emptyForm)

  async function submit(event) {
    event.preventDefault()
    await onSave(form.name, form.id)
    setForm(emptyForm)
  }

  return (
    <section className="content-grid two-columns">
      <div className="main-column">
        <div className="section-heading">
          <h2>Categorias</h2>
          <span>{categories.length} categorias</span>
        </div>

        <div className="stack">
          {categories.map((category) => (
            <article className="line-card category-line" key={category.id}>
              <div className="product-thumb">
                <Tags size={18} />
              </div>
              <div>
                <h3>{category.name}</h3>
                <p>Visível no cadastro e filtro de produtos</p>
              </div>
              <div className="row-actions">
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setForm({ id: category.id, name: category.name })}
                  title="Editar categoria"
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-button danger"
                  type="button"
                  onClick={() => onDelete(category.id)}
                  title="Remover categoria"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <form className="side-panel" onSubmit={submit}>
        <PanelHeader icon={Tags} title={form.id ? 'Editar categoria' : 'Nova categoria'} />
        <label>
          Nome da categoria
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Ex: Salgados"
            required
          />
        </label>
        <button className="primary-button" type="submit">
          <Check size={18} />
          {form.id ? 'Salvar categoria' : 'Criar categoria'}
        </button>
        {form.id ? (
          <button className="ghost-button wide" type="button" onClick={() => setForm(emptyForm)}>
            Cancelar edição
          </button>
        ) : null}
      </form>
    </section>
  )
}

function PanelHeader({ icon: Icon, title }) {
  return (
    <div className="panel-header">
      <Icon size={20} />
      <h2>{title}</h2>
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="empty-state">
      <Package size={30} />
      <strong>{text}</strong>
    </div>
  )
}

function roleLabel(role) {
  if (role === 'seller') return 'Vendedor'
  if (role === 'admin' || role === 'environment_admin') return 'Administrador do ambiente'
  if (role === 'platform_admin') return 'Equipe TimeOut'
  return 'Cliente'
}

function phoneStatusLabel(user) {
  if (!user?.phone) return 'Telefone não informado'
  if (user.phoneVerifiedAt) return 'Telefone confirmado'
  return 'Telefone cadastrado'
}

export default App
