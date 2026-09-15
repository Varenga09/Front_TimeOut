import axios from 'axios'
import { SecurityMonitor } from './security.js'

const SESSION_KEY = '@localfood:web:session'

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'

export const API_ORIGIN = API_BASE_URL.startsWith('http')
  ? new URL(API_BASE_URL).origin
  : ''

export function getAssetUrl(path) {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${API_ORIGIN}${path}`
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  // O backend gratuito do Render pode levar cerca de um minuto para sair do repouso.
  timeout: Number(import.meta.env.VITE_API_TIMEOUT || 90000),
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  withCredentials: true,
})

function getRequestEmail(data) {
  try {
    const payload = typeof data === 'string' ? JSON.parse(data) : data
    return payload?.email || ''
  } catch {
    return ''
  }
}

// Security interceptors
api.interceptors.request.use(
  (config) => {
    // Add security headers for sensitive operations
    if (config.url?.includes('/auth') || config.url?.includes('/users')) {
      config.headers['X-Security-Header'] = 'secure-request'
    }
    
    // Add CSRF token if available
    const csrfToken = localStorage.getItem('csrf_token')
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    // Track successful authentication
    if (response.config.url?.includes('/auth/login')) {
      const email = getRequestEmail(response.config.data)
      if (email) {
        SecurityMonitor.trackLoginAttempt(email, true)
      }
    }
    
    return response
  },
  (error) => {
    // Track failed authentication attempts
    if (error.config?.url?.includes('/auth/login')) {
      const email = getRequestEmail(error.config.data)
      if (email) {
        SecurityMonitor.trackLoginAttempt(email, false)
      }
    }
    
    // Handle security-related errors
    if (error.response?.status === 429) {
      // Rate limiting
      const retryAfter = error.response.headers['retry-after'] || 60
      error.message = `Muitas requisições. Aguarde ${retryAfter} segundos antes de tentar novamente.`
    } else if (error.response?.status === 401) {
      // Clear session on unauthorized
      setAuthToken(null)
      localStorage.removeItem(SESSION_KEY)
    }
    
    return Promise.reject(error)
  }
)

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
    // Store token securely
    localStorage.setItem('auth_token', token)
    return
  }

  delete api.defaults.headers.common.Authorization
  localStorage.removeItem('auth_token')
}

export function getErrorMessage(error) {
  if (error?.code === 'ECONNABORTED') {
    return 'O servidor demorou para iniciar. Aguarde alguns segundos e tente novamente.'
  }

  if (error?.message === 'Network Error') {
    return 'Não foi possível conectar com o servidor. Aguarde alguns segundos e tente novamente.'
  }

  return (
    error?.response?.data?.message ||
    error?.message ||
    'Não foi possível completar a operação'
  )
}

// Security utility functions
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input
  
  // Remove potentially dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function generateSecureToken(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
