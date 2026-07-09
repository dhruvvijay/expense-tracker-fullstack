# Expensely — Full-stack expense tracker

A complete college mini project: login/signup, a real database, recurring
expenses, and CSV/PDF export. Built with Node.js, Express, MongoDB, and
vanilla HTML/CSS/JS on the frontend (no framework needed).

## Folder structure

```
expense-tracker-fullstack/
├── server/                  Backend (Node.js + Express + MongoDB)
│   ├── config/db.js         Database connection
│   ├── models/User.js       User schema
│   ├── models/Expense.js    Expense schema (supports recurring expenses)
│   ├── middleware/auth.js   JWT authentication check
│   ├── routes/authRoutes.js Register / login endpoints
│   ├── routes/expenseRoutes.js  Expense CRUD + budget endpoints
│   ├── server.js            App entry point
│   ├── package.json
│   └── .env.example         Copy this to .env and fill in your values
│
└── public/                  Frontend (plain HTML/CSS/JS)
    ├── login.html
    ├── register.html
    ├── dashboard.html
    ├── css/style.css
    └── js/
        ├── api.js           Shared fetch helper
        ├── auth.js           Login/register logic
        └── dashboard.js      Main app logic, charts, exports
```

## Features

- Email/password signup and login (passwords hashed with bcrypt, sessions via JWT)
- Each user's expenses are private to their account, stored in MongoDB
- Dashboard with stat cards, spending trend chart, and category breakdown
- Full transactions page with search, filter, and sort
- **Recurring expenses** — mark a bill/subscription as recurring (weekly or
  monthly) and it automatically re-appears as a new transaction each time
  it's due, calculated server-side
- **Export to CSV** and **export to PDF** from the dashboard
- Per-user monthly budget you can edit in Settings
- Responsive layout — sidebar collapses to icons on mobile

## Setup instructions

### 1. Install Node.js
Download from [nodejs.org](https://nodejs.org) (LTS version) if you don't have it.

### 2. Get a MongoDB database
Easiest option — MongoDB Atlas (free, cloud-hosted, no installation):
1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and create a free account
2. Create a free cluster (M0 tier)
3. Under "Database Access", create a database user with a password
4. Under "Network Access", allow access from anywhere (0.0.0.0/0) for development
5. Click "Connect" → "Drivers" and copy your connection string — it looks like:
   `mongodb+srv://username:password@cluster.mongodb.net/expense-tracker`

Alternative — install MongoDB locally from [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
and use `mongodb://127.0.0.1:27017/expense-tracker` instead.

### 3. Configure the backend
```bash
cd server
npm install
cp .env.example .env
```
Open `.env` and paste in your MongoDB connection string, and set `JWT_SECRET`
to any long random string (this signs login sessions).

### 4. Run the server
```bash
npm start
```
You should see `MongoDB connected` and `Server running on http://localhost:5000`
in the terminal.

### 5. Open the app
Go to **http://localhost:5000** in your browser. The backend also serves the
frontend files, so you don't need a separate server for `public/`.

1. Click "Sign up" and create an account
2. You'll land on the dashboard — add an expense to see it flow through
3. Try marking one as "recurring" and check the Recurring tab
4. Try Export CSV / Export PDF from the dashboard

## For your report

**Tech stack:**
- Frontend: HTML, CSS, JavaScript, Chart.js (charts), jsPDF (PDF export)
- Backend: Node.js, Express.js
- Database: MongoDB (via Mongoose ODM)
- Authentication: bcrypt (password hashing) + JWT (session tokens)

**Database design (2 collections):**
- `users`: name, email, hashed password, monthlyBudget
- `expenses`: linked to a user, description, amount, category, date,
  isRecurring flag, frequency, nextDueDate

**Architecture:** This follows a standard 3-tier structure — frontend
(public/), backend/API layer (server/routes, server/middleware), and
data layer (server/models + MongoDB). Good talking point for your viva.

## Troubleshooting

- **"MongoDB connection failed"** — double check your `MONGODB_URI` in `.env`,
  and make sure your Atlas cluster's Network Access allows your IP.
- **Blank page / can't reach localhost:5000** — make sure `npm start` is
  still running in your terminal.
- **"Invalid email or password"** on first try — make sure you signed up
  first via the Sign up page before trying to log in.
