# FalconCrypt

[简体中文](README.md) | **English**

FalconCrypt is a single-player, browser-based dungeon adventure combining text-driven gameplay, light roguelike mechanics, a React interface, and Canvas pixel effects. Choose a class, manage health, armor, food, and coins through random rooms, and defeat each floor's boss in search of the Falcon Soul Crystal.

The `main` branch contains the Web version. The original Python terminal version is preserved on the [`legacy` branch](https://github.com/Infinovast/FalconCrypt/tree/legacy).

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Development commands](#development-commands)
- [Build and deploy](#build-and-deploy)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Random dungeons**: four floors with 4 / 5 / 6 / 7 rooms, branching paths, map scouting, and a boss at the end of each floor.
- **Five classes**: Warlock, Paladin, Thief, Priest, and Assassin, with four randomly selected candidates per run and distinct skills or passive abilities.
- **Room events**: combat, chests, traps, merchants, bonfires, forges, statues, and mines, each offering resource-management decisions.
- **Combat and progression**: basic attacks, critical strikes, class skills, four scroll types, experience levels, and armor upgrades.
- **Interaction feedback**: resource gain and cost previews, categorized logs, danger indicators, and room and combat effects.
- **Responsive interface**: a two-column desktop layout and a single-column layout on narrow screens.

All game logic runs in the browser, with no backend service required. The game interface is currently in Chinese. Saved games are not implemented; refreshing the page resets the current run.

Game loop: start an adventure → choose a class → explore rooms → resolve events or combat → settle resources and level up → challenge the final boss.

See the [gameplay guide](docs/guide.md) (Chinese) for detailed rules. It retains cross-platform rule definitions, and some values may differ from the Web version. [`constants.ts`](src/game/constants.ts), [`state.ts`](src/game/state.ts), and the [tests](src/game/state.spec.ts) define the current behavior.

## Quick start

### Requirements

- Node.js 22 LTS (version 22.12 or later within 22.x), or Node.js 24 LTS.
- npm (included with Node.js).
- A modern browser supporting ES2020 and Canvas 2D.

### Install and run

```bash
git clone --branch main https://github.com/Infinovast/FalconCrypt.git
cd FalconCrypt
npm ci
npm run dev
```

The default address is <http://localhost:5173>. Use the address printed in the terminal if a different port is selected.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install dependencies from the lockfile |
| `npm run dev` | Start the Vite development server |
| `npm test` | Run GameState unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build` | Check TypeScript and build into `dist/` |
| `npm run preview` | Preview an existing production build locally |
| `npm run deploy` | Build and deploy to the Cloudflare Pages project `fc` |

Press `Ctrl+Shift+Alt+D` to toggle the developer panel and adjust resources or the next room type while debugging.

## Build and deploy

### Static hosting

```bash
npm run build
npm run preview
```

Deploy the generated `dist/` directory to a static hosting service. Configure the hosting platform with `npm run build` as the build command and `dist` as the output directory. For deployments under a subpath, set the corresponding `base` in [`vite.config.ts`](vite.config.ts).

### Cloudflare Pages

Wrangler is included as a development dependency. Log in to Cloudflare, then build and deploy to your own Pages project:

```bash
npx wrangler login
npm run build
npx wrangler pages deploy dist --project-name your-project-name
```

Replace `your-project-name` with your project name. The existing `npm run deploy` script targets the fixed project name `fc`; update it in [`package.json`](package.json) before using that shortcut for your own project.

## Project structure

Stack: React 18, TypeScript, Vite 5, Vitest, plain CSS, and Canvas 2D.

```text
.
├── docs/guide.md              # Gameplay guide and cross-platform rules
├── src/
│   ├── animations/            # Room transitions, combat, and resource effects
│   ├── components/            # Action panels, status, resource widgets, and canvas
│   ├── game/
│   │   ├── constants.ts       # Classes, rooms, balance values, and tooltips
│   │   ├── state.ts           # GameState: map, event, and combat rules
│   │   ├── state.spec.ts      # Game rule unit tests
│   │   ├── types.ts           # Domain types
│   │   └── uiHelpers.ts       # Resource previews, logs, and danger calculation
│   ├── App.tsx               # Game stages and interface orchestration
│   ├── main.tsx              # React entry point
│   └── styles.css            # Global styles, responsive layout, and CSS animations
├── index.html                # Vite HTML entry point
├── package.json              # Dependencies and development commands
├── package-lock.json         # Dependency lockfile
├── tsconfig.json             # TypeScript configuration
└── vite.config.ts            # Vite configuration
```

`GameState` manages a mutable `snapshot`; `App.tsx` triggers a render after calling game rule methods. Gameplay belongs in `src/game/`, presentation components in `src/components/`, and Canvas effects in `src/animations/` and `GameCanvas.tsx`. Local artifacts in `node_modules/`, `dist/`, and `.wrangler/` are ignored by Git.

## Contributing

Report bugs or discuss features through [Issues](https://github.com/Infinovast/FalconCrypt/issues), or open a pull request targeting `main`.

1. Create a working branch from `main` and keep each change focused on one concern.
2. Update relevant tests and documentation when changing gameplay. Keep this README and the [Chinese version](README.md) aligned.
3. Run `npm test` and `npm run build` before submitting.
4. Use concise commit prefixes, such as `feat: add a room event`, `fix: correct combat settlement`, or `docs: update gameplay notes`. Other supported prefixes include `refactor:`, `test:`, `build:`, and `chore:`.

Bug reports should include reproduction steps, browser version, floor and room, class and resource state, and screenshots or logs.

## License

This project is licensed under the [MIT License](LICENSE). Copyright © 2026 [Harold Chiu (Infinovast)](https://github.com/Infinovast).
