const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const client = require('prom-client');
require('dotenv').config();

const contactRoutes = require('./routes/contactRoutes');

const app = express();

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
});

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequestsInProgress = new client.Gauge({
  name: "http_requests_in_progress",
  help: "Current number of HTTP requests being processed",
  registers: [register],
});

const backendErrorsTotal = new client.Counter({
  name: "backend_errors_total",
  help: "Total number of backend HTTP errors",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

/**
 * Allowed Origins
 */
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "https://stock-frontend.kindbeach-fc6d1390.eastus.azurecontainerapps.io"
];

/**
 * CORS Configuration
 */
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

/**
 * Body Parser
 */
app.use(express.json());

/**
 * Request Logger & Prometheus Metrics
 */
app.use((req, res, next) => {

  // Do not include Prometheus scrape requests in application metrics
  if (req.path === "/metrics") {
    return next();
  }

  const end = httpRequestDuration.startTimer();

  httpRequestsInProgress.inc();

  res.on("finish", () => {
    // Request completed
    httpRequestsInProgress.dec();

    const route = req.route?.path || req.path;

    // Count every request
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });

    // Count only failed requests (4xx & 5xx)
    if (res.statusCode >= 400) {
      backendErrorsTotal.inc({
        method: req.method,
        route,
        status_code: res.statusCode,
      });
    }

    // Record request duration
    end({
      method: req.method,
      route,
      status_code: res.statusCode,
    });

    // Log request
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode}`);
  });

  next();
});

/**
 * Root Route
 */
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Stock Market Backend API is running'
  });
});

/**
 * Health Check Route
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    database:
      mongoose.connection.readyState === 1
        ? 'Connected'
        : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

/**
 * Prometheus Metrics
 */
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

/**
 * API Routes
 */
app.use('/api/contact', contactRoutes);

/**
 * Server Port
 */
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log('MongoDB connected');

      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('MongoDB Connection Error:', err);
      process.exit(1);
    });
}

module.exports = app;