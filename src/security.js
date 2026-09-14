// Security configuration for LocalFood application
export const SECURITY_CONFIG = {
  // Password requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL: true,
    MAX_LENGTH: 64,
  },
  
  // Rate limiting
  RATE_LIMIT: {
    LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
    REQUEST_TIMEOUT: 15000,
  },
  
  // Session security
  SESSION: {
    TOKEN_STORAGE_KEY: '@localfood:web:session',
    REFRESH_TOKEN_KEY: '@localfood:web:refresh-token',
    MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
    REFRESH_THRESHOLD: 2 * 60 * 60 * 1000, // 2 hours before expiry
  },
  
  // Two-factor authentication
  TWO_FACTOR: {
    CODE_LENGTH: 6,
    CODE_EXPIRY: 5 * 60 * 1000, // 5 minutes
    REMEMBER_DEVICE_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  
  // Security headers
  HEADERS: {
    CONTENT_SECURITY_POLICY: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;",
    X_FRAME_OPTIONS: 'DENY',
    X_CONTENT_TYPE_OPTIONS: 'nosniff',
    X_XSS_PROTECTION: '1; mode=block',
    REFERRER_POLICY: 'strict-origin-when-cross-origin',
  },
  
  // Validation patterns
  PATTERNS: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE: /^\+?[\d\s()-]+$/,
    PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,64}$/,
    USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
  },
  
  // Security levels
  LEVELS: {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  },
  
  // Alert messages
  ALERTS: {
    RATE_LIMIT_EXCEEDED: 'Muitas tentativas de login. Sua conta foi temporariamente bloqueada.',
    INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
    ACCOUNT_LOCKED: 'Conta temporariamente bloqueada por segurança.',
    SESSION_EXPIRED: 'Sessão expirada. Por favor, faça login novamente.',
    SECURITY_BREACH: 'Atividade suspeita detectada. Sua conta foi protegida.',
  },
}

// Utility functions for security
export class SecurityUtils {
  static validatePassword(password) {
    const config = SECURITY_CONFIG.PASSWORD
    
    if (password.length < config.MIN_LENGTH || password.length > config.MAX_LENGTH) {
      return {
        valid: false,
        errors: ['A senha deve ter entre 8 e 64 caracteres']
      }
    }
    
    const errors = []
    if (config.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('A senha deve conter pelo menos uma letra maiúscula')
    }
    if (config.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('A senha deve conter pelo menos uma letra minúscula')
    }
    if (config.REQUIRE_NUMBERS && !/\d/.test(password)) {
      errors.push('A senha deve conter pelo menos um número')
    }
    if (config.REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('A senha deve conter pelo menos um caractere especial')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }
  
  static calculatePasswordStrength(password) {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    }
    
    const score = Object.values(checks).filter(Boolean).length
    const strength = score <= 2 ? 'Fraca' : score === 3 ? 'Média' : 'Forte'
    
    return {
      score: Math.max(0, score - 1), // Adjust score for better UX
      strength,
      checks
    }
  }
  
  static sanitizeInput(input) {
    if (typeof input !== 'string') return input
    
    // Remove potentially dangerous characters
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
  }
  
  static generateSecureToken(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }
  
  static hashToken(token) {
    // Simple hash for client-side token obfuscation
    // In production, use proper cryptographic functions
    let hash = 0
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }
}

// Security monitoring
export class SecurityMonitor {
  static loginAttempts = new Map()
  static suspiciousActivities = []
  
  static trackLoginAttempt(email, success = false) {
    const now = Date.now()
    const key = email.toLowerCase()
    
    if (!this.loginAttempts.has(key)) {
      this.loginAttempts.set(key, [])
    }
    
    const attempts = this.loginAttempts.get(key)
    attempts.push({ timestamp: now, success })
    
    // Keep only last hour attempts
    const oneHourAgo = now - 60 * 60 * 1000
    this.loginAttempts.set(key, attempts.filter(attempt => attempt.timestamp > oneHourAgo))
    
    // Check for suspicious patterns
    this.checkSuspiciousActivity(key, attempts)
  }
  
  static isRateLimited(email) {
    const key = email.toLowerCase()
    const attempts = this.loginAttempts.get(key) || []
    const recentAttempts = attempts.filter(attempt => 
      attempt.timestamp > (Date.now() - SECURITY_CONFIG.RATE_LIMIT.LOCKOUT_DURATION)
    )
    
    return recentAttempts.length >= SECURITY_CONFIG.RATE_LIMIT.LOGIN_ATTEMPTS && 
           !recentAttempts.slice(-3).every(attempt => attempt.success)
  }
  
  static checkSuspiciousActivity(email, attempts) {
    const recentFailures = attempts.filter(attempt => 
      !attempt.success && attempt.timestamp > (Date.now() - 10 * 60 * 1000)
    )
    
    if (recentFailures.length >= 5) {
      this.suspiciousActivities.push({
        type: 'multiple_failures',
        email,
        timestamp: Date.now(),
        details: `${recentFailures.length} falhas recentes`
      })
    }
    
    // Rate limit detection
    if (this.isRateLimited(email)) {
      this.suspiciousActivities.push({
        type: 'rate_limit',
        email,
        timestamp: Date.now(),
        details: 'Limite de taxa excedido'
      })
    }
  }
  
  static getSuspiciousActivities() {
    return this.suspiciousActivities
  }
  
  static clearSuspiciousActivities() {
    this.suspiciousActivities = []
  }
}
