const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  desc: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    enum: ['Groceries', 'Transport', 'Entertainment', 'Bills', 'Health', 'Other'],
    default: 'Other'
  },
  date: {
    type: Date,
    default: Date.now
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  frequency: {
    type: String,
    enum: ['weekly', 'monthly', null],
    default: null
  },
  nextDueDate: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
