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
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { api, getAssetUrl, getErrorMessage, setAuthToken } from './api'
import './App.css'

const SESSION_KEY = '@timeout:web:session'
const LEGACY_SESSION_KEY = '@localfood:web:session'
const SEARCH_HISTORY_KEY = '@timeout:web:recent-searches'
const LEGACY_SEARCH_HISTORY_KEY = '@localfood:web:recent-searches'
const CART_KEY = '@timeout:web:cart'
const LEGACY_CART_KEY = '@localfood:web:cart'
const CLEAR_SESSION_PARAMS = ['clearSession', 'logoutAll']
const APP_NAVIGATION_EVENT = 'timeout:navigate'
const NOTIFICATION_VIEWS = {
  '/access': 'access', '/admin-access': 'admin-access', '/platform': 'platform-access', '/profile': 'profile',
  '/orders': 'my-orders', '/seller-orders': 'seller-orders', '/payments': 'seller-payments',
}

function saveNotificationDestination(view, notification = null) {
  const url = new URL(window.location.href)
  for (const key of ['timeoutView', 'timeoutResourceType', 'timeoutResourceId']) url.searchParams.delete(key)
  if (view) url.searchParams.set('timeoutView', view)
  if (notification?.resourceType) url.searchParams.set('timeoutResourceType', notification.resourceType)
  if (notification?.resourceId) url.searchParams.set('timeoutResourceId', notification.resourceId)
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function readCompatibleStorage(primaryKey, legacyKey) {
  const currentValue = localStorage.getItem(primaryKey)
  if (currentValue !== null) return currentValue

  const legacyValue = localStorage.getItem(legacyKey)
  if (legacyValue !== null) {
    localStorage.setItem(primaryKey, legacyValue)
    localStorage.removeItem(legacyKey)
  }
  return legacyValue
}

function compactQuery(query) {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  )
}

function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(LEGACY_SESSION_KEY)
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
  pending: 'Aguardando simulação',
  approved: 'Pagamento aprovado',
  held: 'Valor reservado pelo Time Out',
  settled: 'Pagamento liquidado',
  declined: 'Pagamento recusado',
  refunded: 'Pagamento estornado',
}

const transactionStatusLabels = {
  pending: 'Pendente',
  approved: 'Aprovado',
  held: 'Reservado',
  settled: 'Liquidado',
  declined: 'Recusado',
  refunded: 'Reembolsado',
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

function parseChoiceOptions(value) {
  if (Array.isArray(value)) return value.filter((option) => option && typeof option === 'object' && option.id && option.name)
  if (typeof value !== 'string') return []
  try {
    return parseChoiceOptions(JSON.parse(value))
  } catch {
    return []
  }
}

function getCartConfigurationKey(item) {
  return JSON.stringify([item.id, item.selectedFlavor || '', item.selectedSizeId || '', [...(item.selectedAddonIds || [])].sort()])
}

function getOrderOptionsSnapshot(item) {
  if (item.optionsSnapshot && typeof item.optionsSnapshot === 'object') return item.optionsSnapshot
  if (typeof item.optionsSnapshot !== 'string') return null
  try { return JSON.parse(item.optionsSnapshot) } catch { return null }
}

function getSelectionPricing(product, flavor = null, size = null, addons = []) {
  const baseCents = Math.round(Number(size?.price ?? product.price ?? 0) * 100) + Math.round(Number(flavor?.priceAdjustment || 0) * 100)
  const discount = getProductDiscount(product)
  const discountCents = discount?.type === 'percentage'
    ? Math.round(baseCents * Number(discount.value) / 100)
    : discount ? Math.round(Number(discount.value) * 100) : 0
  const discountedBaseCents = discount ? Math.max(1, baseCents - discountCents) : baseCents
  const addonCents = addons.reduce((sum, addon) => sum + Math.round(Number(addon.price || 0) * 100), 0)
  return {
    base: baseCents / 100,
    discount: (baseCents - discountedBaseCents) / 100,
    addonsTotal: addonCents / 100,
    unit: (discountedBaseCents + addonCents) / 100,
  }
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
    id: item.id || null,
    name,
    description: item.description || '',
    priceAdjustment: parseMoneyValue(item.priceAdjustment ?? item.priceDelta ?? item.additionalPrice ?? 0),
    imageUrl: item.imageUrl || null,
    isActive: item.isActive !== false,
  }
}

function newFlavorId() {
  return crypto.randomUUID()
}

function getCartImage(item) {
  if (item.cartImageUrl) return item.cartImageUrl
  const size = parseChoiceOptions(item.sizeOptions).find((option) => option.id === item.selectedSizeId)
  const option = parseProductFlavors(item.flavors).find((flavor) => flavor.name === item.selectedFlavor)
  return size?.imageUrl || option?.imageUrl || item.imageUrl
}

