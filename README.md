# E-Sport Tournament Manager

A web application for organizing and managing esports tournaments. Create tournaments, manage teams, generate brackets, and track results in real time.

## Features

**Tournament management**
- Three formats supported: single elimination, double elimination, round robin
- Solo (player vs player) and team (team vs team) modes
- Configurable participant limits (4 to 64 for elimination, 4 to 16 for round robin)
- Tournament logos with automatic image optimization
- Custom seeding via drag & drop for elimination brackets

**Match tracking**
- Score entry with edit support
- Automatic winner determination based on score
- Bracket auto-advancement (single & double elimination)
- BYE propagation when participant count differs from bracket size
- Live standings table for round robin
- Final podium display (gold/silver/bronze) when tournament ends

**Teams**
- Team creation with custom logo and bio
- Invitation system (request to join, accept/decline)
- Team page with member list and tournament history

**User profile**
- Custom avatar
- Optional Discord username with clickable badge (copy to clipboard)
- Personal tournament history (active and past, separated)

**Other**
- Search and filter tournaments by name, game, mode, and status
- Tournament list sorted by upcoming date, finished tournaments grouped at the bottom
- Manager controls (start tournament, finish manually, kick participants, edit tournament)

## Tech stack

**Backend**
- Node.js with Express
- SQLite via better-sqlite3 (with WAL mode)
- JWT authentication
- bcryptjs for password hashing
- Multer + Sharp for image uploads and optimization

**Frontend**
- React with Vite
- React Router for navigation
- Axios for API calls
- Inline styles (no external CSS framework)

## Project structure

```
esport-manager/
├── server/
│   ├── src/
│   │   ├── db/                  Database init and migrations
│   │   ├── middleware/          Auth and file upload
│   │   ├── routes/              API endpoints
│   │   ├── utils/               Bracket and standings generators
│   │   └── index.js             Server entry point
│   ├── data/                    SQLite database file (gitignored)
│   ├── uploads/                 User-uploaded images (gitignored)
│   └── .env                     Environment variables (gitignored)
└── client/
    └── src/
        ├── api/                 Axios instance
        ├── components/          Reusable components
        ├── constants/           Static data (games list, etc.)
        ├── context/             React contexts (auth)
        └── pages/               Top-level route components
```

## Getting started

### Prerequisites

- Node.js 18 or higher
- npm

### Installation

Clone the repository:

```bash
git clone https://github.com/Noha-Dracau/esport-manager.git
cd esport-manager
```

Install backend dependencies:

```bash
cd server
npm install
```

Install frontend dependencies:

```bash
cd ../client
npm install
```

### Environment variables

Create a `.env` file in `server/` with the following content:
PORT=3001
JWT_SECRET=<your_random_secret>

Generate a strong secret with:

```bash
openssl rand -hex 32
```

### Running the app

In two separate terminals:

**Backend** (from the `server/` directory):

```bash
node src/index.js
```

The API runs on `http://localhost:3001`.

**Frontend** (from the `client/` directory):

```bash
npm run dev
```

The app runs on `http://localhost:5173`.

## Database

The SQLite database is created automatically on first run at `server/data/esport.db`. Migrations run on startup via `runMigrations()` in `server/src/db/schema.js`.

To reset the database during development, stop the server and delete `server/data/esport.db`. It will be recreated on next startup.

## API overview

| Resource         | Endpoint                                          | Description                            |
|------------------|---------------------------------------------------|----------------------------------------|
| Auth             | `POST /auth/register`, `POST /auth/login`         | User registration and login            |
| Users            | `GET /users/me`, `PATCH /users/me`, `GET /users/:id` | Profile management                  |
| Teams            | `GET /teams`, `POST /teams`, `PATCH /teams/:id`, `DELETE /teams/:id` | Team CRUD            |
| Team membership  | `POST /teams/:id/leave`, `DELETE /teams/:id/members/:userId` | Leave or kick from a team    |
| Invitations      | `POST /invitations`, `PATCH /invitations/:id`, `DELETE /invitations/:id` | Team invitations         |
| Tournaments      | `GET /tournaments`, `POST /tournaments`, `PATCH /tournaments/:id`, `DELETE /tournaments/:id` | Tournament CRUD |
| Registration     | `POST /tournaments/:id/register`, `DELETE /tournaments/:id/unregister` | Join or leave a tournament |
| Bracket          | `GET /tournaments/:id/bracket`, `POST /tournaments/:id/bracket/generate`, `PATCH /tournaments/:id/bracket/swap` | Bracket management |
| Matches          | `PUT /tournaments/:id/matches/:matchId`           | Submit or edit match score             |
| Lifecycle        | `POST /tournaments/:id/start`, `POST /tournaments/:id/finish` | Tournament lifecycle      |
| Standings        | `GET /tournaments/:id/standings`                  | Round robin standings                  |
| Helpers          | `GET /tournaments/games`                          | List of games with at least one tournament |

Authentication is required for all write operations. JWT tokens are sent in the `Authorization: Bearer <token>` header.

## Notes

- The app is currently optimized for desktop. Mobile responsiveness is not implemented.
- Drag & drop bracket seeding requires a mouse and does not work on touch devices.
- All user-uploaded images are resized and re-encoded as WebP for size optimization.
- French and English are mixed in some internal code comments; user-facing strings are entirely in English.

## License

This project is provided as-is for educational purposes.

Noha Robert--Altese

