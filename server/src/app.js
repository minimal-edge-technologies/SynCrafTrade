// server/src/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import ordersRoutes from './routes/orders.js';
import positionsRoutes from './routes/positions.js';
import { wsService } from './services/websocketService.js';
import { tokenManagementService } from './services/tokenManagementService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/copy-trading')
.then(() => {
  console.log('Connected to MongoDB');
  // Initialize token management after DB connection
  tokenManagementService.initialize();
})
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/positions', positionsRoutes);

// Test route
app.get('/api/test', (req, res) => {
  console.log('Test route hit');
  res.json({ message: 'Server is running!' });
});



// Create single server instance
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


process.on('SIGINT', () => {
  tokenManagementService.stop();
  // Other cleanup...
});

process.on('SIGTERM', () => {
  tokenManagementService.stop();
  // Other cleanup...
});

// Initialize WebSocket service with server
wsService.initialize(server);