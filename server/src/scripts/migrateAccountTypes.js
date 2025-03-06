// server/src/scripts/migrateAccountTypes.js
import mongoose from 'mongoose';
import Account from '../models/Account.js';

async function migrateAccountTypes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Update MASTER to PARENT
    await Account.updateMany(
      { accountType: 'MASTER' },
      { $set: { accountType: 'PARENT' }}
    );

    // Update FOLLOWER to CHILD
    await Account.updateMany(
      { accountType: 'FOLLOWER' },
      { $set: { accountType: 'CHILD' }}
    );

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migrateAccountTypes();