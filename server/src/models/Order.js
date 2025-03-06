// server/src/models/Order.js
import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  parentOrderId: String,
  accountId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Account' },
  symbol: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: Number,
  status: String,
  transactionType: String,
  timestamp: { type: Date, default: Date.now },
  copyRelation: {
    isChild: Boolean,
    parentOrderId: String,
    childAccountId: mongoose.Schema.Types.ObjectId
  }
});

const Order = mongoose.model('Order', orderSchema);
export default Order;