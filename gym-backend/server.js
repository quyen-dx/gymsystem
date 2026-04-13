

import cors from 'cors';
import express from 'express';
import connectDB from './src/config/db.js';
import authRoutes from './src/routes/authRoutes.js';
import planRoutes from './src/routes/planRoutes.js';



const app = express();


app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);


app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'GymSystem API is running 🚀' });
});


app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} không tồn tại` });
});


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Lỗi server',
  });
  next;
});


const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});