const express = require('express');
const Expense = require('../models/Expense');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function computeNextDueDate(fromDate, frequency) {
  const d = new Date(fromDate);
  if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  return d;
}

// GET /api/expenses - list all expenses for the logged-in user
// Also auto-generates any recurring expenses that are due
router.get('/', async (req, res) => {
  try {
    const recurring = await Expense.find({ user: req.userId, isRecurring: true });
    const now = new Date();

    for (const r of recurring) {
      if (r.nextDueDate && r.nextDueDate <= now) {
        await Expense.create({
          user: req.userId,
          desc: r.desc,
          amount: r.amount,
          category: r.category,
          date: r.nextDueDate,
          isRecurring: false
        });
        r.nextDueDate = computeNextDueDate(r.nextDueDate, r.frequency);
        await r.save();
      }
    }

    const expenses = await Expense.find({ user: req.userId }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch expenses.', error: err.message });
  }
});

// POST /api/expenses - create a new expense (or recurring template)
router.post('/', async (req, res) => {
  try {
    const { desc, amount, category, date, isRecurring, frequency } = req.body;

    if (!desc || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Description and a valid amount are required.' });
    }

    const expenseDate = date ? new Date(date) : new Date();
    const payload = {
      user: req.userId,
      desc,
      amount,
      category: category || 'Other',
      date: expenseDate,
      isRecurring: !!isRecurring,
      frequency: isRecurring ? frequency : null,
      nextDueDate: isRecurring ? computeNextDueDate(expenseDate, frequency) : null
    };

    const expense = await Expense.create(payload);
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add expense.', error: err.message });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!expense) return res.status(404).json({ message: 'Expense not found.' });
    res.json({ message: 'Expense deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete expense.', error: err.message });
  }
});

// PUT /api/expenses/budget - update the user's monthly budget
router.put('/budget', async (req, res) => {
  try {
    const { monthlyBudget } = req.body;
    if (!monthlyBudget || monthlyBudget <= 0) {
      return res.status(400).json({ message: 'Enter a valid budget amount.' });
    }
    const user = await User.findByIdAndUpdate(req.userId, { monthlyBudget }, { new: true });
    res.json({ monthlyBudget: user.monthlyBudget });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update budget.', error: err.message });
  }
});

module.exports = router;
