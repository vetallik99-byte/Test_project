# AGENTS.md

## Project Stack & Architecture

### Backend
- **Language**: Go
- **Architecture**: RESTful API
- **Responsibilities**: 
  - Game logic and state management
  - User authentication and authorization
  - Database operations
  - WebSocket connections for real-time updates
  - Business logic validation

### Frontend
- **Language**: TypeScript/JavaScript
- **Runtime**: Bun.js
- **Bundler**: Vite
- **Framework**: React
- **Testing**: Vitest
- **Styling**: 
  - Pure CSS with CSS Modules
  - CSS Custom Properties (Variables) for theming
  - Component-based styling approach

## Design System & Architecture

### Design Principles
- **Minimal Bundle Size**: Use minimal external libraries
- **Component Reusability**: Build reusable UI components
- **Client Theming**: Easy color/style manipulation for different clients
- **Figma Sync**: Naming conventions aligned with Figma design system

### Color System (Based on Figma Design)
```css
:root {
  /* Primary Colors - From Figma Variables */
  --white-main: #ffffff;
  --main: #0fb38d;
  --white-70: #ffffffb2;
  
  /* Semantic Colors */
  --success: var(--main);
  --warning: #f97316;
  --danger: #ef4444;
  --info: #60a5fa;
  
  /* Neutral Colors */
  --bg-primary: #0e1016;
  --bg-secondary: #161a22;
  --bg-tertiary: #1b212c;
  --border-color: #283044;
  --text-primary: #e7eaf0;
  --text-secondary: #98a2b3;
  
  /* Interactive States */
  --cell-default: #222938;
  --cell-hover: #2a3346;
  --cell-active: #0f172a;
}
```

### Component Architecture

#### Core Components
1. **Button Component**
   - Variants: Primary, Secondary, Icon
   - States: Default, Hover, Active, Disabled
   - Sizes: Small, Medium, Large
   - Icon support: Plus, Minus, Cross, Custom

2. **Input Components**
   - TextInput
   - NumberInput (with increment/decrement)
   - Select

3. **Game Components**
   - Grid
   - Cell
   - HUD (Heads-Up Display)
   - BetControls

4. **Layout Components**
   - Container
   - Panel
   - Header
   - Footer

#### CSS Module Structure
```
components/
├── Button/
│   ├── Button.module.css
│   ├── Button.tsx
│   └── index.ts
├── Input/
│   ├── NumberInput.module.css
│   ├── NumberInput.tsx
│   └── index.ts
└── ...
```

## Development Workflow

### Frontend Development
```bash
# Install dependencies
bun install

# Development server
bun dev

# Build for production
bun build

# Run tests
bun test

# Type checking
bun type-check
```

### Testing Strategy
- **Unit Tests**: Component logic and utilities (Vitest)
- **Integration Tests**: Component interactions
- **E2E Tests**: Critical user flows (consideration)

### Build & Bundle Optimization
- **Tree Shaking**: Automatic via Vite
- **Code Splitting**: Route and component-based
- **Asset Optimization**: Image and font optimization
- **Bundle Analysis**: Regular bundle size monitoring

## File Structure (Planned)
```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── ui/           # Reusable UI components
│   │   ├── game/         # Game-specific components
│   │   └── layout/       # Layout components
│   ├── styles/
│   │   ├── globals.css   # Global styles and variables
│   │   └── themes/       # Client-specific themes
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript definitions
│   ├── constants/        # App constants
│   └── tests/            # Test files
├── package.json
├── vite.config.ts
├── vitest.config.ts
└── tsconfig.json
```

## Client Customization Strategy

### Theme System
- CSS Custom Properties for easy color manipulation
- Client-specific theme files
- Runtime theme switching capability
- Figma variable integration for design consistency

### Configuration
- Environment-based configurations
- Client-specific feature flags
- Custom branding and styling options

## Integration Points

### API Communication
- RESTful endpoints for game actions
- WebSocket for real-time game state
- Authentication and authorization flows
- Error handling and retry logic

### State Management
- React Context for global state
- Local component state for UI interactions
- Server state synchronization
- Optimistic updates for better UX

## Performance Considerations

### Frontend
- Lazy loading for routes and components
- Image optimization and CDN usage
- Efficient re-renders with React.memo
- Bundle size monitoring and optimization

### Backend
- Database query optimization
- Caching strategies
- Efficient WebSocket message handling
- Horizontal scaling capabilities

## Next Steps

1. **Setup Vite + React + Bun project structure**
2. **Implement core component library**
3. **Create design system with CSS variables**
4. **Setup testing framework (Vitest)**
5. **Migrate existing game logic to React components**
6. **Implement client theming system**
7. **Setup build and deployment pipeline**

---

*This document will evolve as the project progresses and requirements become clearer.*