function getOrderItemImage(item) {
  if (item.imageUrl) return item.imageUrl
  const option = parseProductFlavors(item.product?.flavors).find((flavor) => flavor.name === item.selectedFlavor)
  return option?.imageUrl || item.product?.imageUrl
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

function readStoredCart(storageKey, legacyStorageKey) {
  try {
    const stored = JSON.parse(readCompatibleStorage(storageKey, legacyStorageKey))
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

function productIdFromUrl() {
  const value = new URLSearchParams(window.location.search).get('produto')
  return value ? (/^[1-9]\d*$/.test(value) ? value : 'invalid') : null
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
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Não informado'
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

    const stored = readCompatibleStorage(SESSION_KEY, LEGACY_SESSION_KEY)
    if (!stored) return null

    try {
      const parsed = JSON.parse(stored)
      setAuthToken(parsed.token)
      return parsed
    } catch {
      localStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(LEGACY_SESSION_KEY)
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
      localStorage.removeItem(LEGACY_SESSION_KEY)
    } else {
      localStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(LEGACY_SESSION_KEY)
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
    <div className={`logo-container ${className}`} aria-label="Time Out">
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

function AuthBrandPanel({ title, description, onHome }) {
  return (
    <section className="auth-panel auth-brand-panel">
      <div className="brand-header">
        {onHome ? (
          <button className="logo-home-button" type="button" aria-label="Ir para o início" onClick={onHome}>
            <Logo />
          </button>
        ) : <Logo />}
        <p className="eyebrow-accent">PEDIDOS LOCAIS PARA AMBIENTES FECHADOS</p>
      </div>
      <div className="auth-copy">
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="auth-brand-features" aria-label="O que você encontra no Time Out">
          <span><Store size={18} /> Vitrine do seu ambiente</span>
          <span><ShoppingCart size={18} /> Pedidos em um só lugar</span>
        </div>
      </div>
    </section>
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
          environmentAccessCode: form.environmentAccessCode.trim() || undefined,
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
      <AuthBrandPanel
        title="Peça e venda no mesmo ambiente."
        description="Encontre produtos do seu local, acompanhe pedidos e gerencie suas vendas no Time Out."
        onHome={() => {
          setMode('login')
          setRecoveryRequested(false)
          setRecoveryCode('')
          setFormErrors({})
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />

      <form className="auth-form" onSubmit={submit}>
        <div className="form-card">
          <div className="form-heading">
            <h2>{mode === 'login' ? 'Boas-vindas!' : mode === 'register' ? 'Criar conta' : 'Recuperar senha'}</h2>
            <p>
              {mode === 'login'
                ? 'Informe seu e-mail e senha para acessar o Time Out.'
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
                <label htmlFor="environmentAccessCode">Código do ambiente (opcional)</label>
                <div className="input-wrapper">
                  <Hash className="input-icon" size={18} />
                  <input
                    id="environmentAccessCode"
                    value={form.environmentAccessCode}
                    onChange={(event) => setForm({ ...form, environmentAccessCode: event.target.value })}
                    placeholder="Ex: SENAI2026"
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
                    ? 'Entrar no Time Out'
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
      <AuthBrandPanel
        title="Confirme sua conta"
        description="Seu acesso ao ambiente fica disponível depois da confirmação."
      />

      <form className="auth-form" onSubmit={verify}>
        <div className="form-card">
        <div className="form-heading">
          <h2>Código de verificação</h2>
          <p>Escolha como receber o código de 6 dígitos. No e-mail, confira também a pasta de spam.{hasPhone ? ` Telefone cadastrado: ${session.user.phone}.` : ''}</p>
        </div>

        {notice ? <div className="notice" role="alert">{notice}</div> : null}

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
            autoComplete="one-time-code"
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
        </div>
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
    <main className="auth-page verification-page two-factor-page">
      <AuthBrandPanel
        title="Mais uma etapa para proteger sua conta."
        description="Use o código enviado ao seu e-mail para concluir o acesso ao Time Out."
      />

      <form className="auth-form" onSubmit={verify}>
        <div className="form-card">
        <div className="form-heading">
          <h2>Autenticação de dois fatores</h2>
          <p>Verifique seu e-mail para encontrar o código de 6 dígitos.</p>
        </div>

        {notice ? <div className="notice" role="alert">{notice}</div> : null}

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
        </div>
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
  onHome,
  activeView,
  onNavigate,
  children,
}) {
  const user = session.user
  const profileImage = getAssetUrl(user.profileImageUrl)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationsRef = useRef(null)
  const unreadCount = notifications.filter((item) => !item.readAt).length
  const sellerWorkspace = ['sales-dashboard', 'seller-orders', 'sales-history', 'seller-products', 'seller-coupons', 'seller-payments', 'seller-financial'].includes(activeView)
    || (activeView === 'profile' && ['seller', 'admin', 'environment_admin'].includes(user.role))

  useEffect(() => {
    if (!notificationsOpen) return undefined
    const closeOutside = (event) => {
      if (!notificationsRef.current?.contains(event.target)) setNotificationsOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setNotificationsOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [notificationsOpen])

  function closeMobileMenuFromNavigation(event) {
    if (event.target.closest('button')) {
      setMobileMenuOpen(false)
      setNotificationsOpen(false)
      saveNotificationDestination(null)
    }
  }

  function goHome() {
    setMobileMenuOpen(false)
    setNotificationsOpen(false)
    saveNotificationDestination(null)
    onHome()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className={sellerWorkspace ? 'app-shell seller-shell' : 'app-shell buyer-shell'}>
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
          <button className="logo-home-button" type="button" aria-label="Ir para o início" onClick={goHome}>
            <Logo className="sidebar-logo" />
          </button>
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
            onClick={() => { setNotificationsOpen(false); setMobileMenuOpen(true) }}
          >
            <Menu size={21} />
          </button>
          <div className="topbar-brand">
            <button className="logo-home-button" type="button" aria-label="Ir para o início" onClick={goHome}>
              <Logo className="topbar-logo" />
            </button>
            <div className="topbar-environment">
              <strong>{user.environment?.name || 'Ambiente local'}</strong>
              <span>{environmentTypeLabels[user.environment?.type] || 'Pedidos locais'}</span>
            </div>
          </div>
          <div className="topbar-title">
            <p className="eyebrow">{user.environment?.name || 'Selecione um ambiente'}</p>
            <h1>{pageTitle}</h1>
          </div>
          {!sellerWorkspace ? (
            <nav className="topbar-navigation" aria-label="Navegação de compras">
              {[
                ['market', 'Vitrine'],
                ['my-orders', 'Meus pedidos'],
                ['access', 'Solicitações'],
                ['plans', 'Planos'],
              ].map(([id, label]) => (
                <button key={id} type="button" className={activeView === id ? 'active' : ''} onClick={() => onNavigate(id)} aria-label={`Ir para ${label}`} aria-current={activeView === id ? 'page' : undefined}>{label}</button>
              ))}
            </nav>
          ) : null}
          <div className="topbar-actions" ref={notificationsRef}>
            <button className="notification-button" type="button" onClick={() => setNotificationsOpen((current) => !current)} aria-label="Abrir notificações">
              <Bell size={16} />
              {unreadCount > 0 ? <b>{unreadCount}</b> : null}
            </button>
            {onCartClick ? <button className="topbar-cart-button" type="button" onClick={() => { setNotificationsOpen(false); onCartClick() }} title="Abrir carrinho">
              <ShoppingCart size={18} />
              <div className="topbar-cart-copy">
                <span>Carrinho</span>
                <strong>{cartItemsCount > 0 ? money.format(cartTotal) : 'Vazio'}</strong>
              </div>
              {cartItemsCount > 0 ? <b>{cartItemsCount}</b> : null}
            </button> : null}
            <button className="topbar-profile-button" type="button" onClick={onProfileClick} aria-label="Abrir perfil">
              {profileImage ? <img src={profileImage} alt="" /> : user.name?.charAt(0)?.toLocaleUpperCase('pt-BR') || <UserRound size={18} />}
            </button>
            {notificationsOpen ? (
              <div className="notifications-popover">
              <div className="section-heading compact-heading"><h3>Notificações</h3><span>{unreadCount} não lidas</span></div>
              <div className="notifications-list">
                {notifications.map((item) => (
                  <button key={item.id} className={item.readAt ? 'notification-item read' : 'notification-item'} type="button" onClick={() => { setNotificationsOpen(false); onNotificationRead?.(item) }}>
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                    <small>{formatDate(item.createdAt)}</small>
                  </button>
                ))}
                {notifications.length === 0 ? <p className="muted-note">Nenhuma notificação.</p> : null}
              </div>
              <button className="ghost-button wide" type="button" onClick={() => { setNotificationsOpen(false); onNavigate('notifications') }}>Ver todas as notificações</button>
              </div>
            ) : null}
          </div>
        </header>

        {notice ? <div className="notice">{notice}</div> : null}
        {children}
      </section>
    </main>
  )
}

function Dashboard({ session, notice, onLogout, onNotice, onSessionUser }) {
  const cartStorageKey = `${CART_KEY}:${session.user.id}:${session.user.environmentId}`
  const legacyCartStorageKey = `${LEGACY_CART_KEY}:${session.user.id}:${session.user.environmentId}`
  const [view, setView] = useState(() => {
    const defaultView = session.user.role === 'platform_admin'
      ? 'platform-access'
      : !session.user.environmentId
        ? 'access'
        : session.user.role === 'seller'
          ? 'seller-orders'
          : 'market'
    const requested = new URLSearchParams(window.location.search).get('timeoutView')
    const marketAllowed = session.user.memberships?.some((item) => Number(item.environmentId) === Number(session.user.environmentId) && item.status === 'approved' && item.environment?.status === 'active')
    if (productIdFromUrl()) return 'market'
    if (requested === 'platform-access' && session.user.role === 'platform_admin') return requested
    if (requested === 'admin-access' && ['admin', 'environment_admin'].includes(session.user.role)) return requested
    if (requested === 'admin-users' && ['platform_admin', 'admin', 'environment_admin'].includes(session.user.role)) return requested
    if (requested === 'seller-orders' && ['seller', 'admin', 'environment_admin'].includes(session.user.role)) return requested
    if (requested === 'seller-payments' && ['seller', 'admin', 'environment_admin'].includes(session.user.role)) return requested
    if (requested === 'seller-products' && ['seller', 'admin', 'environment_admin'].includes(session.user.role)) return requested
    if (requested === 'profile' || requested === 'access') return requested
    if (marketAllowed && ['market', 'my-orders'].includes(requested)) return requested
    return defaultView
  })
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [orders, setOrders] = useState([])
  const [sellerOrders, setSellerOrders] = useState([])
  const [users, setUsers] = useState([])
  const [accountDetail, setAccountDetail] = useState(null)
  const [coupons, setCoupons] = useState([])
  const [paymentSettings, setPaymentSettings] = useState(null)
  const [sellerPaymentSettings, setSellerPaymentSettings] = useState(defaultPaymentSettings)
  const [environments, setEnvironments] = useState([])
  const [plans, setPlans] = useState([])
  const [financialOverview, setFinancialOverview] = useState(null)
  const [adminMonetization, setAdminMonetization] = useState(null)
  const [adminPayoutOverview, setAdminPayoutOverview] = useState(null)
  const [platformPayoutOverview, setPlatformPayoutOverview] = useState(null)
  const [financialQuery, setFinancialQuery] = useState({ page: 1, limit: 10, status: '', dateFrom: '', dateTo: '', order: 'desc' })
  const [adminFinancialQuery, setAdminFinancialQuery] = useState({ page: 1, limit: 10, status: '', dateFrom: '', dateTo: '', order: 'desc' })
  const [platformFinancialQuery, setPlatformFinancialQuery] = useState({ page: 1, limit: 10, status: '', dateFrom: '', dateTo: '', order: 'desc', environmentId: '' })
  const [accessData, setAccessData] = useState({ sellerApplications: [], environmentApplications: [] })
  const [environmentAccess, setEnvironmentAccess] = useState(null)
  const [platformAccess, setPlatformAccess] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [cart, setCart] = useState(() => readStoredCart(cartStorageKey, legacyCartStorageKey))
  const [checkoutResult, setCheckoutResult] = useState(null)
  const [cartToast, setCartToast] = useState('')
  const [productId, setProductId] = useState(productIdFromUrl)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [productError, setProductError] = useState('')
  const [targetApplicationId, setTargetApplicationId] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('timeoutResourceType') === 'environment_application' ? params.get('timeoutResourceId') : null
  })
  const [targetSellerApplicationId, setTargetSellerApplicationId] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('timeoutResourceType') === 'seller_application' ? params.get('timeoutResourceId') : null
  })
  const productRequestRef = useRef(0)
  const unsavedProductOptionsRef = useRef(false)
  const productListRequestRef = useRef(0)
  const managedProductRequestRef = useRef(0)
  const autoRefreshRef = useRef(null)
  const marketScrollRef = useRef(0)
  const restoreMarketScrollRef = useRef(false)
  const [productFeedback, setProductFeedback] = useState({ reviews: [], averageRating: 0, reviewsCount: 0 })
  const [productDetailsLoading, setProductDetailsLoading] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [productPagination, setProductPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsLoadingMore, setProductsLoadingMore] = useState(false)
  const [managedProducts, setManagedProducts] = useState([])
  const [managedProductPagination, setManagedProductPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [managedProductsLoading, setManagedProductsLoading] = useState(false)
  const [managedProductsLoadingMore, setManagedProductsLoadingMore] = useState(false)
  const [filters, setFilters] = useState({ search: '', categoryId: '' })
  const filtersRef = useRef(filters)
  const [userFilters, setUserFilters] = useState({ search: '', role: '', page: 1, limit: 20 })
  const [userPagination, setUserPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [applicationPage, setApplicationPage] = useState(1)
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(readCompatibleStorage(
        `${SEARCH_HISTORY_KEY}:${session.user.id}`,
        `${LEGACY_SEARCH_HISTORY_KEY}:${session.user.id}`,
      )) || []
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
      setCart(readStoredCart(cartStorageKey, legacyCartStorageKey))
      return
    }

    localStorage.setItem(cartStorageKey, JSON.stringify(cart))
  }, [cart, cartStorageKey, legacyCartStorageKey])

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
  const activeMembership = user.memberships?.find((membership) => Number(membership.environmentId) === Number(user.environmentId))
  const canUseMarket = Boolean(user.environmentId && activeMembership?.status === 'approved' && activeMembership?.environment?.status === 'active' && !user.isSuspended)
  const isSeller = user.role === 'seller' || isEnvironmentAdmin
  const isApprovedSeller = user.role === 'seller'
  const isAdmin = isEnvironmentAdmin

  useEffect(() => {
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    function handlePopState(event) {
      const nextId = productIdFromUrl()
      productRequestRef.current += 1
      setProductId(nextId)
      setSelectedProduct(null)
      setProductError('')
      if (nextId) {
        setView('market')
        window.scrollTo(0, 0)
      } else if (event.state?.marketScroll !== undefined) {
        marketScrollRef.current = event.state.marketScroll
        restoreMarketScrollRef.current = true
        setView('market')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.history.scrollRestoration = previous
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    if (view !== 'market' || productId || !restoreMarketScrollRef.current) return undefined
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo(0, marketScrollRef.current)
      restoreMarketScrollRef.current = false
    })
    return () => window.cancelAnimationFrame(frame)
  }, [view, productId, products])

  const loadProducts = useCallback(async (page = 1) => {
    const requestId = ++productListRequestRef.current
    const params = { page, limit: 10 }
    if (filters.search) params.search = filters.search
    if (filters.categoryId) params.categoryId = filters.categoryId

    try {
      const response = await api.get('/products', { params })
      if (requestId === productListRequestRef.current) {
        const result = response.data.data
        setProducts((current) => page === 1 ? result.products : [...current, ...result.products.filter((product) => !current.some((item) => item.id === product.id))])
        setProductPagination({ page, total: result.total ?? result.products.length, totalPages: result.totalPages ?? 1 })
      }
    } finally {
      if (page === 1 && requestId === productListRequestRef.current) setProductsLoading(false)
    }
  }, [filters])

  function updateProductFilters(next) {
    const value = typeof next === 'function' ? next(filtersRef.current) : next
    if (value.search === filtersRef.current.search && value.categoryId === filtersRef.current.categoryId) return
    filtersRef.current = value
    productListRequestRef.current += 1
    setProductsLoading(true)
    setProducts([])
    setProductPagination({ page: 1, total: 0, totalPages: 1 })
    setFilters(value)
  }

  async function loadMoreProducts() {
    if (productsLoadingMore || productPagination.page >= productPagination.totalPages) return
    setProductsLoadingMore(true)
    try {
      await loadProducts(productPagination.page + 1)
    } catch (error) {
      onNotice(getErrorMessage(error))
    } finally {
      setProductsLoadingMore(false)
    }
  }

  const loadManagedProducts = useCallback(async (page = 1) => {
    const requestId = ++managedProductRequestRef.current
    const params = { page, limit: 10 }
    if (!isEnvironmentAdmin) params.sellerId = user.id
    if (page === 1) setManagedProductsLoading(true)
    try {
      const response = await api.get('/products', { params })
      if (requestId === managedProductRequestRef.current) {
        const result = response.data.data
        setManagedProducts((current) => page === 1 ? result.products : [...current, ...result.products.filter((product) => !current.some((item) => item.id === product.id))])
        setManagedProductPagination({ page, total: result.total ?? result.products.length, totalPages: result.totalPages ?? 1 })
      }
    } finally {
      if (page === 1 && requestId === managedProductRequestRef.current) setManagedProductsLoading(false)
    }
  }, [isEnvironmentAdmin, user.id])

  async function loadMoreManagedProducts() {
    if (managedProductsLoadingMore || managedProductPagination.page >= managedProductPagination.totalPages) return
    setManagedProductsLoadingMore(true)
    try {
      await loadManagedProducts(managedProductPagination.page + 1)
    } catch (error) {
      onNotice(getErrorMessage(error))
    } finally {
      setManagedProductsLoadingMore(false)
    }
  }

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
    if (!isAdmin && !isPlatformAdmin) return

    const params = {}
    if (userFilters.search) params.search = userFilters.search
    if (userFilters.role) params.role = userFilters.role
    params.page = userFilters.page
    params.limit = userFilters.limit

    const response = await api.get('/access/admin/accounts', { params })
    setUsers(response.data.data.users)
    setUserPagination(response.data.data)
  }, [isAdmin, isPlatformAdmin, userFilters])

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
    const response = await api.get('/payments/payout-account', { params: compactQuery(financialQuery) })
    setFinancialOverview(response.data.data)
  }, [financialQuery, isApprovedSeller])

  const loadAdminMonetization = useCallback(async () => {
    if (!isAdmin) return
    const response = await api.get('/plans/admin/overview')
    setAdminMonetization(response.data.data)
  }, [isAdmin])

  const loadAdminPayoutOverview = useCallback(async () => {
    if (!isAdmin) return
    const response = await api.get('/payments/admin/overview', { params: compactQuery(adminFinancialQuery) })
    setAdminPayoutOverview(response.data.data)
  }, [adminFinancialQuery, isAdmin])

  const loadPlatformPayoutOverview = useCallback(async () => {
    if (!isPlatformAdmin) return
    const response = await api.get('/payments/platform/overview', { params: compactQuery(platformFinancialQuery) })
    setPlatformPayoutOverview(response.data.data)
  }, [isPlatformAdmin, platformFinancialQuery])

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
      const response = await api.get('/access/platform', { params: { page: applicationPage, limit: 20 } })
      setPlatformAccess(response.data.data)
    }
  }, [applicationPage, isEnvironmentAdmin, isPlatformAdmin])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      if (!canUseMarket) {
        await Promise.all([
          loadAccessData(),
          isPlatformAdmin ? loadPlatformPayoutOverview() : Promise.resolve(),
          isPlatformAdmin || isAdmin ? loadUsers() : Promise.resolve(),
        ])
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
        isAdmin ? loadAdminPayoutOverview() : Promise.resolve(),
        loadAccessData(),
        isPlatformAdmin ? loadPlatformPayoutOverview() : Promise.resolve(),
        isPlatformAdmin ? loadUsers() : Promise.resolve(),
      ])
    } catch (error) {
      onNotice(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [canUseMarket, isAdmin, isApprovedSeller, isPlatformAdmin, isSeller, loadAccessData, loadAdminMonetization, loadAdminPayoutOverview, loadCategories, loadCoupons, loadEnvironments, loadFinancialOverview, loadOrders, loadPaymentSettings, loadPlans, loadPlatformPayoutOverview, loadProducts, loadSellerOrders, loadUsers, onNotice])

  useEffect(() => {
    const next = {
      environmentId: user.environmentId,
      role: user.role,
      products: JSON.stringify(filters),
      users: JSON.stringify(userFilters),
      financial: JSON.stringify(financialQuery),
      adminFinancial: JSON.stringify(adminFinancialQuery),
      platformFinancial: JSON.stringify(platformFinancialQuery),
      applications: applicationPage,
    }
    const timer = window.setTimeout(() => {
      const previous = autoRefreshRef.current
      autoRefreshRef.current = next
      if (!previous || previous.environmentId !== next.environmentId || previous.role !== next.role) {
        refresh()
        return
      }
      const tasks = []
      if (previous.products !== next.products) tasks.push(loadProducts())
      if (previous.users !== next.users) tasks.push(loadUsers())
      if (previous.financial !== next.financial) tasks.push(loadFinancialOverview())
      if (previous.adminFinancial !== next.adminFinancial) tasks.push(loadAdminPayoutOverview())
      if (previous.platformFinancial !== next.platformFinancial) tasks.push(loadPlatformPayoutOverview())
      if (previous.applications !== next.applications) tasks.push(loadAccessData())
      if (tasks.length) Promise.all(tasks).catch((error) => onNotice(getErrorMessage(error)))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [applicationPage, filters, userFilters, financialQuery, adminFinancialQuery, platformFinancialQuery, user.environmentId, user.role, refresh, loadProducts, loadUsers, loadFinancialOverview, loadAdminPayoutOverview, loadPlatformPayoutOverview, loadAccessData, onNotice])

  useEffect(() => {
    if (view !== 'seller-products' && view !== 'sales-dashboard') return undefined
    const timer = window.setTimeout(() => { loadManagedProducts().catch((error) => onNotice(getErrorMessage(error))) }, 0)
    return () => window.clearTimeout(timer)
  }, [view, loadManagedProducts, onNotice, user.environmentId])

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
    updateProductFilters((current) => ({ ...current, search }))
    rememberSearch(search)
  }

  function showCartToast(message) {
    setCartToast(message)
    window.clearTimeout(cartToastTimerRef.current)
    cartToastTimerRef.current = window.setTimeout(() => setCartToast(''), 2800)
  }

  function buildCartItem(product) {
    const selectedFlavor = product.selectedFlavor || ''
    const options = parseProductFlavors(product.flavors)
    const selectedOption = options.find((option) => option.name === selectedFlavor && option.isActive !== false)
    if ((options.length > 0 && !selectedOption) || (options.length === 0 && selectedFlavor)) {
      onNotice('Escolha uma opção válida deste produto')
      return null
    }
    const sizes = parseChoiceOptions(product.sizeOptions)
    const selectedSize = sizes.find((option) => option.id === product.selectedSizeId && option.isActive !== false)
    if ((sizes.length > 0 && !selectedSize) || (sizes.length === 0 && product.selectedSizeId)) {
      onNotice('Escolha um tamanho disponível')
      return null
    }
    const addonIds = [...new Set(product.selectedAddonIds || [])].sort()
    const availableAddons = parseChoiceOptions(product.addons)
    const selectedAddons = addonIds.map((id) => availableAddons.find((option) => option.id === id && option.isActive !== false))
    if (selectedAddons.some((option) => !option)) {
      onNotice('Escolha adicionais disponíveis deste produto')
      return null
    }
    const pricing = getSelectionPricing(product, selectedOption, selectedSize, selectedAddons)

    return {
      ...product,
      selectedFlavor,
      selectedFlavorId: selectedOption?.id || null,
      selectedSizeId: selectedSize?.id || null,
      selectedSizeName: selectedSize?.name || null,
      selectedAddonIds: addonIds,
      cartAddons: selectedAddons.map(({ id, name, price, description, imageUrl }) => ({ id, name, price, description, imageUrl })),
      cartBasePrice: pricing.base,
      cartDiscount: pricing.discount,
      cartImageUrl: selectedSize?.imageUrl || selectedOption?.imageUrl || product.imageUrl,
      cartUnitPrice: pricing.unit,
      cartQuantity: Math.max(1, Math.min(Number(product.selectedQuantity) || 1, Number(product.quantity))),
    }
  }

  function canAddProduct(product, replaceCart = false) {
    if (!canUseMarket) {
      setView('access')
      onNotice('Entre em um ambiente ativo e aguarde a aprovação para comprar')
      return false
    }
    if (Number(product.seller?.id || product.userId) === Number(user.id)) {
      onNotice('Você não pode comprar seu próprio produto')
      return false
    }

    if (product.quantity <= 0) {
      onNotice('Produto sem estoque')
      return false
    }

    if (!replaceCart && cart.filter((item) => item.id === product.id).reduce((sum, item) => sum + item.cartQuantity, 0) + (Number(product.selectedQuantity) || 1) > product.quantity) {
      onNotice('A quantidade total deste produto ultrapassa o estoque')
      return false
    }

    if (!replaceCart && cart.length > 0 && Number(sellerId) !== Number(product.seller.id)) {
      onNotice('Escolha produtos de um vendedor por pedido')
      return false
    }

    return true
  }

  function openProduct(product) {
    if (!canUseMarket) return
    marketScrollRef.current = window.scrollY
    window.history.replaceState({ ...window.history.state, marketScroll: marketScrollRef.current }, '')
    const url = new URL(window.location.href)
    url.searchParams.set('produto', String(product.id))
    window.history.pushState({ productId: String(product.id) }, '', `${url.pathname}${url.search}${url.hash}`)
    setView('market')
    setProductId(String(product.id))
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    if (!productId || !canUseMarket) return undefined
    const requestId = ++productRequestRef.current
    let active = true
    Promise.resolve().then(() => {
      setSelectedProduct(null)
      setProductError('')
      setProductFeedback({ reviews: [], averageRating: 0, reviewsCount: 0 })
      setProductDetailsLoading(true)
      setReviewSubmitting(false)
    })
    Promise.all([api.get(`/products/${productId}`), api.get(`/products/${productId}/reviews`)])
      .then(([productResponse, reviewsResponse]) => {
        if (!active || requestId !== productRequestRef.current) return
        const product = productResponse.data.data.product
        if (String(product.id) !== productId) throw new Error('Produto incorreto na resposta')
        setSelectedProduct(product)
        setProductFeedback(reviewsResponse.data.data)
      })
      .catch(() => {
        if (active && requestId === productRequestRef.current) {
          setProductError('Produto não encontrado ou indisponível neste ambiente.')
          setSelectedProduct(null)
        }
      })
      .finally(() => {
        if (active && requestId === productRequestRef.current) setProductDetailsLoading(false)
      })
    return () => { active = false; productRequestRef.current += 1 }
  }, [productId, canUseMarket])

  function backToMarket() {
    if (window.history.state?.productId === productId) {
      window.history.back()
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.delete('produto')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    setProductId(null)
    setView('market')
  }

  function navigateToView(nextView) {
    if (nextView !== 'seller-products' && unsavedProductOptionsRef.current && !window.confirm('Descartar alterações nas opções e sair desta página?')) return
    if (nextView !== 'seller-products') unsavedProductOptionsRef.current = false
    if (productId) {
      const url = new URL(window.location.href)
      url.searchParams.delete('produto')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      productRequestRef.current += 1
      setProductId(null)
    }
    setView(nextView)
  }

  useEffect(() => {
    if (view === 'market' || !productId) return undefined
    const url = new URL(window.location.href)
    url.searchParams.delete('produto')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    productRequestRef.current += 1
    const frame = window.requestAnimationFrame(() => setProductId(null))
    return () => window.cancelAnimationFrame(frame)
  }, [view, productId])

  async function saveProductReview(productId, payload) {
    const requestId = productRequestRef.current
    setReviewSubmitting(true)

    try {
      await api.post(`/products/${productId}/reviews`, payload)
      const response = await api.get(`/products/${productId}/reviews`)
      if (requestId === productRequestRef.current) {
        setProductFeedback(response.data.data)
        onNotice('Avaliação salva')
      }
    } catch (error) {
      if (requestId === productRequestRef.current) onNotice(getErrorMessage(error))
    } finally {
      if (requestId === productRequestRef.current) setReviewSubmitting(false)
    }
  }

  function addToCart(product) {
    if (!canAddProduct(product)) return

    const cartItem = buildCartItem(product)
    if (!cartItem) return

    setCart((current) => {
      const existing = current.find((item) =>
        getCartConfigurationKey(item) === getCartConfigurationKey(cartItem)
      )
      if (existing) {
        return current.map((item) =>
          getCartConfigurationKey(item) === getCartConfigurationKey(cartItem)
            ? { ...item, cartQuantity: Math.min(item.cartQuantity + cartItem.cartQuantity, item.quantity) }
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
    if (!cartItem) return
    setCart([cartItem])
    const url = new URL(window.location.href)
    url.searchParams.delete('produto')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    setProductId(null)
    setView('cart')
    showCartToast(`${product.name} pronto para finalizar`)
  }

  function removeFromCart(configurationKey) {
    setCart((current) => current.filter((item) => getCartConfigurationKey(item) !== configurationKey))
  }

  function changeCartQuantity(configurationKey, delta) {
    setCart((current) =>
      current
        .map((item) =>
          getCartConfigurationKey(item) === configurationKey
            ? { ...item, cartQuantity: Math.max(1, Math.min(item.quantity - current.filter((other) => other.id === item.id && getCartConfigurationKey(other) !== configurationKey).reduce((sum, other) => sum + other.cartQuantity, 0), item.cartQuantity + delta)) }
            : item,
        )
        .filter((item) => item.cartQuantity > 0),
    )
  }

  async function createOrder(formData) {
    if (!canUseMarket) {
      setView('access')
      onNotice('Sua participação precisa estar aprovada para comprar')
      return
    }
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
          selectedSizeId: item.selectedSizeId || undefined,
          selectedAddonIds: item.selectedAddonIds || [],
          quantity: item.cartQuantity,
        })),
      })

      const { order, payment } = response.data.data
      setCart([])
      setCheckoutResult(payment ? { order, payment } : null)
      setView(payment ? 'checkout-payment' : 'my-orders')
      onNotice(payment
        ? 'Pedido criado. Escolha o resultado da simulação do pagamento.'
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
        approved: 'Pagamento de teste aprovado e reservado pelo Time Out até a entrega.',
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
    const { imageFile, galleryFiles = [], flavorImageFiles = [], sizeImageFiles = [], addonImageFiles = [], ...productData } = payload
    const requestData = toFormData(productData, 'image', imageFile)
    galleryFiles.forEach((file) => requestData.append('images', file))
    requestData.append('flavorImageIds', JSON.stringify(flavorImageFiles.map(({ id }) => id)))
    flavorImageFiles.forEach(({ file }) => requestData.append('flavorImages', file))
    requestData.append('sizeImageIds', JSON.stringify(sizeImageFiles.map(({ id }) => id)))
    sizeImageFiles.forEach(({ file }) => requestData.append('sizeImages', file))
    requestData.append('addonImageIds', JSON.stringify(addonImageFiles.map(({ id }) => id)))
    addonImageFiles.forEach(({ file }) => requestData.append('addonImages', file))

    try {
      if (productId) {
        await api.put(`/products/${productId}`, requestData)
        onNotice('Produto atualizado')
      } else {
        await api.post('/products', requestData)
        onNotice('Produto criado')
      }

      await Promise.all([refresh(), loadManagedProducts()])
      return true
    } catch (error) {
      onNotice(getErrorMessage(error))
      return false
    }
  }

  async function deleteProduct(productId) {
    try {
      await api.delete(`/products/${productId}`)
      onNotice('Produto removido')
      await Promise.all([refresh(), loadManagedProducts()])
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function toggleProduct(product) {
    try {
      await api.patch(`/products/${product.id}/status`, { isActive: !product.isActive })
      onNotice(product.isActive ? 'Produto pausado' : 'Produto ativado')
      await Promise.all([refresh(), loadManagedProducts()])
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

  async function connectPayoutAccount(payload) {
    try {
      await api.post('/payments/payout-account/connect', payload)
      onNotice('Conta de teste conectada. Nenhuma conta bancária real foi vinculada.')
      await refresh()
      return true
    } catch (error) {
      onNotice(getErrorMessage(error))
      return false
    }
  }

  async function updatePayoutAccountStatus(sellerId, suspended) {
    try {
      await api.patch(`/payments/admin/accounts/${sellerId}/status`, { suspended })
      onNotice(suspended ? 'Conta de recebimento suspensa' : 'Conta de recebimento reativada')
      await refresh()
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function retrySettlement(orderId) {
    try {
      await api.post(`/payments/admin/orders/${orderId}/retry-settlement`)
      onNotice('Nova tentativa de liberação concluída')
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

  async function switchEnvironment(environmentId, nextView = 'market') {
    try {
      const response = await api.patch(`/environments/${environmentId}/switch`)
      onSessionUser(response.data.data.user)
      setView(nextView)
      onNotice('Ambiente alterado')
      await refresh()
      return true
    } catch (error) {
      onNotice(getErrorMessage(error))
      return false
    }
  }

  async function openAccount(userId) {
    try {
      const response = await api.get(`/access/admin/accounts/${userId}`)
      setAccountDetail(response.data.data)
    } catch (error) {
      onNotice(getErrorMessage(error))
    }
  }

  async function manageAccount(action, payload) {
    if (!accountDetail?.user?.id) return
    const id = accountDetail.user.id
    try {
      if (action === 'profile') await api.patch(`/access/admin/accounts/${id}/profile`, payload)
      if (action === 'status') await api.patch(`/access/admin/accounts/${id}/status`, payload)
      if (action === 'sessions') await api.post(`/access/admin/accounts/${id}/sessions/invalidate`, payload)
      if (action === 'email') await api.post(`/access/admin/accounts/${id}/email/reverify`, payload)
      const response = await api.get(`/access/admin/accounts/${id}`)
      setAccountDetail(response.data.data)
      onNotice('Conta atualizada')
      await refresh()
      return true
    } catch (error) { onNotice(getErrorMessage(error)); return false }
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
        reason,
      })
      onNotice(action === 'approve' ? 'Vendedor aprovado no plano Básico' : 'Solicitação atualizada')
      await refresh()
      return true
    } catch (error) {
      onNotice(getErrorMessage(error))
      return false
    }
  }

  async function submitSellerApplication(payload) {
    try {
      await api.post('/access/seller-applications', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
      onNotice('Solicitação de vendedor enviada para análise')
      await refresh()
      return true
    } catch (error) { onNotice(getErrorMessage(error)); return false }
  }

  async function submitEnvironmentApplication(payload) {
    try {
      await api.post('/access/environment-applications', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
      onNotice('Solicitação de ambiente enviada para a equipe Time Out')
      await refresh()
      return true
    } catch (error) { onNotice(getErrorMessage(error)); return false }
  }

  async function reviewMembership(id, status, reason = '') {
    try {
      await api.patch(`/access/environment-admin/memberships/${id}`, { status, reason })
      onNotice('Participação atualizada')
      await refresh()
      return true
    } catch (error) { onNotice(getErrorMessage(error)); return false }
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
      return true
    } catch (error) { onNotice(getErrorMessage(error)); return false }
  }

  async function toggleEnvironmentStatus(id, suspended, reason) {
    try {
      await api.patch(`/access/platform/environments/${id}/status`, { suspended, reason })
      onNotice(suspended ? 'Ambiente suspenso' : 'Ambiente reativado')
      await refresh()
      return true
    } catch (error) { onNotice(getErrorMessage(error)); return false }
  }

  async function transferEnvironment(id, userId, reason) {
    try {
      await api.patch(`/access/platform/environments/${id}/transfer`, { userId: Number(userId), reason })
      onNotice('Responsável pelo ambiente atualizado')
      await refresh()
      return true
    } catch (error) { onNotice(getErrorMessage(error)); return false }
  }

  async function toggleAdministratorStatus(id, suspended, reason) {
    try {
      await api.patch(`/access/platform/administrators/${id}/status`, { suspended, reason })
      onNotice(suspended ? 'Administrador suspenso' : 'Administrador reativado')
      await refresh()
      return true
    } catch (error) { onNotice(getErrorMessage(error)); return false }
  }

  async function viewApplicationDocument(id, reason) {
    try {
      const response = await api.get(`/access/platform/environment-applications/${id}/document`, { params: { reason }, responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) { onNotice(getErrorMessage(error)) }
  }

  async function viewSellerDocument(id, reason) {
    try {
      const response = await api.get(`/access/environment-admin/seller-applications/${id}/document`, { params: { reason }, responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) { onNotice(getErrorMessage(error)) }
  }

  async function viewPlatformSellerDocument(id, reason) {
    try {
      const response = await api.get(`/access/platform/seller-applications/${id}/document`, { params: { reason }, responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) { onNotice(getErrorMessage(error)) }
  }

  async function markNotificationRead(notification) {
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item))
    const targetView = notification.targetView || NOTIFICATION_VIEWS[notification.internalLink] || 'access'
    const targetMembership = user.memberships?.find((item) => Number(item.environmentId) === Number(notification.environmentId) && item.status === 'approved' && item.environment?.status === 'active')
    const allowed = targetView === 'platform-access' ? isPlatformAdmin
      : targetView === 'admin-access' || targetView === 'admin-users' ? isAdmin || isPlatformAdmin || ['admin', 'environment_admin'].includes(targetMembership?.role)
        : ['seller-orders', 'seller-payments', 'seller-products'].includes(targetView) ? isSeller || ['seller', 'admin', 'environment_admin'].includes(targetMembership?.role)
          : targetView === 'market' || targetView === 'my-orders' ? canUseMarket || Boolean(targetMembership)
            : ['access', 'profile'].includes(targetView)
    const nextView = allowed ? targetView : 'access'
    if (!allowed) onNotice('Este conteúdo não está disponível para sua conta; abrimos a listagem de solicitações.')
    let actualView = nextView
    if (notification.environmentId && Number(notification.environmentId) !== Number(user.environmentId) && nextView !== 'platform-access') {
      if (!targetMembership || !(await switchEnvironment(notification.environmentId, nextView))) {
        actualView = 'access'
        setView('access')
        onNotice('Você não tem acesso ao ambiente desta notificação.')
      }
    } else {
      setView(nextView)
    }
    saveNotificationDestination(actualView, notification)
    setTargetApplicationId(actualView === 'platform-access' && notification.resourceType === 'environment_application' ? notification.resourceId : null)
    setTargetSellerApplicationId(actualView === 'admin-access' && notification.resourceType === 'seller_application' ? notification.resourceId : null)
    if (actualView === 'market' && notification.resourceType === 'product' && notification.resourceId) {
      openProduct({ id: notification.resourceId, name: 'Produto' })
    }
    if (actualView === 'admin-users' && notification.resourceType === 'user' && notification.resourceId) {
      openAccount(notification.resourceId)
    }
    try {
      await api.patch(`/access/notifications/${notification.id}/read`)
      await loadAccessData()
    } catch (error) { onNotice(getErrorMessage(error)) }
  }

  async function markAllNotificationsRead() {
    const unread = notifications.filter((item) => !item.readAt)
    const results = await Promise.allSettled(unread.map((item) => api.patch(`/access/notifications/${item.id}/read`)))
    const readIds = new Set(unread.filter((_, index) => results[index].status === 'fulfilled').map((item) => item.id))
    setNotifications((current) => current.map((item) => readIds.has(item.id) ? { ...item, readAt: new Date().toISOString() } : item))
    if (readIds.size !== unread.length) onNotice('Algumas notificações não puderam ser marcadas como lidas.')
  }

  async function revealApplicationCpf(type, id, reason) {
    try {
      const response = await api.get(`/access/applications/${type}/${id}/cpf`, { params: { reason } })
      return response.data.data.cpf
    } catch (error) { onNotice(getErrorMessage(error)); return null }
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

  const primaryTabs = canUseMarket
      ? [
          ['market', 'Vitrine', ShoppingBag],
          ['cart', `Carrinho (${cartItemsCount})`, ShoppingCart],
          ['my-orders', 'Histórico de compras', History],
          ['plans', 'Planos', Crown],
          ['access', 'Solicitações', FileText],
          ['notifications', 'Notificações', Bell],
        ]
      : [['access', 'Solicitações', FileText], ['notifications', 'Notificações', Bell]]
  const sellerTabs = []
  const adminTabs = []

  if (isSeller) {
    sellerTabs.push(['sales-dashboard', 'Visão geral', BarChart3])
    sellerTabs.push(['seller-orders', 'Pedidos recebidos', ChefHat])
    sellerTabs.push(['sales-history', 'Histórico de vendas', ClipboardList])
    sellerTabs.push(['seller-products', 'Meus produtos', Package])
    sellerTabs.push(['seller-coupons', 'Cupons', Percent])
    sellerTabs.push(['seller-payments', 'Recebimentos', Wallet])
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
    adminTabs.push(['platform-access', 'Equipe Time Out', ShieldCheck])
    adminTabs.push(['admin-users', 'Contas', UsersRound])
  }

  const allTabs = [...primaryTabs, ...sellerTabs, ...adminTabs]
  const pageTitle = productId && view === 'market' ? 'Produto' : allTabs.find(([id]) => id === view)?.[1]
    || (view === 'profile' ? 'Meu perfil' : view === 'new-environment' ? 'Novo ambiente' : view === 'checkout-payment' ? 'Pagamento' : 'Time Out')

  const navigation = (
    <nav className="sidebar-nav-groups" aria-label="Navegação principal">
      <div className="sidebar-nav-group">
        <span className="sidebar-nav-label">Principal</span>
        {primaryTabs.map(([id, label, Icon]) => (
          <button
            key={id}
            className={view === id ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
            type="button"
            onClick={() => navigateToView(id)}
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
              onClick={() => navigateToView(id)}
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
              onClick={() => navigateToView(id)}
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
      onLogout={() => { if (!unsavedProductOptionsRef.current || window.confirm('Descartar alterações nas opções e sair?')) onLogout() }}
      onProfileClick={() => navigateToView('profile')}
      navigation={navigation}
      pageTitle={pageTitle}
      cartItemsCount={cartItemsCount}
      cartTotal={cartTotal}
      onCartClick={canUseMarket ? () => navigateToView('cart') : null}
      notifications={notifications}
      onNotificationRead={markNotificationRead}
      onHome={() => {
        navigateToView(canUseMarket ? 'market' : 'access')
        if (canUseMarket) refresh()
      }}
      activeView={view}
      onNavigate={navigateToView}
    >

      {view === 'market' && canUseMarket && !productId && (
        <MarketView
          products={products}
          productsLoading={productsLoading}
          pagination={productPagination}
          loadingMore={productsLoadingMore}
          onLoadMore={loadMoreProducts}
          categories={categories}
          filters={filters}
          onFilter={updateProductFilters}
          onAdd={addToCart}
          onOpen={openProduct}
          onRememberSearch={rememberSearch}
          recentSearches={recentSearches}
          onUseRecentSearch={applyRecentSearch}
          currentUserId={user.id}
        />
      )}

      {view === 'market' && productId && (
        canUseMarket ? (
          String(selectedProduct?.id) === productId ? (
            <ProductDetailPage
              key={selectedProduct.id}
              product={selectedProduct}
              feedback={productFeedback}
              currentUserId={user.id}
              onBack={backToMarket}
              onAdd={addToCart}
              onBuyNow={buyNow}
              onReview={saveProductReview}
              reviewSubmitting={reviewSubmitting}
            />
          ) : (
            <section className="product-detail-state">
              <button className="detail-back" type="button" onClick={backToMarket}><ArrowRight size={16} /> Voltar à Vitrine</button>
              <p role="status">{productError || (productDetailsLoading ? 'Carregando produto...' : 'Carregando produto...')}</p>
            </section>
          )
        ) : (
          <section className="product-detail-state">
            <h2>Este produto não está disponível neste ambiente</h2>
            <button className="ghost-button" type="button" onClick={() => { backToMarket(); setView('access') }}>Ver meus ambientes</button>
          </section>
        )
      )}

      {view === 'cart' && canUseMarket && (
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

      {(view === 'access' || view === 'new-environment') && (
        <AccessCenterView
          user={user}
          data={accessData}
          environmentOnly={view === 'new-environment'}
          onOpenEnvironment={() => navigateToView('new-environment')}
          onBack={() => navigateToView('access')}
          onSellerApply={submitSellerApplication}
          onEnvironmentApply={submitEnvironmentApplication}
          onJoinEnvironment={joinEnvironment}
          onSwitchEnvironment={switchEnvironment}
        />
      )}

      {view === 'notifications' && (
        <NotificationsView notifications={notifications} onOpen={markNotificationRead} onMarkAllRead={markAllNotificationsRead} />
      )}

      {view === 'my-orders' && canUseMarket && (
        <OrdersView orders={orders} mode="customer" onCancel={cancelOrder} title="Histórico de compras" />
      )}

      {view === 'sales-dashboard' && (
        <SalesDashboard orders={sellerOrders} products={managedProducts} />
      )}

      {view === 'seller-orders' && (
        <OrdersView orders={sellerOrders} mode="seller" onStatus={updateOrderStatus} />
      )}

      {view === 'sales-history' && (
        <OrdersView orders={sellerOrders} mode="seller" onStatus={updateOrderStatus} title="Histórico de vendas" />
      )}

      {view === 'seller-products' && (
        <SellerProductsView
          products={managedProducts}
          productsLoading={managedProductsLoading}
          pagination={managedProductPagination}
          loadingMore={managedProductsLoadingMore}
          onLoadMore={loadMoreManagedProducts}
          categories={categories}
          onSave={saveProduct}
          onToggle={toggleProduct}
          onDelete={deleteProduct}
          onOptionsDirty={(dirty) => { unsavedProductOptionsRef.current = dirty }}
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
          overview={financialOverview}
          onSave={savePaymentSettings}
          onConnect={connectPayoutAccount}
          query={financialQuery}
          onQuery={setFinancialQuery}
        />
      )}

      {view === 'seller-financial' && (
        <SellerFinancialView
          overview={financialOverview}
          onPlans={() => setView('plans')}
          query={financialQuery}
          onQuery={setFinancialQuery}
        />
      )}

      {view === 'profile' && (
        <ProfileView
          user={user}
          onSave={saveProfile}
          onJoinEnvironment={joinEnvironment}
          onSwitchEnvironment={switchEnvironment}
          onOpenAccess={() => setView('access')}
          onOpenEnvironment={() => navigateToView('new-environment')}
        />
      )}

      {view === 'admin-users' && (
        <AdminUsersView
          users={users}
          pagination={userPagination}
          isPlatformAdmin={isPlatformAdmin}
          currentUserId={user.id}
          filters={userFilters}
          onFilter={setUserFilters}
          onManage={openAccount}
        />
      )}

      {accountDetail && <AccountManagementDialog data={accountDetail} currentUserId={user.id} onClose={() => setAccountDetail(null)} onAction={manageAccount} />}

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
          payoutOverview={adminPayoutOverview}
          plans={plans}
          onReviewRequest={reviewSellerRequest}
          onChangePlan={changeSellerPlan}
          onSaveInstitutional={saveInstitutionalConfig}
          onPayoutStatus={updatePayoutAccountStatus}
          financialQuery={adminFinancialQuery}
          onFinancialQuery={setAdminFinancialQuery}
          onRetrySettlement={retrySettlement}
        />
      )}

      {view === 'admin-access' && (
        <EnvironmentAccessAdminView
          data={environmentAccess}
          focusSellerApplicationId={targetSellerApplicationId}
          onReviewSeller={reviewSellerRequest}
          onReviewMembership={reviewMembership}
          onRotateCode={rotateEnvironmentCode}
          onToggleCode={toggleEnvironmentCode}
          onRevealCpf={(id, reason) => revealApplicationCpf('seller', id, reason)}
          onViewDocument={viewSellerDocument}
          onNotice={onNotice}
        />
      )}

      {view === 'platform-access' && (
        <PlatformAccessView
          data={platformAccess}
          onApplicationPage={setApplicationPage}
          focusApplicationId={targetApplicationId}
          payoutOverview={platformPayoutOverview}
          onReviewApplication={reviewEnvironmentApplication}
          onToggleEnvironment={toggleEnvironmentStatus}
          onTransferEnvironment={transferEnvironment}
          onToggleAdministrator={toggleAdministratorStatus}
          onViewDocument={viewApplicationDocument}
          onViewSellerDocument={viewPlatformSellerDocument}
          onRevealCpf={(id, reason) => revealApplicationCpf('environment', id, reason)}
          onRevealSellerCpf={(id, reason) => revealApplicationCpf('seller', id, reason)}
          onNotice={onNotice}
          financialQuery={platformFinancialQuery}
          onFinancialQuery={setPlatformFinancialQuery}
          onRetrySettlement={retrySettlement}
        />
      )}

      {cartToast ? (
        <div className="cart-toast" role="status">
          <BadgeCheck size={18} />
          <span>{cartToast}</span>
        </div>
      ) : null}

    </Shell>
  )
}

function MarketView({
  products,
  productsLoading,
  pagination,
  loadingMore,
  onLoadMore,
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

        <div className="section-heading market-products-heading"><h2>Destaques</h2><span>{products.length} produtos</span></div>
        <div className="product-grid">
          {products.map((product) => {
            const isOwnProduct = Number(product.seller?.id) === Number(currentUserId)
            const isUnavailable = product.quantity <= 0 || isOwnProduct
            const productOptions = parseProductFlavors(product.flavors)
            const sizes = parseChoiceOptions(product.sizeOptions).filter((option) => option.isActive !== false)
            const optionPrices = sizes.length > 0
              ? sizes.map((size) => getSelectionPricing(product, null, size).unit)
              : productOptions.map((option) => getOptionPrice(product, option))
            const lowestPrice = optionPrices.length
              ? Math.min(...optionPrices)
              : getOptionPrice(product)
            const hasVariablePrice = sizes.length > 0 || optionPrices.some((price) => price !== getOptionPrice(product))
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
                        if (productOptions.length > 0 || sizes.length > 0 || parseChoiceOptions(product.addons).length > 0) {
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

        {productsLoading ? <p role="status">Carregando produtos...</p> : products.length === 0 ? <EmptyState text="Nenhum produto encontrado." /> : null}
        {pagination.page < pagination.totalPages ? <button className="ghost-button" type="button" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? 'Carregando...' : `Ver mais produtos (${products.length} de ${pagination.total})`}</button> : null}
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

function ProductDetailPage({
  product,
  feedback,
  currentUserId,
  onBack,
  onAdd,
  onBuyNow,
  onReview,
  reviewSubmitting,
}) {
  const reviews = feedback?.reviews || []
  const flavors = parseProductFlavors(product.flavors).filter((option) => option.isActive !== false)
  const sizes = parseChoiceOptions(product.sizeOptions).filter((option) => option.isActive !== false)
  const addons = parseChoiceOptions(product.addons).filter((option) => option.isActive !== false)
  const productImages = getProductImages(product)
  const [gallerySelection, setGallerySelection] = useState(null)
  const sellerImage = getAssetUrl(product.seller?.profileImageUrl)
  const isOwnProduct = Number(product.seller?.id || product.userId) === Number(currentUserId)
  const isUnavailable = product.quantity <= 0 || isOwnProduct
  const myReview = reviews.find((review) => Number(review.user?.id) === Number(currentUserId))
  const [selectedFlavor, setSelectedFlavor] = useState(() => flavors[0]?.name || '')
  const [selectedSizeId, setSelectedSizeId] = useState('')
  const [selectedAddonIds, setSelectedAddonIds] = useState([])
  const [quantity, setQuantity] = useState(1)
  const effectiveFlavor = flavors.some((flavor) => flavor.name === selectedFlavor) ? selectedFlavor : (flavors[0]?.name || '')
  const selectedOption = flavors.find((flavor) => flavor.name === effectiveFlavor)
  const selectedSize = sizes.find((size) => size.id === selectedSizeId)
  const selectedAddons = addons.filter((addon) => selectedAddonIds.includes(addon.id))
  const pricing = getSelectionPricing(product, selectedOption, selectedSize, selectedAddons)
  const activeImage = gallerySelection || getAssetUrl(selectedSize?.imageUrl) || getAssetUrl(selectedOption?.imageUrl) || getAssetUrl(product.imageUrl) || productImages[0] || ''
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
    <section className="product-detail-page" aria-label={`Detalhes de ${product.name}`}>
      <nav className="product-breadcrumb" aria-label="Caminho do produto">
        <button type="button" onClick={onBack}>Vitrine</button>
        <span>/</span>
        <span>{product.category?.name || 'Produtos'}</span>
      </nav>
      <div className="product-detail-grid">
        <div className="product-modal-visual">
          <div className="gallery-main">
            {activeImage ? <img src={activeImage} alt={gallerySelection ? product.name : `${product.name}${selectedSize?.imageUrl ? ` - ${selectedSize.name}` : selectedOption?.imageUrl ? ` - ${selectedOption.name}` : ''}`} /> : <ChefHat size={42} />}
          </div>

          {productImages.length > 1 ? (
            <div className="gallery-strip">
              {productImages.map((image) => (
                <button
                  key={image}
                  className={gallerySelection === image ? 'gallery-thumb active' : 'gallery-thumb'}
                  type="button"
                  onClick={() => setGallerySelection(image)}
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
          </div>

          <div className="rating-summary">
            <RatingStars value={feedback?.averageRating || 0} />
            <strong>{formatRating(feedback?.averageRating)}</strong>
            <a href="#avaliacoes">{feedback?.reviewsCount || 0} avaliações</a>
          </div>

          {flavors.length > 0 ? <div className="detail-section">
            <h3>Sabores (escolha um)</h3>
              <div className="flavor-list">
                {flavors.map((flavor) => (
                  <button
                    key={flavor.id || flavor.name}
                    className={effectiveFlavor === flavor.name ? 'active' : ''}
                    type="button"
                    aria-pressed={effectiveFlavor === flavor.name}
                    onClick={() => { setSelectedFlavor(flavor.name); setGallerySelection(null) }}
                  >
                    <span>{flavor.imageUrl ? <img className="choice-image" src={getAssetUrl(flavor.imageUrl)} alt="" /> : null}{flavor.name}</span>
                    {flavor.description ? <small>{flavor.description}</small> : null}
                    <small>{formatPriceAdjustment(flavor.priceAdjustment)}</small>
                  </button>
                ))}
              </div>
          </div> : null}

          {sizes.length > 0 ? <div className="detail-section">
            <h3>Tamanho (escolha um)</h3>
            <div className="flavor-list" role="group" aria-label="Tamanho obrigatório">
              {sizes.map((size) => <button
                key={size.id}
                type="button"
                className={selectedSizeId === size.id ? 'active' : ''}
                aria-pressed={selectedSizeId === size.id}
                onClick={() => { setSelectedSizeId(size.id); setGallerySelection(null) }}
              ><span>{size.imageUrl ? <img className="choice-image" src={getAssetUrl(size.imageUrl)} alt="" /> : null}{size.name}{size.description ? <small>{size.description}</small> : null}</span><small>{money.format(Number(size.price))}</small></button>)}
            </div>
            {!selectedSize ? <p className="muted-note">Escolha um tamanho para comprar.</p> : null}
          </div> : null}

          {addons.length > 0 ? <div className="detail-section">
            <h3>Adicionais (opcionais)</h3>
            <div className="addon-choice-list">
              {addons.map((addon) => <label key={addon.id}>
                <input type="checkbox" checked={selectedAddonIds.includes(addon.id)} onChange={(event) => setSelectedAddonIds((current) => event.target.checked ? [...current, addon.id] : current.filter((id) => id !== addon.id))} />
                <span>{addon.imageUrl ? <img className="choice-image" src={getAssetUrl(addon.imageUrl)} alt="" /> : null}{addon.name}{addon.description ? <small>{addon.description}</small> : null}</span>
                <strong>+{money.format(Number(addon.price))}</strong>
              </label>)}
            </div>
          </div> : null}

          <div className="seller-card">
            <div className="profile-avatar">
              {sellerImage ? <img src={sellerImage} alt={product.seller?.name} /> : <UserRound size={20} />}
            </div>
            <div>
              <strong>{product.seller?.name}</strong>
              <span><Phone size={14} /> {product.seller?.phone || 'Telefone não informado'}</span>
            </div>
          </div>

          <p className="product-local-note"><MapPin size={17} /> Retirada, entrega interna ou ponto de encontro, conforme o pedido.</p>

          <div className="modal-purchase-bar">
            <div>
              <strong>{sizes.length > 0 && !selectedSize ? 'Escolha um tamanho' : money.format(pricing.unit)}</strong>
              {pricing.discount > 0 ? <small className="old-price">Desconto no tamanho/base: -{money.format(pricing.discount)}</small> : null}
              {selectedSize ? <small>{selectedSize.name}: {money.format(Number(selectedSize.price))}</small> : null}
              {selectedOption?.priceAdjustment ? <small>Sabor: {formatPriceAdjustment(selectedOption.priceAdjustment)}</small> : null}
              {selectedAddons.map((addon) => <small key={addon.id}>{addon.name}: +{money.format(Number(addon.price))}</small>)}
              {sizes.length === 0 || selectedSize ? <small>Total para {quantity}: {money.format(pricing.unit * quantity)}</small> : null}
              {discountLabel ? <small>Desconto do produto somente na base; cupom sobre base e adicionais no fechamento.</small> : null}
              <span>{product.quantity} disponíveis</span>
            </div>
            <div className="product-quantity">
              <span>Quantidade</span>
              <div>
                <button type="button" aria-label="Diminuir quantidade" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>−</button>
                <output aria-label="Quantidade selecionada">{quantity}</output>
                <button type="button" aria-label="Aumentar quantidade" onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))} disabled={quantity >= product.quantity}>+</button>
              </div>
            </div>
            <div className="purchase-actions">
              <button
                className="primary-button compact-button"
                type="button"
                onClick={() => onBuyNow({ ...product, selectedFlavor: effectiveFlavor, selectedSizeId, selectedAddonIds, selectedQuantity: quantity })}
                disabled={isUnavailable || (sizes.length > 0 && !selectedSize)}
              >
                <CreditCard size={18} />
                Comprar agora
              </button>
              <button
                className="ghost-button compact-button"
                type="button"
                onClick={() => onAdd({ ...product, selectedFlavor: effectiveFlavor, selectedSizeId, selectedAddonIds, selectedQuantity: quantity })}
                disabled={isUnavailable || (sizes.length > 0 && !selectedSize)}
              >
                <Plus size={18} />
                Adicionar ao carrinho
              </button>
            </div>
          </div>

          <div className="detail-section product-description">
            <h3>Descrição</h3>
            <p>{product.description || 'O vendedor ainda não adicionou uma descrição detalhada.'}</p>
          </div>

          <div className="detail-section" id="avaliacoes">
            <div className="section-heading compact-heading">
              <h3>Avaliações e comentários</h3>
              <span>{reviews.length} registros</span>
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

            {reviews.length === 0 ? (
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
      </div>
    </section>
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

function NotificationsView({ notifications, onOpen, onMarkAllRead }) {
  const [filter, setFilter] = useState('all')
  const isRequest = (item) => ['environment_application', 'seller_application', 'membership'].includes(item.resourceType)
    || ['access', 'admin-access', 'platform-access'].includes(item.targetView)
    || /solicita[cç][aã]o/i.test(item.title || '')
  const isOrder = (item) => item.resourceType === 'order'
    || ['my-orders', 'seller-orders'].includes(item.targetView)
  const filtered = notifications.filter((item) => filter === 'all'
    || (filter === 'unread' && !item.readAt)
    || (filter === 'requests' && isRequest(item))
    || (filter === 'orders' && isOrder(item)))
  const unreadCount = notifications.filter((item) => !item.readAt).length

  return (
    <section className="main-column full notifications-page">
      <div className="section-heading">
        <div><h2>Notificações</h2><p className="section-subtitle">Atualizações do seu ambiente e dos seus pedidos.</p></div>
        <button className="ghost-button" type="button" onClick={onMarkAllRead} disabled={!unreadCount}><Check size={16} /> Marcar todas como lidas</button>
      </div>
      <div className="order-filters" aria-label="Filtrar notificações">
        {[['all', `Todas (${notifications.length})`], ['unread', `Não lidas (${unreadCount})`], ['requests', 'Solicitações'], ['orders', 'Pedidos']].map(([value, label]) => (
          <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </div>
      <div className="notifications-page-list">
        {filtered.map((item) => {
          const Icon = isOrder(item) ? ShoppingCart : isRequest(item) ? FileText : Bell
          return <button key={item.id} className={item.readAt ? 'notification-row read' : 'notification-row'} type="button" onClick={() => onOpen(item)}>
            <span className="notification-row-icon"><Icon size={20} /></span>
            <span className="notification-row-copy"><strong>{item.title}</strong><span>{item.message}</span></span>
            <time>{formatDate(item.createdAt)}</time>
          </button>
        })}
        {filtered.length === 0 ? <EmptyState text="Nenhuma notificação neste filtro." /> : null}
      </div>
    </section>
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
              <article className="line-card cart-line" key={getCartConfigurationKey(item)}>
                <div className="cart-item-thumb">
                  {getAssetUrl(getCartImage(item)) ? (
                    <img src={getAssetUrl(getCartImage(item))} alt={`${item.name}${item.selectedFlavor ? ` - ${item.selectedFlavor}` : ''}`} />
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
                  {item.selectedSizeName ? <small>Tamanho: {item.selectedSizeName} - {money.format(Number(item.cartBasePrice || 0))}</small> : null}
                  {item.cartAddons?.map((addon) => <small key={addon.id} className="option-summary-line">{addon.imageUrl ? <img src={getAssetUrl(addon.imageUrl)} alt="" /> : null}{addon.name}: +{money.format(Number(addon.price))}</small>)}
                  {item.cartDiscount > 0 ? <small>Desconto na base: -{money.format(item.cartDiscount)}</small> : null}
                </div>
                <div className="quantity-control">
                  <button type="button" onClick={() => onQuantity(getCartConfigurationKey(item), -1)} aria-label={`Diminuir ${item.name}`}>-</button>
                  <span>{item.cartQuantity}</span>
                  <button type="button" onClick={() => onQuantity(getCartConfigurationKey(item), 1)} aria-label={`Aumentar ${item.name}`}>+</button>
                </div>
                <strong>{money.format(unitPrice * item.cartQuantity)}</strong>
                <button className="icon-button danger" type="button" onClick={() => onRemove(getCartConfigurationKey(item))} aria-label={`Remover ${item.name}`}>
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
          <div className="experimental-banner compact-banner checkout-intermediation">
            <ShieldCheck size={18} />
            <div>
              <strong>Pagamento intermediado pelo Time Out</strong>
              <span>Ambiente de teste: nenhum valor real será movimentado.</span>
            </div>
          </div>
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
        <p className="muted-note">O cupom é validado sobre o subtotal completo, incluindo tamanhos e adicionais, quando o pedido é enviado. Os valores são recalculados no servidor.</p>
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
  const simulatedStatus = payment.status || order.paymentStatus || 'pending'
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

          {order.items?.length > 0 ? <ul className="items-list confirmation-items">
            {order.items.map((item) => {
              const snapshot = getOrderOptionsSnapshot(item)
              return <li key={item.id}><span>
                {item.quantity}x {item.product?.name || 'Produto'}
                {snapshot?.size ? <small>{snapshot.size.name}: {money.format(Number(snapshot.size.price))}</small> : null}
                {snapshot?.flavor ? <small>Sabor: {snapshot.flavor.name}</small> : null}
                {snapshot?.addons?.map((addon) => <small key={addon.id} className="option-summary-line">{addon.imageUrl ? <img src={getAssetUrl(addon.imageUrl)} alt="" /> : null}{addon.name}: +{money.format(Number(addon.price))}</small>)}
                {snapshot?.productDiscount > 0 ? <small>Desconto na base: -{money.format(Number(snapshot.productDiscount))}</small> : null}
                <small>{money.format(Number(item.unitPrice))} por unidade</small>
              </span><strong>{money.format(Number(item.subtotal))}</strong></li>
            })}
          </ul> : null}

          {isMock ? (
            <div className="mock-payment-panel">
              <div className="experimental-banner">
                <ShieldCheck size={19} />
                <div>
                  <strong>Pagamento intermediado pelo Time Out</strong>
                  <span>Simulação sem Pix real, dados bancários ou movimentação de dinheiro.</span>
                </div>
              </div>
              <div className={`mock-payment-status ${simulatedStatus}`}>
                Status atual: <strong>{transactionStatusLabels[simulatedStatus] || 'Pendente'}</strong>
              </div>
              <div className="mock-payment-actions">
                <button type="button" className="success-action" onClick={() => onSimulate(order.id, 'approved')}>
                  <Check size={17} /> Simular pagamento aprovado
                </button>
                <button type="button" className="pending-action" onClick={() => onSimulate(order.id, 'pending')}>
                  <History size={17} /> Simular pagamento pendente
                </button>
                <button type="button" className="danger-action" onClick={() => onSimulate(order.id, 'declined')}>
                  <X size={17} /> Simular pagamento recusado
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
                  O cartão é processado pelo ambiente seguro do gateway. O Time Out não armazena dados de cartão.
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
          <span><Wallet size={16} /> O valor fica reservado até a entrega</span>
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

function PaymentSettingsView({ settings, overview, onSave, onConnect, query, onQuery }) {
  const [form, setForm] = useState(() => ({ ...defaultPaymentSettings, ...settings }))
  const [accountForm, setAccountForm] = useState({
    responsibleName: '',
    storeName: '',
    acceptedTestTerms: false,
  })
  const [connecting, setConnecting] = useState(false)
  const account = overview?.account || { status: 'not_connected' }
  const summary = overview?.summary || {}
  const transactions = overview?.transactions || []
  const connected = account.status === 'connected'

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function connectAccount(event) {
    event.preventDefault()
    setConnecting(true)
    const success = await onConnect(accountForm)
    setConnecting(false)
    if (success) setAccountForm((current) => ({ ...current, acceptedTestTerms: false }))
  }

  return (
    <section className="main-column full receivables-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Ambiente financeiro de teste</span>
          <h2>Recebimentos</h2>
          <p className="section-subtitle">Acompanhe valores simulados reservados e liberados após a entrega.</p>
        </div>
        <span className="experimental-pill"><ShieldCheck size={15} /> Nenhum valor real será movimentado</span>
      </div>

      <div className="receivables-grid">
        <article className="approval-panel payout-account-panel">
          <div className="section-heading compact-heading">
            <div>
              <h3>Conta de recebimento</h3>
              <p className="section-subtitle">Vínculo exclusivamente fictício para validar o fluxo intermediado.</p>
            </div>
            <span className={`status-badge ${account.status}`}>{account.status === 'connected' ? 'Conectada' : account.status === 'suspended' ? 'Suspensa' : 'Não conectada'}</span>
          </div>

          {connected ? (
            <div className="connected-account">
              <BadgeCheck size={28} />
              <div>
                <strong>Conta de teste conectada</strong>
                <span>{account.storeName} · {account.testAccountId}</span>
                <small>Nenhuma conta bancária real foi vinculada.</small>
              </div>
            </div>
          ) : account.status === 'suspended' ? (
            <div className="notice">Esta conta de teste foi suspensa pelo administrador do ambiente.</div>
          ) : (
            <form className="payout-connect-form" onSubmit={connectAccount}>
              <label>Nome do responsável<input value={accountForm.responsibleName} onChange={(event) => setAccountForm({ ...accountForm, responsibleName: event.target.value })} minLength="3" required /></label>
              <label>Nome da loja<input value={accountForm.storeName} onChange={(event) => setAccountForm({ ...accountForm, storeName: event.target.value })} minLength="2" required /></label>
              <label className="checkbox-row"><input type="checkbox" checked={accountForm.acceptedTestTerms} onChange={(event) => setAccountForm({ ...accountForm, acceptedTestTerms: event.target.checked })} required /><span>Aceito os termos do ambiente de testes e entendo que nenhum dinheiro será movimentado.</span></label>
              <button className="primary-button" type="submit" disabled={connecting}>{connecting ? 'Conectando...' : 'Conectar conta de recebimento para testes'}</button>
            </form>
          )}
        </article>

        <article className="approval-panel">
          <PanelHeader icon={CreditCard} title="Formas aceitas no checkout" />
          <div className="payment-settings-grid">
            {Object.entries(paymentMethodSettingFields).map(([method, field]) => (
              <label className="payment-toggle-card" key={method}>
                <input type="checkbox" checked={Boolean(form[field])} onChange={(event) => updateField(field, event.target.checked)} />
                <span><strong>{paymentLabels[method]}</strong><small>{onlinePaymentMethods.includes(method) ? 'Simulação intermediada pelo Time Out' : 'Opção registrada no pedido de teste'}</small></span>
              </label>
            ))}
          </div>
          <label className="checkbox-line"><input type="checkbox" checked={Boolean(form.isActive)} onChange={(event) => updateField('isActive', event.target.checked)} /> Formas de pagamento ativas</label>
          <button className="ghost-button" type="button" onClick={() => onSave(form)}><Check size={18} /> Salvar formas de pagamento</button>
        </article>
      </div>

      <div className="metrics-grid financial-metrics">
        <article className="metric-card"><span>Vendas brutas movimentadas</span><strong>{money.format(Number(summary.grossMoved || 0))}</strong></article>
        <article className="metric-card"><span>Valores reservados</span><strong>{money.format(Number(summary.heldAmount || 0))}</strong></article>
        <article className="metric-card"><span>Comissões Time Out</span><strong>{money.format(Number(summary.commissions || 0))}</strong></article>
        <article className="metric-card"><span>Saldo líquido disponível</span><strong>{money.format(Number(summary.netAvailable || 0))}</strong></article>
        <article className="metric-card"><span>Valores reembolsados</span><strong>{money.format(Number(summary.refundedAmount || 0))}</strong></article>
      </div>

      <div className="financial-history">
        <div className="section-heading">
          <h3>Histórico de transações simuladas</h3>
          <span>{transactions.length} registros</span>
        </div>
        <div className="financial-table payout-history">
          {transactions.map((transaction) => (
            <div className="financial-row" key={transaction.id}>
              <div><strong>Pedido #{transaction.orderId}</strong><span>{formatDate(transaction.createdAt || transaction.simulatedAt)}</span></div>
              <div><span>Bruto</span><strong>{money.format(Number(transaction.grossAmount || transaction.amount || 0))}</strong></div>
              <div><span>Comissão</span><strong>{money.format(Number(transaction.platformFeeAmount || 0))}</strong></div>
              <div><span>Líquido</span><strong>{money.format(Number(transaction.sellerNetAmount || 0))}</strong></div>
              <span className={`transaction-status ${transaction.status}`}>{transactionStatusLabels[transaction.status] || transaction.status}</span>
              <span className="experimental-pill">Pagamento simulado</span>
              {transaction.settlementBlockedReason ? <span className="settlement-blocked-note">Recebimento retido até a regularização da conta.</span> : null}
            </div>
          ))}
        </div>
        {transactions.length === 0 ? <EmptyState text="Nenhuma transação simulada registrada ainda." /> : null}
        <FinancialHistoryControls overview={overview} query={query} onQuery={onQuery} />
      </div>
    </section>
  )
}

function SalesDashboard({ orders, products }) {
  const [activeDayIndex, setActiveDayIndex] = useState(6)
  const [periodDays, setPeriodDays] = useState(7)
  const periodStart = new Date()
  periodStart.setHours(0, 0, 0, 0)
  periodStart.setDate(periodStart.getDate() - (periodDays - 1))
  const periodOrders = orders.filter((order) => new Date(order.createdAt) >= periodStart)
  const deliveredOrders = periodOrders.filter((order) => order.status === 'delivered')
  const grossTotal = deliveredOrders.reduce((sum, order) => sum + Number(order.grossSalesAmount || order.totalPrice), 0)
  const platformFeeTotal = deliveredOrders.reduce((sum, order) => sum + getOrderPlatformFee(order), 0)
  const sellerNetTotal = deliveredOrders.reduce((sum, order) => sum + getOrderSellerNet(order), 0)
  const pendingOrders = periodOrders.filter((order) => ['pending', 'accepted', 'preparing', 'ready'].includes(order.status)).length
  const averageTicket = deliveredOrders.length ? grossTotal / deliveredOrders.length : 0
  const periodDates = Array.from({ length: periodDays }).map((_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (periodDays - 1 - index))
    return date
  })
  const dailySales = periodDates.map((date) => {
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
    <section className="sales-dashboard-page">
      <div className="section-heading">
        <div>
          <h2>Visão geral</h2>
          <p className="section-subtitle">Acompanhe o desempenho da sua loja.</p>
        </div>
        <div className="heading-actions">
          <label className="period-select"><History size={16} /><span className="sr-only">Período</span><select value={periodDays} onChange={(event) => { setPeriodDays(Number(event.target.value)); setActiveDayIndex(Number(event.target.value) - 1) }}><option value={7}>Últimos 7 dias</option><option value={14}>Últimos 14 dias</option></select></label>
          <button className="export-button" type="button" onClick={exportSalesReport}><Download size={15} /> Exportar</button>
        </div>
      </div>

      <div className="metrics-grid">
          <article className="metric-card">
            <span>Faturamento bruto</span>
            <strong>{money.format(grossTotal)}</strong>
          </article>
          <article className="metric-card">
            <span>Comissões Time Out</span>
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

      <div className="sales-dashboard-lower">
        <div className="chart-card">
          <div className="section-heading compact-heading">
            <h3>Receita líquida dos últimos {periodDays} dias</h3>
            <span>{money.format(sellerNetTotal)}</span>
          </div>
          <div className="bar-chart" style={{ '--chart-days': periodDays }}>
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
      </div>
    </section>
  )
}

function OrdersView({ orders, mode, onCancel, onStatus, title }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [orderSearch, setOrderSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')
  const isSalesHistory = title === 'Histórico de vendas'
  const normalizedSearch = orderSearch.trim().toLocaleLowerCase('pt-BR')
  const visibleOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    const contactName = mode === 'seller' ? order.customer?.name : order.seller?.name
    const matchesSearch = !normalizedSearch || [
      String(order.id),
      contactName,
      ...order.items.map((item) => item.product?.name),
    ].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(normalizedSearch))

    const createdAt = new Date(order.createdAt)
    const matchesFrom = !isSalesHistory || !dateFrom || createdAt >= new Date(`${dateFrom}T00:00:00`)
    const matchesTo = !isSalesHistory || !dateTo || createdAt <= new Date(`${dateTo}T23:59:59.999`)

    return matchesStatus && matchesSearch && matchesFrom && matchesTo
  }).sort((first, second) => sortOrder === 'oldest'
    ? new Date(first.createdAt) - new Date(second.createdAt)
    : new Date(second.createdAt) - new Date(first.createdAt))

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

      {isSalesHistory ? (
        <div className="sales-history-controls">
          <label>De<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label>Até<input type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
          <label>Ordenação<select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="newest">Mais recentes</option><option value="oldest">Mais antigos</option></select></label>
        </div>
      ) : null}

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
                  {getAssetUrl(getOrderItemImage(order.items[0])) ? (
                    <img src={getAssetUrl(getOrderItemImage(order.items[0]))} alt={`${order.items[0].product.name}${order.items[0].selectedFlavor ? ` - ${order.items[0].selectedFlavor}` : ''}`} />
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
                    <Percent size={15} /> Comissão Time Out ({formatPercent(order.commissionRate ?? order.platformFeeRate)}):{' '}
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
                    {getOrderOptionsSnapshot(item)?.size ? <small>Tamanho: {getOrderOptionsSnapshot(item).size.name} ({money.format(Number(getOrderOptionsSnapshot(item).size.price))})</small> : null}
                    {getOrderOptionsSnapshot(item)?.addons?.map((addon) => <small key={addon.id} className="option-summary-line">{addon.imageUrl ? <img src={getAssetUrl(addon.imageUrl)} alt="" /> : null}{addon.name}: +{money.format(Number(addon.price))}</small>)}
                    {getOrderOptionsSnapshot(item)?.productDiscount > 0 ? <small>Desconto na base: -{money.format(Number(getOrderOptionsSnapshot(item).productDiscount))}</small> : null}
                    <small>Preço por unidade: {money.format(Number(item.unitPrice))}</small>
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
            !['held', 'settled', 'paid', 'not_required'].includes(order.paymentStatus) &&
            !['canceled', 'refused'].includes(order.status) ? (
              <p className="muted-note">Aguarde a aprovação simulada para que o valor fique reservado e o pedido possa avançar.</p>
            ) : null}

            {mode === 'seller' &&
            !['delivered', 'canceled', 'refused'].includes(order.status) &&
            ['held', 'settled', 'paid', 'not_required'].includes(order.paymentStatus) ? (
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

function FlavorImageControl({ option, onChange }) {
  const preview = useMemo(() => option.imageFile ? URL.createObjectURL(option.imageFile) : getAssetUrl(option.imageUrl), [option.imageFile, option.imageUrl])
  useEffect(() => () => { if (option.imageFile && preview) URL.revokeObjectURL(preview) }, [option.imageFile, preview])

  return <div className="flavor-image-control">
    <div className="flavor-image-preview">
      {preview ? <img src={preview} alt={`Foto da opção ${option.name || 'sem nome'}`} /> : <ChefHat size={19} />}
    </div>
    <label className="flavor-image-upload">
      {preview ? 'Trocar foto' : 'Adicionar foto'}
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) onChange({ imageFile: file, removeImage: false })
      }} />
    </label>
    {preview ? <button type="button" className="flavor-image-remove" onClick={() => onChange({ imageFile: null, imageUrl: null, removeImage: true })}>Remover foto</button> : null}
  </div>
}

function OptionPreviewImage({ option, className = '', alt = '' }) {
  const fileUrl = useMemo(() => option?.imageFile ? URL.createObjectURL(option.imageFile) : null, [option])
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl) }, [fileUrl])
  const url = fileUrl || getAssetUrl(option?.imageUrl)
  return url ? <img className={className} src={url} alt={alt} /> : null
}

const productOptionGroups = [
  { key: 'flavors', title: 'Variações', rule: 'Escolha única, quando houver. Ajusta o preço do produto ou do tamanho escolhido.', label: 'Variação', priceLabel: 'Ajuste de preço (R$)', example: 'Ex: chocolate' },
  { key: 'sizeOptions', title: 'Tamanhos ou porções', rule: 'Escolha obrigatória de exatamente uma opção quando tamanhos estiverem cadastrados. O preço substitui o preço base.', label: 'Tamanho ou porção', priceLabel: 'Preço do tamanho (R$)', example: 'Ex: 500 ml' },
  { key: 'addons', title: 'Adicionais', rule: 'Escolha opcional de vários itens. Cada preço é somado após o desconto do produto.', label: 'Adicional', priceLabel: 'Preço do adicional (R$)', example: 'Ex: paçoca' },
]

function ProductOptionsPage({ initialOptions, product, onConfirm, onBack, onDirtyChange }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(productOptionGroups.map(({ key }) => [key, initialOptions[key].map((option) => ({ ...option }))])))
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [previewFlavorId, setPreviewFlavorId] = useState('')
  const [previewSizeId, setPreviewSizeId] = useState('')
  const [previewAddonIds, setPreviewAddonIds] = useState([])
  const activeFlavors = draft.flavors.filter((option) => option.isActive !== false && option.name.trim())
  const activeSizes = draft.sizeOptions.filter((option) => option.isActive !== false && option.name.trim())
  const activeAddons = draft.addons.filter((option) => option.isActive !== false && option.name.trim())
  const previewFlavor = activeFlavors.find((option) => option.id === previewFlavorId) || activeFlavors[0] || null
  const previewSize = activeSizes.find((option) => option.id === previewSizeId) || activeSizes[0] || null
  const previewAddons = activeAddons.filter((option) => previewAddonIds.includes(option.id))
  const previewPrice = getSelectionPricing(product, previewFlavor, previewSize, previewAddons)
  const previewImageOption = previewSize?.imageFile || previewSize?.imageUrl ? previewSize : previewFlavor?.imageFile || previewFlavor?.imageUrl ? previewFlavor : product

  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function changeOptions(group, options) {
    setDraft((current) => ({ ...current, [group]: options }))
    setDirty(true)
    setError('')
  }

  function updateOption(group, index, patch) {
    changeOptions(group, draft[group].map((option, position) => position === index ? { ...option, ...patch } : option))
  }

  function moveOption(group, index, offset) {
    const options = [...draft[group]]
    const target = index + offset
    if (target < 0 || target >= options.length) return
    ;[options[index], options[target]] = [options[target], options[index]]
    changeOptions(group, options)
  }

  function back() {
    if (dirty && !window.confirm('Descartar alterações nas opções e voltar ao produto?')) return
    onBack()
  }

  function confirm() {
    for (const group of productOptionGroups) {
      const options = draft[group.key]
      const names = new Set()
      for (const option of options) {
        const name = option.name.trim()
        const price = Number(group.key === 'flavors' ? option.priceAdjustment : option.price)
        if (!name || name.length > 80 || option.description?.length > 160 || (group.key !== 'flavors' && String(option.price ?? '').trim() === '') || !Number.isFinite(price) || (group.key === 'sizeOptions' ? price <= 0 : group.key === 'addons' ? price < 0 : false) || Math.abs(Math.round(price * 100) - price * 100) > 0.000001) {
          setError(`Confira nome, descrição e preço de cada ${group.label.toLowerCase()}.`)
          return
        }
        const key = name.toLocaleLowerCase('pt-BR')
        if (names.has(key)) { setError(`Há nomes repetidos em ${group.title.toLowerCase()}.`); return }
        names.add(key)
      }
      if (group.key !== 'addons' && options.length && options.every((option) => option.isActive === false)) {
        setError(`Mantenha pelo menos uma opção ativa em ${group.title.toLowerCase()} ou remova o grupo.`)
        return
      }
    }
    onConfirm(draft)
  }

  return <section className="product-options-page">
    <div className="section-heading option-page-heading">
      <div><button className="ghost-button" type="button" onClick={back}><ArrowLeft size={16} /> Voltar ao produto</button><h2>Opções e adicionais</h2><p>{product.name || 'Novo produto'}</p></div>
      <button className="primary-button" type="button" onClick={confirm}>Concluir configuração</button>
    </div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="option-page-layout">
      <div className="option-page-editors">
        {productOptionGroups.map((group) => <section className="option-editor" key={group.key}>
          <div className="option-editor-heading"><div><h3>{group.title}</h3><p>{group.rule}</p></div><button className="ghost-button" type="button" onClick={() => changeOptions(group.key, [...draft[group.key], { id: newFlavorId(), name: '', description: '', priceAdjustment: 0, price: '', isActive: true, imageUrl: null, imageFile: null, removeImage: false }])}><Plus size={16} /> Adicionar</button></div>
          {draft[group.key].length === 0 ? <p className="muted-note">Nenhuma opção cadastrada neste grupo.</p> : null}
          {draft[group.key].map((option, index) => <div className="option-row" key={option.id}>
            <label>{group.label}<input value={option.name} maxLength={80} onChange={(event) => updateOption(group.key, index, { name: event.target.value })} placeholder={group.example} /></label>
            <label>Descrição curta<input value={option.description || ''} maxLength={160} onChange={(event) => updateOption(group.key, index, { description: event.target.value })} placeholder="Opcional" /></label>
            <label>{group.priceLabel}<input type="number" step="0.01" min={group.key === 'sizeOptions' ? '0.01' : group.key === 'addons' ? '0' : undefined} value={group.key === 'flavors' ? option.priceAdjustment : option.price} onChange={(event) => updateOption(group.key, index, { [group.key === 'flavors' ? 'priceAdjustment' : 'price']: event.target.value })} /></label>
            <FlavorImageControl option={option} onChange={(patch) => updateOption(group.key, index, patch)} />
            <div className="option-row-actions"><label><input type="checkbox" checked={option.isActive !== false} onChange={(event) => updateOption(group.key, index, { isActive: event.target.checked })} /> Ativo</label><button type="button" onClick={() => moveOption(group.key, index, -1)} disabled={index === 0} aria-label={`Subir ${option.name || group.label}`}>↑</button><button type="button" onClick={() => moveOption(group.key, index, 1)} disabled={index === draft[group.key].length - 1} aria-label={`Descer ${option.name || group.label}`}>↓</button></div>
            <button className="icon-button danger" type="button" onClick={() => changeOptions(group.key, draft[group.key].filter((_, position) => position !== index))} title={`Remover ${group.label.toLowerCase()}`}><Trash2 size={16} /></button>
          </div>)}
        </section>)}
      </div>
      <aside className="option-preview" aria-label="Prévia para o comprador">
        <h3>Prévia do cliente</h3>
        <strong>{product.name || 'Nome do produto'}</strong>
        <OptionPreviewImage option={previewImageOption} className="option-preview-main-image" alt={product.name || 'Produto'} />
        {activeFlavors.length ? <div><h4>Variação · escolha única</h4>{activeFlavors.map((option) => <button className={previewFlavor?.id === option.id ? 'selected' : ''} key={option.id} type="button" onClick={() => setPreviewFlavorId(option.id)}><OptionPreviewImage option={option} /><span>{option.name}{option.description ? <small>{option.description}</small> : null}</span><small>{formatPriceAdjustment(option.priceAdjustment)}</small></button>)}</div> : null}
        {activeSizes.length ? <div><h4>Tamanho · obrigatório, escolha única</h4>{activeSizes.map((option) => <button className={previewSize?.id === option.id ? 'selected' : ''} key={option.id} type="button" onClick={() => setPreviewSizeId(option.id)}><OptionPreviewImage option={option} /><span>{option.name}{option.description ? <small>{option.description}</small> : null}</span><small>{money.format(Number(option.price || 0))}</small></button>)}</div> : null}
        {activeAddons.length ? <div><h4>Adicionais · escolha múltipla opcional</h4>{activeAddons.map((option) => <label key={option.id}><input type="checkbox" checked={previewAddonIds.includes(option.id)} onChange={(event) => setPreviewAddonIds((current) => event.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id))} /><OptionPreviewImage option={option} /><span>{option.name}{option.description ? <small>{option.description}</small> : null}</span><small>+{money.format(Number(option.price || 0))}</small></label>)}</div> : null}
        <p>Base {money.format(previewPrice.base)}{previewPrice.discount > 0 ? ` · Desconto -${money.format(previewPrice.discount)}` : ''}{previewPrice.addonsTotal > 0 ? ` · Adicionais +${money.format(previewPrice.addonsTotal)}` : ''}</p>
        <strong className="option-preview-total">{money.format(previewPrice.unit)} por unidade</strong>
      </aside>
    </div>
  </section>
}

function SellerProductsView({ products, productsLoading, pagination, loadingMore, onLoadMore, categories, onSave, onToggle, onDelete, onOptionsDirty }) {
  const emptyForm = {
    name: '',
    description: '',
    flavors: [],
    sizeOptions: [],
    addons: [],
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
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [optionDraftDirty, setOptionDraftDirty] = useState(false)
  const [pendingOptionsSave, setPendingOptionsSave] = useState(false)
  const [savingProduct, setSavingProduct] = useState(false)
  const [saveError, setSaveError] = useState('')
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
    onOptionsDirty(optionDraftDirty || pendingOptionsSave)
    return () => onOptionsDirty(false)
  }, [optionDraftDirty, pendingOptionsSave, onOptionsDirty])

  useEffect(() => {
    if (!pendingOptionsSave) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pendingOptionsSave])

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
    setOptionsOpen(false)
    setPendingOptionsSave(false)
    setOptionDraftDirty(false)
    setSaveError('')
  }

  function editProduct(product) {
    if ((pendingOptionsSave || optionDraftDirty) && !window.confirm('Descartar alterações nas opções deste produto?')) return
    setEditingProduct(product)
    setOptionsOpen(false)
    setPendingOptionsSave(false)
    setSaveError('')
    setForm({
      name: product.name,
      description: product.description || '',
      flavors: parseProductFlavors(product.flavors).map((option) => ({ ...option, id: option.id || newFlavorId(), imageFile: null, removeImage: false })),
      sizeOptions: parseChoiceOptions(product.sizeOptions).map((option) => ({ ...option, imageFile: null, removeImage: false })),
      addons: parseChoiceOptions(product.addons).map((option) => ({ ...option, imageFile: null, removeImage: false })),
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
    setSavingProduct(true)
    setSaveError('')
    const saved = await onSave(
      {
        ...form,
        price: parseMoneyValue(form.price),
        discountType: form.discountType || '',
        discountValue: form.discountType ? parseMoneyValue(form.discountValue) : '',
        discountStartsAt: form.discountType ? form.discountStartsAt || '' : '',
        discountEndsAt: form.discountType ? form.discountEndsAt || '' : '',
        flavors: form.flavors
          .map((option) => ({
            id: option.id,
            name: option.name.trim(),
            description: (option.description || '').trim(),
            priceAdjustment: parseMoneyValue(option.priceAdjustment),
            isActive: option.isActive !== false,
            removeImage: Boolean(option.removeImage),
          }))
          .filter((option) => option.name),
        flavorImageFiles: form.flavors.filter((option) => option.name.trim() && option.imageFile).map((option) => ({ id: option.id, file: option.imageFile })),
        sizeOptions: form.sizeOptions.map((option) => ({ id: option.id, name: option.name.trim(), description: (option.description || '').trim(), price: parseMoneyValue(option.price), isActive: option.isActive !== false, removeImage: Boolean(option.removeImage) })).filter((option) => option.name),
        sizeImageFiles: form.sizeOptions.filter((option) => option.name.trim() && option.imageFile).map((option) => ({ id: option.id, file: option.imageFile })),
        addons: form.addons.map((option) => ({ id: option.id, name: option.name.trim(), description: (option.description || '').trim(), price: parseMoneyValue(option.price), isActive: option.isActive !== false, removeImage: Boolean(option.removeImage) })).filter((option) => option.name),
        addonImageFiles: form.addons.filter((option) => option.name.trim() && option.imageFile).map((option) => ({ id: option.id, file: option.imageFile })),
        quantity: Number(form.quantity),
        categoryId: Number(form.categoryId || categories[0]?.id),
        isActive: Boolean(form.isActive),
        imageGallery: form.imageGallery,
      },
      editingProduct?.id,
    )
    setSavingProduct(false)
    if (!saved) setSaveError('Não foi possível salvar. Confira os dados e tente novamente.')
    if (saved) resetForm()
  }

  if (optionsOpen) return <ProductOptionsPage
    initialOptions={form}
    product={form}
    onBack={() => setOptionsOpen(false)}
    onDirtyChange={setOptionDraftDirty}
    onConfirm={(options) => { setForm((current) => ({ ...current, ...options })); setPendingOptionsSave(true); setOptionsOpen(false) }}
  />

  return (
    <section className="content-grid two-columns">
      <div className="main-column">
        <div className="section-heading">
          <div><h2>Meus produtos</h2><p className="section-subtitle">Gerencie os produtos do seu cardápio.</p></div>
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
        {productsLoading ? <p role="status">Carregando produtos...</p> : visibleProducts.length === 0 ? <EmptyState text={pagination.page < pagination.totalPages ? 'Nenhum produto encontrado entre os carregados.' : 'Nenhum produto encontrado neste filtro.'} /> : null}
        {pagination.page < pagination.totalPages ? <button className="ghost-button" type="button" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? 'Carregando...' : 'Carregar mais produtos'}</button> : null}
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
        <div className="product-options-entry">
          <button className="ghost-button" type="button" onClick={() => setOptionsOpen(true)}><Plus size={16} /> Configurar opções e adicionais</button>
          <p>{form.flavors.length} variações · {form.sizeOptions.length} tamanhos · {form.addons.length} adicionais</p>
          {form.sizeOptions.length > 0 ? <small>Tamanho obrigatório · escolha única</small> : null}
          {form.flavors.length > 0 ? <small>Variação exclusiva · escolha única</small> : null}
          {form.addons.length > 0 ? <small>Adicionais opcionais · escolha múltipla</small> : null}
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
        {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
        <button className="primary-button" type="submit" disabled={savingProduct}>
          <Check size={18} />
          {savingProduct ? 'Salvando...' : editingProduct ? 'Salvar alterações' : 'Salvar produto'}
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
  const [couponFilter, setCouponFilter] = useState('all')
  const [couponSearch, setCouponSearch] = useState('')
  const [now] = useState(() => Date.now())
  const visibleCoupons = coupons.filter((coupon) => {
    const scheduled = coupon.startsAt && new Date(coupon.startsAt).getTime() > now
    const expired = coupon.endsAt && new Date(coupon.endsAt).getTime() < now
    const matchesFilter = couponFilter === 'all'
      || (couponFilter === 'active' && coupon.isActive && !scheduled && !expired)
      || (couponFilter === 'scheduled' && coupon.isActive && scheduled)
      || (couponFilter === 'expired' && expired)
    const query = couponSearch.trim().toLocaleLowerCase('pt-BR')
    return matchesFilter && (!query || `${coupon.code} ${coupon.description || ''}`.toLocaleLowerCase('pt-BR').includes(query))
  })

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
          <div><h2>Cupons e promoções</h2><p className="section-subtitle">Crie e gerencie cupons de desconto para seus clientes.</p></div>
          <span>{coupons.length} cupons</span>
        </div>

        <div className="coupon-toolbar">
          <div className="order-filters" aria-label="Filtrar cupons">
            {[['all', 'Todos'], ['active', 'Ativos'], ['scheduled', 'Agendados'], ['expired', 'Expirados']].map(([value, label]) => (
              <button key={value} type="button" className={couponFilter === value ? 'active' : ''} onClick={() => setCouponFilter(value)}>{label}</button>
            ))}
          </div>
          <div className="search-field"><Search size={17} /><input value={couponSearch} onChange={(event) => setCouponSearch(event.target.value)} placeholder="Buscar cupom" aria-label="Buscar cupom" /></div>
        </div>

        <div className="stack">
          {visibleCoupons.map((coupon) => (
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

        {visibleCoupons.length === 0 ? <EmptyState text={coupons.length ? 'Nenhum cupom encontrado neste filtro.' : 'Nenhum cupom criado ainda.'} /> : null}
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
          <h2>Planos para vender no Time Out</h2>
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

function SellerFinancialView({ overview, onPlans, query, onQuery }) {
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
        <article className="metric-card"><span>Transações liquidadas</span><strong>{summary.settledCount || 0}</strong></article>
        <article className="metric-card"><span>Faturamento bruto</span><strong>{money.format(Number(summary.grossRevenue || 0))}</strong></article>
        <article className="metric-card"><span>Comissões Time Out</span><strong>{money.format(Number(summary.commissions || 0))}</strong></article>
        <article className="metric-card"><span>Receita líquida</span><strong>{money.format(Number(summary.netAvailable || 0))}</strong></article>
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
              <strong>{money.format(Number(transaction.grossAmount || transaction.amount))}</strong>
              <span className={`transaction-status ${transaction.status}`}>
                {transactionStatusLabels[transaction.status] || transaction.status}
              </span>
              {transaction.settlementBlockedReason ? <span className="settlement-blocked-note">Recebimento retido: regularize a conta de recebimento.</span> : null}
            </div>
          ))}
        </div>
        {transactions.length === 0 ? <EmptyState text="Nenhum pagamento simulado registrado ainda." /> : null}
        <FinancialHistoryControls overview={overview} query={query} onQuery={onQuery} />
      </div>
    </section>
  )
}

function FinancialHistoryControls({ overview, query, onQuery, environments = [] }) {
  if (!query || !onQuery) return null
  const page = Number(overview?.page || query.page || 1)
  const totalPages = Number(overview?.totalPages || 1)
  const update = (changes) => onQuery((current) => ({ ...current, page: 1, ...changes }))
  return (
    <div className="financial-history-controls">
      <div className="financial-history-filters">
        <select value={query.status} onChange={(event) => update({ status: event.target.value })} aria-label="Filtrar por status">
          <option value="">Todos os status</option>
          {Object.entries(transactionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label>De<input type="date" value={query.dateFrom} onChange={(event) => update({ dateFrom: event.target.value })} /></label>
        <label>Até<input type="date" value={query.dateTo} onChange={(event) => update({ dateTo: event.target.value })} /></label>
        <select value={query.order} onChange={(event) => update({ order: event.target.value })} aria-label="Ordenar histórico">
          <option value="desc">Mais recentes</option>
          <option value="asc">Mais antigas</option>
        </select>
        {environments.length ? (
          <select value={query.environmentId || ''} onChange={(event) => update({ environmentId: event.target.value })} aria-label="Filtrar por ambiente">
            <option value="">Todos os ambientes</option>
            {environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
          </select>
        ) : null}
      </div>
      <div className="pagination-bar">
        <span>{overview?.total || 0} registros · página {page} de {totalPages}</span>
        <div className="row-actions">
          <button className="ghost-button" type="button" disabled={page <= 1} onClick={() => onQuery((current) => ({ ...current, page: page - 1 }))}>Anterior</button>
          <button className="ghost-button" type="button" disabled={page >= totalPages} onClick={() => onQuery((current) => ({ ...current, page: page + 1 }))}>Próxima</button>
        </div>
      </div>
    </div>
  )
}

function RetainedTransactions({ overview, onRetry }) {
  const retained = (overview?.transactions || []).filter((transaction) => transaction.settlementBlockedReason)
  if (!retained.length) return null
  return (
    <div className="retained-transactions">
      <div className="section-heading compact-heading"><h3>Recebimentos retidos</h3><span>{retained.length}</span></div>
      {retained.map((transaction) => (
        <article className="application-card" key={transaction.id}>
          <div><strong>Pedido #{transaction.orderId}</strong><span className="status-badge suspended">Retido</span></div>
          <p>O recebimento não foi liberado porque a conta do vendedor está indisponível. Reative a conta antes de tentar novamente.</p>
          <button className="ghost-button" type="button" onClick={() => onRetry(transaction.orderId)}><RefreshCcw size={16} /> Tentar liberar novamente</button>
        </article>
      ))}
    </div>
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

function AccessCenterView({ user, data, environmentOnly = false, onOpenEnvironment, onBack, onSellerApply, onEnvironmentApply, onJoinEnvironment, onSwitchEnvironment }) {
  const [sellerForm, setSellerForm] = useState({
    fullName: user.name || '', cpf: '', birthDate: '', phone: user.phone || '', storeName: '',
    activityDescription: '', productCategories: '', reason: '', acceptedTerms: false, document: null,
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
    const formData = new FormData()
    Object.entries(sellerForm).forEach(([key, value]) => {
      if (value !== '' && value !== null) formData.append(key, value)
    })
    setSubmitting(true)
    await onSellerApply(formData)
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
    <section className={environmentOnly ? 'main-column full access-page environment-request-page' : 'main-column full access-page'}>
      {environmentOnly ? (
        <div className="section-heading environment-request-heading">
          <div><button className="detail-back" type="button" onClick={onBack}><ArrowLeft size={16} /> Solicitações</button><h2>Solicitar novo ambiente</h2><p className="section-subtitle">Preencha os dados do local para análise da equipe Time Out.</p></div>
        </div>
      ) : (<>
      <div className="section-heading">
        <div><span className="eyebrow">Acesso e responsabilidades</span><h2>Central de solicitações</h2><p className="section-subtitle">Acompanhe decisões e envie dados para análise interna.</p></div>
        <div className="heading-actions"><span className="experimental-pill"><ShieldCheck size={15} /> Verificação {data?.identityVerificationMode === 'mock' ? 'de teste' : 'ativa'}</span>{user.role !== 'platform_admin' ? <button className="ghost-button" type="button" onClick={onOpenEnvironment}><Plus size={16} /> Novo ambiente</button> : null}</div>
      </div>

      {!(user.memberships || []).some((membership) => Number(membership.environmentId) === Number(user.environmentId) && membership.status === 'approved' && membership.environment?.status === 'active') && (
        <p className="access-required-banner"><Lock size={17} /> Entre em um ambiente ativo e aguarde a aprovação antes de acessar a vitrine ou comprar.</p>
      )}

      {(user.memberships || []).length > 0 && <article className="approval-panel"><PanelHeader icon={Building2} title="Meus ambientes" /><div className="stack">{user.memberships.map((membership) => <div className="application-card" key={membership.id}><div><strong>{membership.environment?.name || `Ambiente #${membership.environmentId}`}</strong><span className={`status-badge ${membership.status}`}>{accessStatusLabels[membership.status] || membership.status}</span></div><p>{roleLabel(membership.role)} · {membership.environment?.status === 'suspended' ? 'Ambiente suspenso' : 'Ambiente ativo'}</p><button className="ghost-button" type="button" disabled={membership.status !== 'approved' || membership.environment?.status !== 'active' || Number(membership.environmentId) === Number(user.environmentId)} onClick={() => onSwitchEnvironment(membership.environmentId)}>Usar ambiente</button></div>)}</div></article>}

      {(
        <article className="approval-panel">
          <PanelHeader icon={KeyRound} title="Entrar em outro ambiente" />
          <div className="inline-access-form"><input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Código de acesso" /><button className="primary-button" type="button" disabled={!accessCode.trim()} onClick={() => onJoinEnvironment(accessCode)}><ArrowRight size={17} /> Solicitar entrada</button></div>
        </article>
      )}
      </>)}

      <div className="approval-columns">
        {!environmentOnly && user.environmentId && user.role === 'customer' ? (
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
              <label>Documento opcional<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setSellerForm({ ...sellerForm, document: event.target.files?.[0] || null })} /></label>
              <label className="wide-field">Por que deseja vender?<textarea required minLength={10} value={sellerForm.reason} onChange={(event) => setSellerForm({ ...sellerForm, reason: event.target.value })} /></label>
            </div>
            <label className="checkbox-row"><input type="checkbox" checked={sellerForm.acceptedTerms} onChange={(event) => setSellerForm({ ...sellerForm, acceptedTerms: event.target.checked })} /> Confirmo que os dados são verdadeiros e aceito os termos.</label>
            <p className="muted-note">CPF validado apenas quanto ao formato. A identidade ainda não foi verificada por um serviço externo.</p>
            <button className="primary-button" disabled={submitting || sellerApplicationActive || !sellerForm.acceptedTerms}><Send size={17} /> {sellerApplicationActive ? 'Solicitação já em análise' : 'Enviar solicitação'}</button>
          </form>
        ) : null}

        {environmentOnly && user.role !== 'platform_admin' ? (
          <form className="approval-panel" onSubmit={submitEnvironment}>
            <PanelHeader icon={Building2} title="Dados do ambiente" />
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
            <button className="primary-button" disabled={submitting || environmentApplicationActive}><Send size={17} /> {environmentApplicationActive ? 'Solicitação já em análise' : 'Enviar para a equipe Time Out'}</button>
          </form>
        ) : null}
      </div>

      {!environmentOnly ? <div className="approval-columns">
        <ApplicationList title="Solicitações de vendedor" applications={sellerApplications} />
        <ApplicationList title="Solicitações de ambiente" applications={environmentApplications} />
      </div> : null}
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

function EnvironmentAccessAdminView({ data, focusSellerApplicationId, onReviewSeller, onReviewMembership, onRotateCode, onToggleCode, onRevealCpf, onViewDocument, onNotice }) {
  const [pendingAction, setPendingAction] = useState(null)
  const [regularity, setRegularity] = useState(null)
  const [revealedCpf, setRevealedCpf] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const lastFocusedApplicationRef = useRef(null)
  useEffect(() => {
    if (!focusSellerApplicationId || !data || lastFocusedApplicationRef.current === focusSellerApplicationId) return undefined
    lastFocusedApplicationRef.current = focusSellerApplicationId
    const application = data.sellerApplications?.find((item) => String(item.id) === String(focusSellerApplicationId))
    if (!application) {
      onNotice('A solicitação não está mais disponível neste ambiente. Consulte a listagem.')
      return undefined
    }
    let active = true
    api.get(`/access/environment-admin/sellers/${application.userId}/regularity`)
      .then((response) => { if (active) setRegularity(response.data.data) })
      .catch((error) => { if (active) onNotice(`Não foi possível abrir a solicitação: ${getErrorMessage(error)}`) })
    return () => { active = false }
  }, [data, focusSellerApplicationId, onNotice])
  async function openRegularity(userId) {
    setDetailLoading(true)
    try {
      const response = await api.get(`/access/environment-admin/sellers/${userId}/regularity`)
      setRegularity(response.data.data)
      setRevealedCpf(null)
    } catch (error) { onNotice(getErrorMessage(error)) } finally { setDetailLoading(false) }
  }
  function ask(title, description, run, reasonRequired = true) {
    setPendingAction({ title, description, reasonRequired, run: async (reason) => {
      const result = await run(reason)
      if (result !== false && !['Revelar CPF', 'Abrir documento'].includes(title)) setRegularity(null)
      return result
    } })
  }
  if (!data) return <EmptyState text="Carregando aprovações..." />
  const managedMemberships = (data.memberships || []).filter((item) => !['admin', 'environment_admin'].includes(item.role))
  return (
    <section className="main-column full access-page">
      <div className="section-heading"><div><span className="eyebrow">Administrador do ambiente</span><h2>Acessos e aprovações</h2></div><span className="experimental-pill"><ShieldCheck size={15} /> {data.identityVerificationMode === 'mock' ? 'Ambiente de teste: validações externas estão desativadas.' : 'Fluxo interno'}</span></div>
      <article className="approval-panel code-management">
        <div><PanelHeader icon={KeyRound} title="Código de acesso" /><p>Código atual: <strong>{data.accessCode?.codePreview || 'Prévia indisponível'}</strong></p></div>
        <div className="row-actions"><button className="ghost-button" type="button" onClick={() => ask('Trocar código', 'O código anterior deixará de funcionar.', onRotateCode, false)}><RefreshCcw size={16} /> Gerar novo</button>{data.environment?.accessCodeEnabled ? <button className="ghost-button" type="button" onClick={() => ask('Desativar código', 'Novas entradas serão bloqueadas.', () => onToggleCode(false), false)}><Lock size={16} /> Desativar</button> : <button className="ghost-button" type="button" onClick={() => onToggleCode(true)}><Check size={16} /> Ativar</button>}</div>
      </article>
      <div className="approval-columns">
        <article className="approval-panel"><div className="section-heading compact-heading"><h3>Vendedores</h3><span>{data.sellerApplications?.length || 0}</span></div><div className="stack">
          {(data.sellerApplications || []).map((application) => <div className="application-card" key={application.id}><div><strong>{application.fullName || application.user?.name}</strong><span className={`status-badge ${application.status}`}>{accessStatusLabels[application.status] || application.status}</span></div><p>{application.storeName} · {application.user?.email}</p><p>{application.activityDescription}</p><button className="ghost-button" type="button" disabled={detailLoading} onClick={() => openRegularity(application.userId)}><Eye size={15} /> Regularidade do vendedor</button></div>)}
        </div></article>
        <article className="approval-panel"><div className="section-heading compact-heading"><h3>Entradas no ambiente</h3><span>{managedMemberships.length}</span></div><div className="stack">
          {managedMemberships.map((membership) => <div className="application-card" key={membership.id}><div><strong>{membership.user?.name}</strong><span className={`status-badge ${membership.status}`}>{accessStatusLabels[membership.status]}</span></div><p>{membership.user?.email} · {membership.user?.phone || 'Sem telefone'}</p><div className="row-actions">{membership.status !== 'approved' && <button className="primary-button compact-button" type="button" onClick={() => ask('Aprovar participação', `Permitir entrada de ${membership.user?.name}?`, () => onReviewMembership(membership.id, 'approved'), false)}><Check size={15} /> Aprovar</button>}{membership.status === 'approved' && <button className="ghost-button danger-text" type="button" onClick={() => ask('Suspender participação', `Suspender a entrada de ${membership.user?.name}?`, (reason) => onReviewMembership(membership.id, 'suspended', reason))}>Suspender</button>}{membership.status === 'pending' && <button className="ghost-button danger-text" type="button" onClick={() => ask('Recusar participação', `Recusar a entrada de ${membership.user?.name}?`, (reason) => onReviewMembership(membership.id, 'rejected', reason))}>Recusar</button>}</div></div>)}
          {managedMemberships.length === 0 ? <EmptyState text="Nenhuma participação registrada." /> : null}
        </div></article>
      </div>
      {regularity && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRegularity(null) }}><div className="administrative-dialog wide-dialog" role="dialog" aria-modal="true" aria-label="Regularidade do vendedor"><div className="section-heading compact-heading"><div><h3>Regularidade do vendedor</h3><span>{regularity.user?.name} · {regularity.user?.email}</span></div><button className="icon-button" type="button" title="Fechar" onClick={() => setRegularity(null)}><X size={18} /></button></div><p><strong>Situação:</strong> {regularity.status} · {regularity.decisionReason || 'Sem ressalvas internas'}</p><div className="administrative-detail-grid"><p><strong>Telefone:</strong> {regularity.user?.phone || 'Não informado'}</p><p><strong>CPF:</strong> {revealedCpf || regularity.user?.cpfMasked || 'Não informado'}</p><p><strong>E-mail:</strong> {regularity.user?.emailVerifiedAt ? 'Confirmado' : 'Pendente'}</p><p><strong>Ambiente:</strong> {regularity.environment?.name} · {regularity.membership?.status}</p><p><strong>Loja:</strong> {regularity.application?.storeName}</p><p><strong>Solicitação:</strong> {formatDate(regularity.application?.requestedAt)}</p><p><strong>Aprovado em:</strong> {regularity.application?.status === 'approved' ? formatDate(regularity.application?.reviewedAt) : 'Não aprovado'}</p><p><strong>Responsável:</strong> {regularity.application?.reviewer?.name || 'Não definido'}</p><p><strong>Produtos:</strong> {regularity.products?.active} ativos · {regularity.products?.inactive} inativos</p><p><strong>Pedidos:</strong> {regularity.orders?.total} recebidos · {regularity.orders?.delivered} entregues · {regularity.orders?.canceled} cancelados · {regularity.orders?.refused} recusados</p><p><strong>Recebimento simulado:</strong> {regularity.payoutAccount?.status || 'Não conectado'}</p><p><strong>Validação:</strong> CPF matemático e aprovação interna; verificação externa não realizada.</p></div><div className="row-actions"><button className="ghost-button" type="button" onClick={() => ask('Revelar CPF', 'O acesso será auditado.', async (reason) => setRevealedCpf(await onRevealCpf(regularity.application.id, reason)))}><Eye size={15} /> Revelar CPF</button>{regularity.documentAvailable && <button className="ghost-button" type="button" onClick={() => ask('Abrir documento', 'O acesso será auditado.', (reason) => onViewDocument(regularity.application.id, reason))}><FileText size={15} /> Documento</button>}<button className="primary-button compact-button" type="button" onClick={() => ask('Marcar como regular', 'Aprovar ou reativar este vendedor?', () => onReviewSeller(regularity.application.id, 'approved'), false)}><Check size={15} /> Regular</button><button className="ghost-button" type="button" onClick={() => ask('Solicitar correção', 'A pessoa receberá a justificativa.', (reason) => onReviewSeller(regularity.application.id, 'changes_requested', reason))}>Solicitar correção</button><button className="ghost-button danger-text" type="button" onClick={() => ask('Marcar como irregular', 'Novos produtos e pedidos serão bloqueados.', (reason) => onReviewSeller(regularity.application.id, 'blocked', reason))}><Ban size={15} /> Irregular</button><button className="ghost-button danger-text" type="button" onClick={() => ask('Suspender vendedor', 'Novos produtos e pedidos serão bloqueados.', (reason) => onReviewSeller(regularity.application.id, 'suspended', reason))}>Suspender</button>{!['approved', 'suspended', 'blocked'].includes(regularity.application.status) && <button className="ghost-button danger-text" type="button" onClick={() => ask('Recusar solicitação', 'A pessoa receberá a justificativa.', (reason) => onReviewSeller(regularity.application.id, 'rejected', reason))}>Recusar</button>}</div><h4>Histórico de decisões</h4><ApplicationHistory application={regularity.application} /><div className="audit-list">{(regularity.decisions || []).map((log) => <div key={log.id}><strong>{log.summary}</strong><span>{formatDate(log.createdAt)}</span></div>)}</div></div></div>}
      {pendingAction && <AdministrativeConfirmDialog title={pendingAction.title} description={pendingAction.description} reasonRequired={pendingAction.reasonRequired} onConfirm={pendingAction.run} onClose={() => setPendingAction(null)} />}
    </section>
  )
}

function PlatformAccessView({ data, payoutOverview, focusApplicationId, onReviewApplication, onToggleEnvironment, onTransferEnvironment, onToggleAdministrator, onViewDocument, onViewSellerDocument, onRevealCpf, onRevealSellerCpf, onNotice, onApplicationPage, financialQuery, onFinancialQuery, onRetrySettlement }) {
  const [transfers, setTransfers] = useState({})
  const [pendingAction, setPendingAction] = useState(null)
  const [detail, setDetail] = useState(null)
  const [revealedCpf, setRevealedCpf] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [sellerDetail, setSellerDetail] = useState(null)
  useEffect(() => {
    if (!focusApplicationId) return undefined
    let active = true
    api.get(`/access/platform/environment-applications/${focusApplicationId}`)
      .then((response) => { if (active) setDetail(response.data.data) })
      .catch((error) => { if (active) onNotice(`Não foi possível abrir a solicitação: ${getErrorMessage(error)}. Consulte a listagem.`) })
    return () => { active = false }
  }, [focusApplicationId, onNotice])
  async function openDetail(id) {
    setDetailLoading(true)
    try {
      const response = await api.get(`/access/platform/environment-applications/${id}`)
      setDetail(response.data.data)
      setRevealedCpf(null)
    } catch (error) { onNotice(getErrorMessage(error)) } finally { setDetailLoading(false) }
  }
  async function openSellerDetail(id) {
    setDetailLoading(true)
    try {
      const response = await api.get(`/access/platform/sellers/${id}/regularity`)
      setSellerDetail(response.data.data)
      setRevealedCpf(null)
    } catch (error) { onNotice(getErrorMessage(error)) } finally { setDetailLoading(false) }
  }
  function ask(title, description, run, reasonRequired = true) {
    setPendingAction({ title, description, reasonRequired, run: async (reason) => {
      const result = await run(reason)
      if (result !== false && !['Revelar CPF', 'Abrir documento'].includes(title)) {
        setDetail(null)
        setSellerDetail(null)
      }
      return result
    } })
  }
  if (!data) return <EmptyState text="Carregando painel da equipe Time Out..." />
  return (
    <section className="main-column full access-page">
      <div className="section-heading"><div><span className="eyebrow">Equipe interna Time Out</span><h2>Governança da plataforma</h2><p className="section-subtitle">Aprovações, ambientes, responsáveis e auditoria.</p></div><span className="experimental-pill"><ShieldCheck size={15} /> {data.identityVerificationMode === 'mock' ? 'Ambiente de teste: validações externas estão desativadas.' : 'Acesso restrito'}</span></div>
      {payoutOverview ? (
        <div className="admin-monetization-section">
          <div className="metrics-grid financial-metrics">
            <article className="metric-card"><span>Contas de teste</span><strong>{payoutOverview.accounts?.length || 0}</strong></article>
            <article className="metric-card"><span>Total bruto movimentado</span><strong>{money.format(Number(payoutOverview.summary?.grossMoved || 0))}</strong></article>
            <article className="metric-card"><span>Comissões Time Out</span><strong>{money.format(Number(payoutOverview.summary?.commissions || 0))}</strong></article>
            <article className="metric-card"><span>Líquido dos vendedores</span><strong>{money.format(Number(payoutOverview.summary?.netAvailable || 0))}</strong></article>
          </div>
          <RetainedTransactions overview={payoutOverview} onRetry={onRetrySettlement} />
          <FinancialHistoryControls overview={payoutOverview} query={financialQuery} onQuery={onFinancialQuery} environments={data.environments || []} />
        </div>
      ) : null}
      <article className="approval-panel"><div className="section-heading compact-heading"><h3>Solicitações de ambiente</h3><span>{data.applications?.length || 0}</span></div><div className="stack">
        {(data.applications || []).map((application) => <div className="application-card" key={application.id}><div><strong>{application.institutionName}</strong><span className={`status-badge ${application.status}`}>{accessStatusLabels[application.status]}</span></div><p>{application.responsibleName} · CPF {application.cpf} · {application.phone}</p><p>{application.address}</p><button className="ghost-button" type="button" disabled={detailLoading} onClick={() => openDetail(application.id)}><Eye size={15} /> Abrir análise</button></div>)}
        {!data.applications?.length && <EmptyState text="Nenhuma solicitação de ambiente." />}
      </div><div className="row-actions"><button className="ghost-button" type="button" disabled={(data.applicationPagination?.page || 1) <= 1} onClick={() => onApplicationPage((data.applicationPagination?.page || 1) - 1)}>Anterior</button><span>Página {data.applicationPagination?.page || 1} de {Math.max(1, data.applicationPagination?.totalPages || 1)}</span><button className="ghost-button" type="button" disabled={(data.applicationPagination?.page || 1) >= (data.applicationPagination?.totalPages || 1)} onClick={() => onApplicationPage((data.applicationPagination?.page || 1) + 1)}>Próxima</button></div></article>
      <article className="approval-panel"><div className="section-heading compact-heading"><h3>Regularidade do vendedor</h3><span>{data.sellers?.length || 0}</span></div><div className="stack">{(data.sellers || []).map((seller) => <div className="application-card" key={seller.id}><div><strong>{seller.storeName || seller.user?.name}</strong><span className={`status-badge ${seller.status}`}>{accessStatusLabels[seller.status] || seller.status}</span></div><p>{seller.user?.email} · ambiente #{seller.environmentId}</p><button className="ghost-button" type="button" disabled={detailLoading} onClick={() => openSellerDetail(seller.userId)}><Eye size={15} /> Consultar regularidade</button></div>)}{!data.sellers?.length && <EmptyState text="Nenhum vendedor encontrado." />}</div></article>
      <div className="approval-columns">
        <article className="approval-panel"><div className="section-heading compact-heading"><h3>Ambientes</h3><span>{data.environments?.length || 0}</span></div><div className="stack">{(data.environments || []).map((environment) => <div className="application-card" key={environment.id}><div><strong>{environment.name}</strong><span className={`status-badge ${environment.status}`}>{environment.status === 'suspended' ? 'Suspenso' : 'Ativo'}</span></div><p>{environmentTypeLabels[environment.type] || environment.type} · {environment.isPrivate ? 'Privado' : 'Público'}</p><div className="inline-access-form"><input type="number" min="1" value={transfers[environment.id] || ''} onChange={(event) => setTransfers({ ...transfers, [environment.id]: event.target.value })} placeholder="ID do novo responsável" /><button className="ghost-button" type="button" disabled={!transfers[environment.id]} onClick={() => ask('Transferir administração', `Transferir ${environment.name} para o usuário #${transfers[environment.id]}?`, (reason) => onTransferEnvironment(environment.id, transfers[environment.id], reason))}>Transferir</button><button className="ghost-button danger-text" type="button" onClick={() => ask(environment.status === 'suspended' ? 'Reativar ambiente' : 'Suspender ambiente', `Alterar o acesso a ${environment.name}?`, (reason) => onToggleEnvironment(environment.id, environment.status !== 'suspended', reason))}>{environment.status === 'suspended' ? 'Reativar' : 'Suspender'}</button></div></div>)}</div></article>
        <article className="approval-panel"><div className="section-heading compact-heading"><h3>Administradores</h3><span>{data.administrators?.length || 0}</span></div><div className="stack">{(data.administrators || []).map((administrator) => { const membership = administrator.memberships?.find((item) => Number(item.environmentId) === Number(administrator.environmentId)); const suspended = membership?.status === 'suspended'; return <div className="application-card" key={administrator.id}><div><strong>{administrator.name}</strong><span className={`status-badge ${suspended ? 'suspended' : 'approved'}`}>{suspended ? 'Suspenso' : 'Ativo'}</span></div><p>{administrator.email} · ambiente #{administrator.environmentId || '-'}</p><button className="ghost-button danger-text" type="button" onClick={() => ask(suspended ? 'Reativar administrador' : 'Suspender administrador', `Alterar acesso de ${administrator.name}?`, (reason) => onToggleAdministrator(administrator.id, !suspended, reason))}>{suspended ? 'Reativar' : 'Suspender'}</button></div> })}</div></article>
      </div>
      <article className="approval-panel"><div className="section-heading compact-heading"><h3>Auditoria recente</h3><span>{data.auditLogs?.length || 0}</span></div><div className="audit-list">{(data.auditLogs || []).map((log) => <div key={log.id}><strong>{log.summary}</strong><span>{log.actor?.name || 'Sistema'} · {log.action} · {formatDate(log.createdAt)}</span></div>)}</div></article>
      {detail && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null) }}><div className="administrative-dialog wide-dialog" role="dialog" aria-modal="true" aria-label="Análise de ambiente"><div className="section-heading compact-heading"><div><h3>{detail.application.institutionName}</h3><span className={`status-badge ${detail.application.status}`}>{accessStatusLabels[detail.application.status] || detail.application.status}</span></div><button className="icon-button" type="button" title="Fechar" onClick={() => setDetail(null)}><X size={18} /></button></div><div className="administrative-detail-grid"><p><strong>Solicitante:</strong> {detail.application.applicant?.name} · {detail.application.applicant?.email}</p><p><strong>Telefone:</strong> {detail.application.phone}</p><p><strong>Conta criada:</strong> {formatDate(detail.application.applicant?.createdAt)}</p><p><strong>E-mail:</strong> {detail.application.applicant?.emailVerifiedAt ? 'Confirmado' : 'Pendente'}</p><p><strong>Solicitação:</strong> {formatDate(detail.application.createdAt)}</p><p><strong>Tipo:</strong> {environmentTypeLabels[detail.application.institutionType] || detail.application.institutionType}</p><p><strong>Endereço:</strong> {detail.application.address}</p><p><strong>CPF:</strong> {revealedCpf || detail.application.cpf}</p><p><strong>Relação:</strong> {detail.application.relationship}</p><p><strong>Descrição:</strong> {detail.application.environmentDescription}</p><p><strong>Justificativa:</strong> {detail.application.justification}</p><p><strong>Decisão:</strong> {detail.application.reviewer?.name || 'Aguardando'} · {detail.application.decisionReason || detail.application.correctionNotes || 'Sem observações'}</p></div><div className="row-actions"><button className="ghost-button" type="button" onClick={() => ask('Revelar CPF', 'O acesso ao CPF completo será registrado em auditoria.', async (reason) => setRevealedCpf(await onRevealCpf(detail.application.id, reason)))}><Eye size={15} /> Revelar CPF</button>{detail.application.documentPath && <button className="ghost-button" type="button" onClick={() => ask('Abrir documento', 'O acesso ao documento protegido será registrado em auditoria.', (reason) => onViewDocument(detail.application.id, reason))}><FileText size={15} /> Documento</button>}{!['approved', 'rejected'].includes(detail.application.status) && <><button className="ghost-button" type="button" onClick={() => ask('Iniciar análise', 'Marcar esta solicitação como em análise?', (reason) => onReviewApplication(detail.application.id, 'under_review', reason), false)}>Em análise</button><button className="primary-button compact-button" type="button" onClick={() => ask('Aprovar ambiente', 'Um ambiente e seu administrador serão criados.', (reason) => onReviewApplication(detail.application.id, 'approved', reason), false)}><Check size={15} /> Aprovar</button><button className="ghost-button" type="button" onClick={() => ask('Solicitar correções', 'O solicitante receberá a justificativa.', (reason) => onReviewApplication(detail.application.id, 'changes_requested', reason))}>Pedir correção</button><button className="ghost-button danger-text" type="button" onClick={() => ask('Recusar solicitação', 'Esta decisão será registrada e notificada.', (reason) => onReviewApplication(detail.application.id, 'rejected', reason))}><X size={15} /> Recusar</button></>}</div><h4>Histórico</h4><ApplicationHistory application={detail.application} /><h4>Solicitações anteriores</h4>{(detail.previousApplications || []).map((item) => <p key={item.id}>#{item.id} · {item.institutionName} · {accessStatusLabels[item.status] || item.status} · {formatDate(item.createdAt)}</p>)}{!detail.previousApplications?.length && <p>Nenhuma solicitação anterior.</p>}<h4>Ambientes administrados</h4>{(detail.administeredMemberships || []).map((item) => <p key={item.environmentId}>{item.environment?.name} · {accessStatusLabels[item.status] || item.status}</p>)}{!detail.administeredMemberships?.length && <p>Nenhum ambiente anterior.</p>}<h4>Decisões</h4><div className="audit-list">{(detail.decisions || []).map((log) => <div key={log.id}><strong>{log.summary}</strong><span>{formatDate(log.createdAt)} · {log.metadata?.reason || log.action}</span></div>)}</div></div></div>}
      {sellerDetail && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSellerDetail(null) }}><div className="administrative-dialog wide-dialog" role="dialog" aria-modal="true" aria-label="Regularidade do vendedor"><div className="section-heading compact-heading"><div><h3>{sellerDetail.user?.name}</h3><span>{sellerDetail.user?.email} · {sellerDetail.environment?.name}</span></div><button className="icon-button" type="button" title="Fechar" onClick={() => setSellerDetail(null)}><X size={18} /></button></div><p><strong>Situação:</strong> {sellerDetail.status} · {sellerDetail.decisionReason || 'Sem observações'}</p><div className="administrative-detail-grid"><p><strong>Telefone:</strong> {sellerDetail.user?.phone}</p><p><strong>CPF:</strong> {revealedCpf || sellerDetail.user?.cpfMasked}</p><p><strong>E-mail:</strong> {sellerDetail.user?.emailVerifiedAt ? 'Confirmado' : 'Pendente'}</p><p><strong>Participação:</strong> {sellerDetail.membership?.status}</p><p><strong>Produtos:</strong> {sellerDetail.products?.active} ativos · {sellerDetail.products?.inactive} inativos</p><p><strong>Pedidos:</strong> {sellerDetail.orders?.total} recebidos · {sellerDetail.orders?.delivered} entregues · {sellerDetail.orders?.canceled} cancelados · {sellerDetail.orders?.refused} recusados</p><p><strong>Recebimento simulado:</strong> {sellerDetail.payoutAccount?.status}</p><p><strong>Documento:</strong> {sellerDetail.documentAvailable ? 'Enviado' : 'Não enviado'}</p></div><div className="row-actions"><button className="ghost-button" type="button" onClick={() => ask('Revelar CPF', 'O acesso será auditado.', async (reason) => setRevealedCpf(await onRevealSellerCpf(sellerDetail.application.id, reason)))}><Eye size={15} /> Revelar CPF</button>{sellerDetail.documentAvailable && <button className="ghost-button" type="button" onClick={() => ask('Abrir documento', 'O acesso será auditado.', (reason) => onViewSellerDocument(sellerDetail.application.id, reason))}><FileText size={15} /> Documento</button>}</div><ApplicationHistory application={sellerDetail.application} /><div className="audit-list">{(sellerDetail.decisions || []).map((log) => <div key={log.id}><strong>{log.summary}</strong><span>{formatDate(log.createdAt)}</span></div>)}</div></div></div>}
      {pendingAction && <AdministrativeConfirmDialog title={pendingAction.title} description={pendingAction.description} reasonRequired={pendingAction.reasonRequired} onConfirm={pendingAction.run} onClose={() => setPendingAction(null)} />}
    </section>
  )
}

function AdminMonetizationView({ overview, payoutOverview, plans, onReviewRequest, onChangePlan, onSaveInstitutional, onPayoutStatus, financialQuery, onFinancialQuery, onRetrySettlement }) {
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

      {payoutOverview ? (
        <div className="admin-monetization-section payout-admin-section">
          <div className="section-heading compact-heading">
            <div><h3>Recebimentos simulados</h3><p className="section-subtitle">Contas e movimentações somente deste ambiente.</p></div>
            <span>{payoutOverview.accounts?.length || 0} contas</span>
          </div>
          <div className="metrics-grid financial-metrics">
            <article className="metric-card"><span>Bruto movimentado</span><strong>{money.format(Number(payoutOverview.summary?.grossMoved || 0))}</strong></article>
            <article className="metric-card"><span>Reservado</span><strong>{money.format(Number(payoutOverview.summary?.heldAmount || 0))}</strong></article>
            <article className="metric-card"><span>Comissões</span><strong>{money.format(Number(payoutOverview.summary?.commissions || 0))}</strong></article>
            <article className="metric-card"><span>Líquido dos vendedores</span><strong>{money.format(Number(payoutOverview.summary?.netAvailable || 0))}</strong></article>
          </div>
          <div className="payout-state-strip">
            <span><strong>{payoutOverview.summary?.pendingCount || 0}</strong> pendentes</span>
            <span><strong>{payoutOverview.summary?.heldCount || 0}</strong> reservadas</span>
            <span><strong>{payoutOverview.summary?.settledCount || 0}</strong> liquidadas</span>
            <span><strong>{payoutOverview.summary?.refundedCount || 0}</strong> reembolsadas</span>
          </div>
          <div className="payout-admin-grid">
            <div className="stack">
              {(payoutOverview.accounts || []).map((account) => (
                <article className="application-card" key={account.id}>
                  <div><strong>{account.seller?.name || account.storeName}</strong><span className={`status-badge ${account.status}`}>{account.status === 'connected' ? 'Conectada' : account.status === 'suspended' ? 'Suspensa' : 'Pendente'}</span></div>
                  <p>{account.storeName} · {account.testAccountId}</p>
                  <button className="ghost-button" type="button" onClick={() => onPayoutStatus(account.userId, account.status !== 'suspended')}>{account.status === 'suspended' ? 'Reativar conta' : 'Suspender conta'}</button>
                </article>
              ))}
            </div>
            <div className="payout-missing-list">
              <div className="section-heading compact-heading"><h3>Sem conta conectada</h3><span>{payoutOverview.sellersWithoutAccount?.length || 0}</span></div>
              {(payoutOverview.sellersWithoutAccount || []).map((seller) => <p key={seller.id}><strong>{seller.name}</strong><br />{seller.email}</p>)}
              {(payoutOverview.sellersWithoutAccount || []).length === 0 ? <p className="muted-note">Todos os vendedores possuem uma conta de teste.</p> : null}
            </div>
          </div>
          <RetainedTransactions overview={payoutOverview} onRetry={onRetrySettlement} />
          <FinancialHistoryControls overview={payoutOverview} query={financialQuery} onQuery={onFinancialQuery} />
        </div>
      ) : null}

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
          <label>Nome de exibição<input value={institutional.displayName} onChange={(event) => setInstitutional({ ...institutional, displayName: event.target.value })} placeholder="Ex: Time Out SENAI" /></label>
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
  onOpenEnvironment,
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
    <section className="content-grid two-columns profile-page">
      <div className="main-column">
        <div className="section-heading">
          <h2>Meu perfil</h2>
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
            {user.phone ? <span><Phone size={15} /> {phoneStatusLabel(user)}</span> : null}
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

      <aside className="profile-places-panel">
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
          <p>A criação de ambientes passa por análise da equipe Time Out.</p>
          <button className="ghost-button wide" type="button" onClick={onOpenEnvironment}>
            <FileText size={17} /> Abrir formulário de solicitação
          </button>
        </div>
      </aside>

      <form className="side-panel profile-edit-panel" onSubmit={submit}>
        <PanelHeader icon={UserRound} title="Editar perfil" />

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

function AdministrativeConfirmDialog({ title, description, reasonRequired = false, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    if (reasonRequired && reason.trim().length < 8) return
    setBusy(true)
    try {
      const result = await onConfirm(reason.trim())
      if (result !== false && result !== null) onClose()
    } finally { setBusy(false) }
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form className="administrative-dialog" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit}>
        <div className="section-heading compact-heading"><h3>{title}</h3><button type="button" className="icon-button" onClick={onClose} title="Fechar"><X size={18} /></button></div>
        <p>{description}</p>
        {reasonRequired && <label>Motivo da ação<textarea value={reason} minLength={8} maxLength={500} required onChange={(event) => setReason(event.target.value)} placeholder="Explique a decisão" /></label>}
        <div className="row-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancelar</button><button className="primary-button compact-button" disabled={busy || (reasonRequired && reason.trim().length < 8)}>{busy ? 'Aguarde...' : 'Confirmar'}</button></div>
      </form>
    </div>
  )
}

function AccountManagementDialog({ data, currentUserId, onClose, onAction }) {
  const [name, setName] = useState(data.user.name || '')
  const [phone, setPhone] = useState(data.user.phone || '')
  const [pending, setPending] = useState(null)
  const account = data.user
  const ownAccount = Number(account.id) === Number(currentUserId)
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="administrative-dialog wide-dialog" role="dialog" aria-modal="true" aria-label={`Gerenciar ${account.name}`}>
        <div className="section-heading compact-heading"><div><h3>{account.name}</h3><span>{account.email}</span></div><button type="button" className="icon-button" onClick={onClose} title="Fechar"><X size={18} /></button></div>
        <p>{accountRoleLabels(account, data.memberships).map((item) => item.label).join(' · ')} · {account.isSuspended ? 'Conta suspensa' : 'Conta ativa'} · {account.emailVerifiedAt ? 'E-mail confirmado' : 'E-mail pendente'}</p>
        <div className="approval-form-grid"><label>Nome<input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></label><label>Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label></div>
        {!ownAccount && <div className="row-actions"><button className="ghost-button" type="button" onClick={() => setPending({ title: 'Corrigir dados', description: 'A alteração de nome ou telefone será auditada.', run: () => onAction('profile', { name, phone }) })}><Check size={16} /> Salvar dados</button><button className="ghost-button" type="button" onClick={() => setPending({ title: 'Encerrar sessões', description: 'Todos os dispositivos precisarão entrar novamente.', reasonRequired: true, run: (reason) => onAction('sessions', { reason }) })}><LogOut size={16} /> Encerrar sessões</button><button className="ghost-button" type="button" onClick={() => setPending({ title: 'Solicitar nova confirmação', description: 'O e-mail atual permanecerá igual. A pessoa terá que confirmar novamente.', reasonRequired: true, run: (reason) => onAction('email', { reason }) })}><MailCheck size={16} /> Confirmar e-mail novamente</button><button className="ghost-button danger-text" type="button" onClick={() => setPending({ title: account.isSuspended ? 'Reativar conta' : 'Suspender conta', description: 'Esta ação encerra as sessões atuais e preserva pedidos e histórico.', reasonRequired: !account.isSuspended, run: (reason) => onAction('status', { suspended: !account.isSuspended, reason }) })}><Ban size={16} /> {account.isSuspended ? 'Reativar' : 'Suspender'}</button></div>}
        <div className="section-heading compact-heading"><h3>Participações</h3><span>{data.memberships?.length || 0}</span></div>
        <div className="stack">{(data.memberships || []).map((membership) => <div className="application-card" key={membership.id}><strong>{membership.environment?.name || `Ambiente #${membership.environmentId}`}</strong><p>{roleLabel(membership.role)} · {accessStatusLabels[membership.status] || membership.status}</p></div>)}{!data.memberships?.length && <EmptyState text="Nenhuma participação registrada." />}</div>
        <div className="section-heading compact-heading"><h3>Histórico administrativo</h3><span>{data.history?.length || 0}</span></div>
        <div className="audit-list">{(data.history || []).map((log) => <div key={log.id}><strong>{log.summary}</strong><span>{formatDate(log.createdAt)} · {log.metadata?.reason || log.action}</span></div>)}{!data.history?.length && <EmptyState text="Nenhuma ação administrativa registrada." />}</div>
      </div>
      {pending && <AdministrativeConfirmDialog title={pending.title} description={pending.description} reasonRequired={pending.reasonRequired} onConfirm={pending.run} onClose={() => setPending(null)} />}
    </div>
  )
}

function AdminUsersView({ users, pagination, isPlatformAdmin, currentUserId, filters, onFilter, onManage }) {
  return (
    <section className="main-column full">
      <div className="section-heading">
        <h2>Usuários do ambiente</h2>
        <span>{pagination?.total || 0} contas</span>
      </div>

      <div className="toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            value={filters.search}
            onChange={(event) => onFilter({ ...filters, search: event.target.value, page: 1 })}
            placeholder="Buscar por nome ou e-mail"
          />
        </div>
        <select
          value={filters.role}
          onChange={(event) => onFilter({ ...filters, role: event.target.value, page: 1 })}
        >
          <option value="">Todos os perfis</option>
          <option value="customer">Clientes</option>
          <option value="seller">Vendedores</option>
          {isPlatformAdmin && <option value="environment_admin">Administradores</option>}
          {isPlatformAdmin && <option value="platform_admin">Equipe Time Out</option>}
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
            <div className="account-role-list">
              {accountRoleLabels(item, item.memberships).map((role) => <span className={`role-badge ${role.role}`} key={role.label}>{role.label}</span>)}
            </div>
            <div className="row-actions">
              <button
                className="icon-button"
                type="button"
                onClick={() => onManage(item.id)}
                title={Number(item.id) === Number(currentUserId) ? 'Ver minha conta' : 'Gerenciar conta'}
              >
                <UserCog size={17} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {users.length === 0 ? <EmptyState text="Nenhum usuário encontrado." /> : null}
      <div className="row-actions"><button className="ghost-button" type="button" disabled={filters.page <= 1} onClick={() => onFilter({ ...filters, page: filters.page - 1 })}>Anterior</button><span>Página {pagination?.page || 1} de {Math.max(1, pagination?.totalPages || 1)}</span><button className="ghost-button" type="button" disabled={filters.page >= (pagination?.totalPages || 1)} onClick={() => onFilter({ ...filters, page: filters.page + 1 })}>Próxima</button></div>
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
        <p>Novos ambientes são criados somente após aprovação da equipe Time Out. O código de acesso é administrado no painel de acessos.</p>
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
  if (role === 'platform_admin') return 'Equipe Time Out'
  return 'Cliente'
}

function accountRoleLabels(user, memberships = []) {
  const roles = []
  if (user.role === 'platform_admin') roles.push({ role: 'platform_admin', label: 'Equipe Time Out' })
  for (const membership of memberships || []) {
    if (!['approved', 'suspended'].includes(membership.status)) continue
    if (!['seller', 'admin', 'environment_admin'].includes(membership.role)) continue
    const role = membership.role === 'seller' ? 'seller' : 'environment_admin'
    const label = `${role === 'seller' ? 'Vendedor' : 'Administrador'} · ${membership.environment?.name || `Ambiente #${membership.environmentId}`}`
    if (!roles.some((item) => item.label === label)) roles.push({ role, label })
  }
  if (roles.length === 0 && user.role !== 'customer') roles.push({ role: user.role, label: roleLabel(user.role) })
  if (roles.length === 0) roles.push({ role: 'customer', label: 'Cliente' })
  return roles
}

function phoneStatusLabel(user) {
  if (!user?.phone) return 'Telefone não informado'
  if (user.phoneVerifiedAt) return 'Telefone confirmado'
  return 'Telefone cadastrado'
}

export default App
