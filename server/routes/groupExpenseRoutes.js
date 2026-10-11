const express = require('express');
const Group = require('../models/Group');
const GroupExpense = require('../models/GroupExpense');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/group-expenses - add a split expense to a group
// body: { groupId, desc, amount, paidBy, splitType: 'equal'|'custom', splits: [{user, amount}] (required if custom) }
router.post('/', async (req, res) => {
  try {
    const { groupId, desc, amount, paidBy, splitType, splits } = req.body;

    if (!groupId || !desc || !amount || amount <= 0 || !paidBy) {
      return res.status(400).json({ message: 'Group, description, amount, and who paid are all required.' });
    }

    const group = await Group.findOne({ _id: groupId, members: req.userId });
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    const memberIds = group.members.map(m => m.toString());
    if (!memberIds.includes(paidBy)) {
      return res.status(400).json({ message: 'The payer must be a member of this group.' });
    }

    let finalSplits = [];

    if (splitType === 'custom') {
      if (!splits || !splits.length) {
        return res.status(400).json({ message: 'Provide custom split amounts for each member included.' });
      }
      const total = splits.reduce((s, x) => s + Number(x.amount), 0);
      if (Math.abs(total - amount) > 0.5) {
        return res.status(400).json({ message: `Custom split amounts (₹${total}) must add up to the total amount (₹${amount}).` });
      }
      finalSplits = splits.map(s => ({ user: s.user, amount: Number(s.amount) }));
    } else {
      // Equal split among the members provided (defaults to all group members)
      const participants = (req.body.participantIds && req.body.participantIds.length) ? req.body.participantIds : memberIds;
      const share = Math.round((amount / participants.length) * 100) / 100;
      finalSplits = participants.map((userId, i) => ({
        user: userId,
        // give any rounding remainder to the last person so splits sum exactly
        amount: i === participants.length - 1
          ? Math.round((amount - share * (participants.length - 1)) * 100) / 100
          : share
      }));
    }

    const expense = await GroupExpense.create({
      group: groupId,
      desc,
      amount,
      paidBy,
      splitType: splitType || 'equal',
      splits: finalSplits
    });

    const populated = await GroupExpense.findById(expense._id)
      .populate('paidBy', 'name email')
      .populate('splits.user', 'name email');

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add group expense.', error: err.message });
  }
});

// DELETE /api/group-expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const expense = await GroupExpense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found.' });

    const group = await Group.findOne({ _id: expense.group, members: req.userId });
    if (!group) return res.status(403).json({ message: 'You are not a member of this group.' });

    await expense.deleteOne();
    res.json({ message: 'Group expense deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete group expense.', error: err.message });
  }
});

module.exports = router;
