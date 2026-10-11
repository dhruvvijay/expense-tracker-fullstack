const express = require('express');
const Group = require('../models/Group');
const GroupExpense = require('../models/GroupExpense');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/groups - list groups I'm a member of
router.get('/', async (req, res) => {
  try {
    const groups = await Group.find({ members: req.userId })
      .populate('members', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch groups.', error: err.message });
  }
});

// POST /api/groups - create a new group/trip
// body: { name, memberIds: [friendUserId, ...] }
router.post('/', async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !memberIds || !memberIds.length) {
      return res.status(400).json({ message: 'A group name and at least one member are required.' });
    }

    const members = Array.from(new Set([req.userId, ...memberIds]));
    const group = await Group.create({ name, createdBy: req.userId, members });
    const populated = await Group.findById(group._id).populate('members', 'name email').populate('createdBy', 'name email');

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create group.', error: err.message });
  }
});

// GET /api/groups/:id - group detail including its expenses
router.get('/:id', async (req, res) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, members: req.userId })
      .populate('members', 'name email')
      .populate('createdBy', 'name email');
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    const expenses = await GroupExpense.find({ group: group._id })
      .populate('paidBy', 'name email')
      .populate('splits.user', 'name email')
      .sort({ date: -1 });

    res.json({ group, expenses });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch group.', error: err.message });
  }
});

// DELETE /api/groups/:id - only the creator can delete a group (also deletes its expenses)
router.delete('/:id', async (req, res) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, createdBy: req.userId });
    if (!group) return res.status(404).json({ message: 'Group not found or you are not the creator.' });

    await GroupExpense.deleteMany({ group: group._id });
    await group.deleteOne();

    res.json({ message: 'Group deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete group.', error: err.message });
  }
});

module.exports = router;
