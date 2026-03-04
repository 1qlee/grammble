# Grammble

## Rules and Conventions

- Always use 'pnpm,' never 'npm' or 'yarn'
- Never use emojis in commit messages or PR messages
- Don't use em dashes in any writing

## What it is

A daily word game with gameplay similar to Wordle. Every day, a two-letter "word" called a Gram is presented to the player. The player must then submit a guess word that includes the Gram. The game will provide feedback based on the position of the letters in the guess word compared to the actual hidden word of the day.

### Core Gameplay

A Gram looks like this: "EN," "ST," "NG," etc. A guess word must contain the Gram in its entirety. The Gram cannot be "broken up" inside the guess word, the two letters must appear consecutively (next to each other). For example, if the Gram is "EN" then "ENRAGE" is a valid guess. "ERRAND" would not be a valid guess. Basically, the Gram must be a substring within the guess word string. The hidden word of the day is a 6-letter word containing the Gram. The player has 6 tries to guess the word correctly.

### Guess Word Feedback

When the player submits a guess word, they will receive feedback based on the position of the letters in the guess word compared to the hidden word. Green: the letter is in the correct position. Red: the letter does not exist in the hidden word. Yellow: the letter exists in the hidden word, however not at this position. Gray: there is no letter in this position in the hidden word (this letter exceeds the "bounds" of the hidden word) - for example, if the hidden word is "HYPHEN" and my guess was "ENRAGE," then the last 4 letters of "ENRAGE" ("RAGE") would all be gray because they have exceeded the length of the hidden word "HYPHEN."

## Tech Stack

### Frontend

- React 19 + TanStack Router/Start (file-based, full-stack meta-framework)
- TanStack React Query & React Form
- Tailwind CSS 4
- Anime.js for tile flip animations
- Headless UI for unstyled accessible components
- Lucide React for icons

### Backend

- tRPC for type-safe API procedures
- Better-auth for authentication (email/password + Google, Discord, Twitter OAuth)
- Prisma ORM + PostgreSQL (primary database)
- Redis (ioredis) for sessions and rate limiting
- AWS SES for transactional emails (verification, password reset)

### Infra & Tooling

- Docker Compose for local PostgreSQL + Redis
- pnpm as package manager
- Vite 7 as build tool
- Prettier for code formatting (2-space indent, single quotes off, 80-char width)
- Strict TypeScript; path alias `~/*` → `./src/*`

## Project Structure

```
src/
  routes/             # File-based routing (TanStack Router)
    __root.tsx        # Root layout; user context, theme, GameProvider
    index.tsx         # Main game page
    signin.tsx        # Sign-in page
    signup.tsx        # Sign-up page
    logout.tsx        # Logout route
    verify-email.tsx  # Email verification
    api/
      auth/$.ts       # Better-auth endpoints
      trpc/$.ts       # tRPC endpoints
    _authed/          # Protected routes (require authentication)
      dashboard.tsx   # User dashboard
  components/
    keyboard/
      Keyboard.tsx              # Interactive keyboard UI
      useKeyboardInput.ts       # Key press/release logic
      useKeyboardNavigation.ts  # Focus navigation
    forms/            # Sign-up, login, etc.
    buttons/
    ui/               # Generic UI components
    Guesses.tsx       # 6x6 tile grid with Anime.js animations
    Nav.tsx           # Navigation bar
  context/
    GameProvider.tsx  # Game state via useReducer (guesses, current row, loading)
  trpc/
    init.ts           # tRPC initialization
    router.ts         # API procedure definitions
  utils/
    auth/auth.ts      # Better-auth config (rate limiting, social auth, sessions)
    redis.ts          # Redis client
    prisma.ts         # Prisma client
    email.ts          # AWS SES setup
    rate-limit.ts     # Rate limiting (rate-limiter-flexible + Redis)
    theme.ts          # Theme management
    security-headers.ts
  styles/
    app.css           # Main styles (Tailwind)
  hooks/              # Custom React hooks
  router.tsx          # Router configuration

prisma/
  schema.prisma       # DB schema: User, Session, Account, Verification, Settings

censor/
  whitelist.json          # Valid two-letter words
  blacklist.json          # Words to exclude
  optimized-whitelist.json  # 574KB+ optimized word list

start.ts              # TanStack Start config + global middleware (security headers)
vite.config.ts        # Vite + TanStack Start + TS path plugin
docker-compose.yml    # PostgreSQL (5432) + Redis (6379) with persistent volumes
```

## Database Schema (Prisma + PostgreSQL)

- **User** — id, email, name, emailVerified, image, username, displayUsername, timestamps
- **Session** — session management (30-day expiration, cookie-based)
- **Account** — OAuth provider accounts linked to users
- **Verification** — email verification tokens
- **Settings** — user preferences (theme: light/dark)

## Key Features

- **Game mechanics:** 6x6 tile grid, keyboard UI, word validation against whitelist
- **Auth:** Email verification required, social OAuth, rate limiting (5 attempts / 10 min via Redis)
- **User preferences:** Light/dark theme (cookie-persisted with media query fallback), username management
- **Security:** Security headers in production, CORS, rate limiting middleware

## Dev Scripts (pnpm)

- `pnpm dev` — Start dev server (port 3000)
- `pnpm build` — Production build
- `pnpm start` — Run production server
- `pnpm db:push` — Sync database schema
- `pnpm db:generate` — Generate Prisma client
- `pnpm db:migrate` — Run migrations
- `pnpm test:rate-limit` — Test rate limiting
