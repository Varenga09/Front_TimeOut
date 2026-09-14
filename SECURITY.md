# Sistema de Segurança - LocalFood

## Visão Geral

Este sistema implementa as melhores práticas de segurança moderna para autenticação de usuários, incluindo criptografia de senhas, autenticação de dois fatores (2FA), e proteção contra ataques comuns.

## Funcionalidades de Segurança

### 1. Sistema de Login Seguro

#### Validação de Senha em Tempo Real
- Indicador visual de força da senha
- Requisitos mínimos de segurança:
  - Mínimo 8 caracteres
  - 1 letra maiúscula
  - 1 letra minúscula
  - 1 número
  - 1 caractere especial

#### Visualização de Senha
- Botão para mostrar/ocultar senha
- Íconos intuitivos (olho aberto/fechado)

#### Validação de Formulário
- Validação em tempo real
- Feedback de erro claro e específico
- Prevenção de ataques de timing

### 2. Autenticação de Dois Fatores (2FA)

#### Como Funciona
- Código de 6 dígitos enviado por e-mail
- Código expira após 5 minutos
- Opção de lembrar dispositivo por 30 dias

#### Configuração
- Ativação automática para novos usuários
- Configuração manual no perfil do usuário
- Reenvio de código com cooldown

### 3. Proteção Contra Ataques

#### Rate Limiting
- Máximo de 5 tentativas de login por 15 minutos
- Bloqueio temporário após múltiplas falhas
- Mensagens claras para usuários

#### Monitoramento de Atividades Suspeitas
- Rastreamento de tentativas de login falhas
- Detecção de padrões suspeitos
- Alertas automáticos

#### Headers de Segurança
- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection

### 4. Gerenciamento de Sessões

#### Segurança de Tokens
- JWT tokens assinados com chave secreta
- Expiração automática de tokens
- Refresh tokens para sessões contínuas

#### Armazenamento Seguro
- Tokens armazenados apenas em localStorage
- Limpeza automática ao logout
- Proteção contra XSS

## Arquivos de Implementação

### Frontend (React/Vite)

#### `src/App.jsx`
- Componente principal do sistema
- Implementação do LoginScreen com validação segura
- Fluxo de verificação de 2FA
- Gerenciamento de sessões

#### `src/api.js`
- Configuração do Axios com segurança
- Interceptors para requests/responses
- Monitoramento de tentativas de login

#### `src/security.js`
- Configurações de segurança centralizadas
- Funções de validação e sanitização
- Classe de monitoramento de atividades

#### `src/App.css`
- Estilos para elementos de segurança
- Indicadores de força de senha
- Design responsivo e acessível

### Configuração

#### `.env.example`
- Configurações de ambiente para segurança
- Variáveis para 2FA, rate limiting, JWT

## Melhores Práticas Implementadas

### 1. Criptografia
- Senhas hash com bcrypt (backend)
- Tokens JWT assinados
- Comunicação HTTPS

### 2. Validação
- Input validation no frontend
- Sanitização de dados
- Cross-site scripting (XSS) prevention

### 3. Autenticação
- JWT para stateless authentication
- 2FA para contas sensíveis
- Session management robusto

### 4. Proteção
- Rate limiting
- CSRF protection
- Security headers

## Integração com Backend

### API Endpoints

#### `/auth/login`
- Autenticação com e-mail e senha
- Retorna JWT token
- Aciona 2FA quando necessário

#### `/auth/register`
- Registro novo usuário
- Validação forte de senha
- Verificação de e-mail

#### `/auth/2fa/verify`
- Verificação de código 2FA
- Configuração de dispositivo confiável

#### `/auth/me`
- Verificação de sessão ativa
- Atualização de perfil

### Banco de Dados

O sistema está integrado com o banco de dados **vitrine**, contendo as seguintes tabelas principais:

#### `users`
- Informações básicas do usuário
- Hash de senha
- Configurações de segurança

#### `sessions`
- Registro de sessões ativas
- Tokens de refresh
- Dispositivos confiados

#### `security_logs`
- Registro de atividades
- Tentativas de login
- Eventos suspeitos

## Monitoramento e Auditoria

### Logs de Segurança
- Todas as tentativas de login
- Mudanças de senha
- Ativação de 2FA

### Métricas Importantes
- Taxa de sucesso de login
- Tentativas bloqueadas
- Usuários com 2FA ativo

## Recuperação de Conta

#### Esqueci a Senha
- Reset por e-mail
- Link temporário de segurança
- Expiração de 1 hora

#### Conta Bloqueada
- Auto-liberação após cooldown
- Suporte administrativo
- Verificação de identidade

## Considerações de Segurança

### Pontos Fortes
1. **Multi-camada**: Combinação de várias camadas de segurança
2. **User-friendly**: Interface intuitiva sem sacrificar segurança
3. **Adaptável**: Configurações ajustáveis por ambiente
4. **Padrões Modernos**: Segue OWASP Top 10 e NIST guidelines

### Melhorias Futuras
1. **Biometria**: Integração com Touch ID/Face ID
2. **SMS 2FA**: Opção de verificação por SMS
3. **Sistema de Pontos**: Sistema de reputação de segurança
4. **Analise de Comportamento**: Machine learning para detecção de anomalias

## Como Usar

### Desenvolvimento
```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env

# Rodar em modo desenvolvimento
npm run dev
```

### Produção
```bash
# Build otimizado
npm run build

# Configurar variáveis de produção
# Habilitar todas as features de segurança
```

## Testes

### Testes de Segurança
- [x] Validação de senha
- [x] Rate limiting
- [x] Proteção contra CSRF
- [x] Headers de segurança
- [x] 2FA flow
- [x] Session management

### Casos de Teste
- Login com senha fraca
- Múltiplas tentativas falhas
- 2FA com código inválido
- XSS injection attempts
- CSRF attacks

## Suporte

Para dúvidas sobre segurança, por favor contacte:
- suporte@localfood.com
- Documentação técnica completa disponível em `/docs/security`