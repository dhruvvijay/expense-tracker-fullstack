# Expensely — Full-stack expense tracker with bill splitting

A college mini project: personal expense tracking (login, recurring bills,
CSV/PDF export, analytics) PLUS Splitwise-style bill splitting between
friends — add friends, create trip/group expenses, split them equally or by
custom amount, and track who owes whom.

## 🌐 Live demo

**https://expense-tracker-fullstack-1pyg.onrender.com**

> Free-tier hosting — the app "sleeps" after 15 minutes of no traffic, so
> the first visit after a while may take 30–60 seconds to wake up.

## What's new: bill splitting

**Honest scope note:** this does NOT connect to real bank accounts or
auto-detect payments — that needs paid banking APIs (Plaid etc.) which is
outside what's realistic for a free student project, and it's also not how
the real Splitwise app works either. Instead:

1. **Friends** — add another registered user as a friend by their email
2. **Groups & trips** — create a group (e.g. "Goa Trip 2026"), add friends to it
3. **Add a group expense** — e.g. "Hotel — ₹6000, paid by Riya, split equally
   between 4 people" (or enter custom amounts per person instead of equal)
4. **Balances** — the app calculates, across every group you're in, a single
   net balance per friend: how much they owe you, or you owe them
5. **Settle up** — when someone actually pays back (cash, UPI, whatever),
   you record it in the app, which updates the balance

This mirrors exactly how Splitwise's core free functionality works.

## Folder structure

```
expense-tracker-fullstack/
├── server/
│   ├── models/
│   │   ├── User.js          includes a `friends` list
│   │   ├── Expense.js       personal expenses
│   │   ├── Group.js         a trip/group of friends
│   │   ├── GroupExpense.js  a split expense within a group
│   │   └── Settlement.js    a recorded real-world payment
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── expenseRoutes.js
│   │   ├── friendRoutes.js      add/remove/list friends
│   │   ├── groupRoutes.js       create/list/view groups
│   │   ├── groupExpenseRoutes.js  add a split expense
│   │   └── balanceRoutes.js     calculates balances + settle up
│   ├── middleware/auth.js
│   ├── config/db.js
│   ├── server.js
│   └── .env.example
└── public/
    ├── login.html / register.html / dashboard.html
    ├── css/style.css
    └── js/ (api.js, auth.js, dashboard.js)
```

## How the balance math works

Every group expense has a `paidBy` person and a list of `splits` (who owes
how much toward it). The `/api/balances` route walks every expense across
every group you're in, builds a simple debt ledger between every pair of
people, nets it all down to one number per friend, and subtracts any
settlements you've already recorded. That's the entire algorithm — no
external library needed.

## Setup instructions

1. Install [Node.js](https://nodejs.org) if you don't have it
2. Get a MongoDB connection string — MongoDB Atlas (free, cloud) or your
   own local MongoDB
3. In `server/`:
   ```
   npm install
   cp .env.example .env
   ```
   Fill in `MONGODB_URI` and set `JWT_SECRET` to any random string
4. Run it:
   ```
   npm start
   ```
5. Open `http://localhost:5000`

## Trying the split-expense feature locally

Since splitting requires two accounts, the easiest way to test it yourself:
1. Sign up as yourself (e.g. your real email)
2. Open an incognito/private browser window, sign up again with a second
   email (e.g. a throwaway test one) — this is your "friend" account
3. In your main account, go to **Friends** → add the test account's email
4. Go to **Groups & trips** → create a group → add that friend
5. Add a group expense and check **Balances**

## Deployment

Deployed on Render (free tier), connected to auto-deploy from GitHub's
`main` branch, with MongoDB Atlas as the database. Push to `main` and
Render redeploys automatically.

## For your report

**New additions over the base expense tracker:**
- Two-way friend relationships (stored as a `friends` array on the User model)
- Many-to-many group membership (a Group references multiple Users)
- A split-expense ledger that supports both equal and custom splitting
- A debt-netting algorithm that collapses many small debts into one net
  balance per friend
- A settlement log, separate from expenses, to record real-world repayments
