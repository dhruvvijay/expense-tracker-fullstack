const express = require('express');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/friends - list my friends
router.get('/', async (req, res) => {
  try {
    const me = await User.findById(req.userId).populate('friends', 'name email');
    res.json(me.friends);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch friends.', error: err.message });
  }
});

// POST /api/friends/add - add a friend by their email (they must already have an account)
router.post('/add', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Enter the email of the friend you want to add.' });

    const friend = await User.findOne({ email: email.toLowerCase() });
    if (!friend) {
      return res.status(404).json({ message: 'No account found with that email. They need to sign up first.' });
    }
    if (friend._id.toString() === req.userId) {
      return res.status(400).json({ message: "You can't add yourself as a friend." });
    }

    const me = await User.findById(req.userId);
    if (me.friends.includes(friend._id)) {
      return res.status(409).json({ message: 'You are already friends with this person.' });
    }

    // Add each other mutually, so both sides see the friendship
    me.friends.push(friend._id);
    await me.save();
    friend.friends.push(me._id);
    await friend.save();

    res.status(201).json({ id: friend._id, name: friend.name, email: friend.email });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add friend.', error: err.message });
  }
});

// DELETE /api/friends/:id - remove a friend (mutual)
router.delete('/:id', async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    me.friends = me.friends.filter(f => f.toString() !== req.params.id);
    await me.save();

    const friend = await User.findById(req.params.id);
    if (friend) {
      friend.friends = friend.friends.filter(f => f.toString() !== req.userId);
      await friend.save();
    }

    res.json({ message: 'Friend removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove friend.', error: err.message });
  }
});

module.exports = router;
