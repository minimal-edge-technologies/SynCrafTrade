// server/src/models/Account.js
import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
  clientCode: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true
  },
  // Encrypted credentials
  credentials: {
    password: { type: String, required: true },
    totp: { type: String, required: true },
    apiKey: { type: String, required: true }
  },
  // Add tokens field
  tokens: {
    jwtToken: String,
    refreshToken: String,
    feedToken: String,
    issuedAt: {
      type: Date,
      default: Date.now
    }
  },
  authStatus: {
    type: String,
    enum: ['ACTIVE', 'REQUIRES_AUTH', 'DISABLED'],
    default: 'ACTIVE'
  },
  accountType: {
    type: String,
    enum: ['PARENT', 'CHILD'],  // Changed from MASTER/FOLLOWER
    default: 'CHILD'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'DISCONNECTED'],
    default: 'ACTIVE'
  },
  balance: {
    net: Number,
    used: Number,
    available: Number
  },
  settings: {
    copyRatio: {
      type: Number,
      default: 1.0,
      min: 0.1,
      max: 10
    },
    maxPositionSize: {
      type: Number,
      default: 10
    },
    riskLimit: {
      type: Number,
      default: 2
    },
    allowedInstruments: [{
      type: String
    }]
  },
  lastSync: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  parentAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    default: null  // For parent accounts, this remains null
  },
  copyTradingEnabled: {
    type: Boolean,
    default: true
  },
});

// Pre-save middleware to update timestamps
accountSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Account = mongoose.model('Account', accountSchema);

export default Account;