const request = require('supertest');

// Mock Contact model so tests run fast and isolated without MongoDB
jest.mock('../models/Contact', () => {
  const mockContactInstance = {
    save: jest.fn().mockResolvedValue({
      name: 'Test User',
      email: 'test@example.com',
      message: 'Hello'
    })
  };
  const MockContact = jest.fn().mockImplementation(() => mockContactInstance);
  MockContact.find = jest.fn().mockResolvedValue([
    { _id: '1', name: 'Test User', email: 'test@example.com', message: 'Hello' }
  ]);
  return MockContact;
});

const app = require('../server');

describe('Backend API Tests', () => {
  describe('GET /health', () => {
    test('should return status UP and HTTP 200 without requiring MongoDB', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'UP');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /', () => {
    test('should return root welcome message and HTTP 200', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Stock Market Backend API is running',
      });
    });
  });

  describe('GET /metrics', () => {
    test('should expose Prometheus metrics and return HTTP 200', async () => {
      const response = await request(app).get('/metrics');
      expect(response.status).toBe(200);
      expect(response.text).toContain('process_cpu');
      expect(response.text).toContain('http_requests_total');
    });
  });

  describe('GET /api/contact', () => {
    test('should return list of contacts with HTTP 200', async () => {
      const response = await request(app).get('/api/contact');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0].name).toBe('Test User');
    });
  });

  describe('POST /api/contact', () => {
    test('should save contact submission and return HTTP 200', async () => {
      const response = await request(app)
        .post('/api/contact')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          message: 'Interested in stock analytics'
        });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Contact form submitted successfully!');
    });
  });
});
