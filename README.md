# LocalFood Web

Frontend web do LocalFood, uma plataforma de pedidos locais para escolas, empresas, fabricas, faculdades e outros ambientes fechados.

## O Que Este Frontend Faz

- Login com JWT usando a API LocalFood.
- Cadastro de cliente usando codigo de ambiente.
- Edicao de perfil com nome, e-mail, telefone, senha e foto.
- Vitrine de produtos do ambiente do usuario.
- Filtros por busca e categoria.
- Carrinho com produtos de um unico vendedor por pedido.
- Criacao de pedido com forma de pagamento e local combinado.
- Historico de pedidos do cliente.
- Painel do vendedor para ver pedidos recebidos.
- Atualizacao de status do pedido pelo vendedor.
- Cadastro, edicao, imagem, ativacao/pausa e remocao de produtos do vendedor.
- Painel admin para gerenciar usuarios, vendedores e categorias.

## Tecnologias

- React
- Vite
- Axios
- Lucide React
- CSS puro responsivo

## Antes De Rodar

O backend precisa estar ligado em:

```txt
http://localhost:3001/api/v1
```

No projeto da API, rode:

```bash
cd C:\FatecoinsGPT\local-food-api
npm run dev
```

Se a API estiver em outra porta, altere o arquivo `.env`.

## Instalar

```bash
cd C:\FatecoinsGPT\local-food-web
npm install
copy .env.example .env
```

O arquivo `.env` deve ficar assim:

```env
VITE_API_URL=http://localhost:3001/api/v1
```

## Rodar Em Desenvolvimento

```bash
npm run dev
```

Abra no navegador:

```txt
http://localhost:5173
```

## Contas De Teste

Essas contas sao criadas pelo seeder do backend:

```txt
Cliente
email: mateus@localfood.com
senha: 123456

Vendedor
email: vendedor@localfood.com
senha: 123456

Admin
email: admin@localfood.com
senha: 123456
```

Codigo do ambiente para novos cadastros:

```txt
SENAI2026
```

## Fluxo Para Testar

1. Entre como cliente.
2. Veja a vitrine de produtos.
3. Adicione Coxinha e Suco ao carrinho.
4. Envie o pedido escolhendo Pix e ponto de encontro.
5. Saia e entre como vendedor.
6. Abra "Pedidos recebidos".
7. Atualize o pedido para aceito, preparando, pronto e entregue.
8. Abra "Meus produtos" para criar ou pausar produtos.
9. Use "Perfil" para alterar telefone, foto, nome ou senha.
10. Entre como admin para abrir "Usuarios" e "Categorias".

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Estrutura

```txt
src/
  api.js        Configuracao do Axios e URL da API
  App.jsx       Telas, regras de interface e integracao com backend
  App.css       Layout principal do sistema
  index.css     Estilos globais
  main.jsx      Entrada do React
```

## Observacoes

- O pagamento ainda e combinado fora do aplicativo.
- O vendedor e o cliente precisam estar no mesmo ambiente.
- O backend continua responsavel pelas regras importantes, como estoque, permissao e seguranca.
