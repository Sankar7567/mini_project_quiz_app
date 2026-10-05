'use strict';

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// ─── Route Imports ────────────────────────────────────────────────────────────
const domainRoutes = require('./routes/domainRoutes');
const questionRoutes = require('./routes/questionRoutes');
const quizRoutes = require('./routes/quizRoutes');

// ─── App Init ─────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/quizapp';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Request logger (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/domains', domainRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/quiz', quizRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Catch-all: serve index.html for client-side routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('❌  Error:', err.message);

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  // Mongoose Cast Error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid ID format' });
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `Duplicate value for field: ${field}`,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ─── Auto-Seed Function ───────────────────────────────────────────────────────
const autoSeed = async () => {
  try {
    const Domain = require('./models/Domain');
    const Question = require('./models/Question');
    const { domains, questionsData } = require('./seeds/quizData');

    const domainCount = await Domain.countDocuments();
    if (domainCount >= domains.length) {
      console.log(
        `ℹ️   Database already has ${domainCount} domains — skipping auto-seed`
      );
      return;
    }

    console.log('🌱  Auto-seeding database with quiz data...');

    // Clear and re-seed
    await Question.deleteMany({});
    await Domain.deleteMany({});

    const createdDomains = [];
    for (const domainData of domains) {
      const domain = new Domain(domainData);
      await domain.save();
      createdDomains.push(domain);
    }

    const domainMap = {};
    createdDomains.forEach((d) => {
      domainMap[d.name] = d;
    });

    let totalQ = 0;
    for (const [domainName, questions] of Object.entries(questionsData)) {
      const domain = domainMap[domainName];
      if (!domain) continue;
      const docs = questions.map((q) => ({ domainId: domain._id, ...q }));
      await Question.insertMany(docs);
      totalQ += docs.length;
    }

    console.log(
      `✅  Auto-seed complete: ${createdDomains.length} domains, ${totalQ} questions`
    );
  } catch (err) {
    console.error('⚠️   Auto-seed failed (app will still run):', err.message);
  }
};

// ─── Database Connection & Server Start ───────────────────────────────────────
const startServer = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅  MongoDB connected: ${MONGODB_URI}`);

    // Run auto-seed after connection
    await autoSeed();
  } catch (err) {
    console.warn(
      `⚠️   MongoDB connection failed: ${err.message}`
    );
    console.warn('   Running in offline/mock mode — API will return 503 for DB operations');
  }

  // Start HTTP server regardless of DB status
  app.listen(PORT, () => {
    console.log(`\n🚀  Quiz App running at http://localhost:${PORT}`);
    console.log(`    API Base:    http://localhost:${PORT}/api`);
    console.log(`    Health:      http://localhost:${PORT}/api/health`);
    console.log(`    Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer();
