const express = require('express');
const mongoose = require('mongoose');
const Group = require('../models/Group');
const GroupExpense = require('../models/GroupExpense');
const Settlement = require('../models/Settlement');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Builds a pairwise ledger: ledger[A][B] = amount A owes B (can be negative, meaning B owes A)
function addDebt(ledger, debtorId, creditorId, amount) {
  if (debtorId === creditorId || amount === 0) return;
  if (!ledger[debtorId]) ledger[debtorId] = {};
  if (!ledger[debtorId][creditorId]) ledger[debtorId][creditorId] = 0;
  ledger[debtorId][creditorId] += amount;
}

// GET /api/balances - net balance between me and each friend, across all shared groups
router.get('/', async (req, res) => {
  try {
    const myId = req.userId;
    const groups = await Group.find({ members: myId });
    const groupIds = groups.map(g => g._id);

    const expenses = await GroupExpense.find({ group: { $in: groupIds } });
    const settlements = await Settlement.find({ $or: [{ fromUser: myId }, { toUser: myId }] });

    const ledger = {};

    expenses.forEach(exp => {
      const payer = exp.paidBy.toString();
      exp.splits.forEach(s => {
        const member = s.user.toString();
        if (member !== payer) {
          addDebt(ledger, member, payer, s.amount);
        }
      });
    });

    settlements.forEach(s => {
      // A settlement payment reduces what fromUser owes toUser
      addDebt(ledger, s.fromUser.toString(), s.toUser.toString(), -s.amount);
    });

    // Collapse into net balance per friend, from "my" perspective
    const netByFriend = {};
    function record(friendId, amount) {
      // positive amount = friend owes me; negative = I owe friend
      netByFriend[friendId] = (netByFriend[friendId] || 0) + amount;
    }

    Object.keys(ledger).forEach(debtor => {
      Object.keys(ledger[debtor]).forEach(creditor => {
        const amt = ledger[debtor][creditor];
        if (debtor === myId) record(creditor, -amt);      // I owe creditor
        else if (creditor === myId) record(debtor, amt);  // debtor owes me
      });
    });

    const friendIds = Object.keys(netByFriend).filter(id => Math.abs(netByFriend[id]) > 0.5);
    const friends = await User.find({ _id: { $in: friendIds } }).select('name email');

    const balances = friends.map(f => ({
      friendId: f._id,
      name: f.name,
      email: f.email,
      netBalance: Math.round(netByFriend[f._id.toString()] * 100) / 100
    })).sort((a, b) => b.netBalance - a.netBalance);

    const youAreOwed = balances.filter(b => b.netBalance > 0).reduce((s, b) => s + b.netBalance, 0);
    const youOwe = balances.filter(b => b.netBalance < 0).reduce((s, b) => s + Math.abs(b.netBalance), 0);

    res.json({ balances, summary: { youAreOwed: Math.round(youAreOwed * 100) / 100, youOwe: Math.round(youOwe * 100) / 100 } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to calculate balances.', error: err.message });
  }
});

// POST /api/balances/settle - record a real-world payment to settle up with a friend
// body: { toUserId, amount, note }  (I am paying toUserId this amount)
router.post('/settle', async (req, res) => {
  try {
    const { toUserId, amount, note } = req.body;
    if (!toUserId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Select a friend and enter a valid amount.' });
    }

    const settlement = await Settlement.create({
      fromUser: req.userId,
      toUser: toUserId,
      amount,
      note: note || ''
    });

    res.status(201).json(settlement);
  } catch (err) {
    res.status(500).json({ message: 'Failed to record settlement.', error: err.message });
  }
});

// GET /api/balances/history - list of settlements I've made or received
router.get('/history', async (req, res) => {
  try {
    const settlements = await Settlement.find({ $or: [{ fromUser: req.userId }, { toUser: req.userId }] })
      .populate('fromUser', 'name email')
      .populate('toUser', 'name email')
      .sort({ date: -1 });
    res.json(settlements);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch settlement history.', error: err.message });
  }
});

module.exports = router;
