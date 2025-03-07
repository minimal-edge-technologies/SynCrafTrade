// server/src/models/OrderRelation.js
import mongoose from 'mongoose';

const orderRelationSchema = new mongoose.Schema({
  parentOrderId: {
    type: String,
    required: true,
    index: true
  },
  childOrderId: {
    type: String,
    required: true,
    index: true
  },
  parentAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  childAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  symbol: String,
  quantity: Number,
  price: Number,
  transactionType: String,
  status: String,
  copyRatio: Number,
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Create index for efficient querying
orderRelationSchema.index({ parentOrderId: 1, childOrderId: 1 }, { unique: true });

const OrderRelation = mongoose.model('OrderRelation', orderRelationSchema);
export default OrderRelation;