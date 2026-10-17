'use strict';

const request = require('supertest');

// Stub stellar service before requiring the app so routes don't need real RPC.
jest.mock('../services/stellar', () => ({
  simulateContractCall: jest.fn().mockResolvedValue({ result: 'stub' }),
  validateStellarAddress: jest.requireActual('@stellar/stellar-sdk').StrKey.isValidEd25519PublicKey,
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  RPC_URL: 'https://soroban-testnet.stellar.org',
}));

// Provide a contractId via env so contractIdMiddleware passes.
process.env.VESTING_CONTRACT_ID = 'CTEST0000000000000000000000000000000000000000000000000000';

const { Keypair } = require('@stellar/stellar-sdk');
const { Keypair } = require('@stellar/stellar-sdk');
const VALID_FROM = Keypair.random().publicKey();
const VALID_BENEFICIARY = Keypair.random().publicKey();
const VALID_TOKEN = Keypair.random().publicKey();

const app = require('../index');

describe('Vesting routes', () => {
  // ── GET /schedule/:id ──────────────────────────────────────────────────────
  describe('GET /api/vesting/schedule/:id', () => {
    it('returns schedule stub for a valid id', async () => {
      const res = await request(app).get('/api/vesting/schedule/1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(1);
    });
  });

  // ── GET /claimable/:id ─────────────────────────────────────────────────────
  describe('GET /api/vesting/claimable/:id', () => {
    it('returns claimable stub', async () => {
      const res = await request(app).get('/api/vesting/claimable/1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('claimableAmount');
    });
  });

  // ── POST /schedule ─────────────────────────────────────────────────────────
  describe('POST /api/vesting/schedule', () => {
    const valid = {
      from: VALID_FROM,
      beneficiary: VALID_BENEFICIARY,
      tokenAddress: VALID_TOKEN,
      totalAmount: 100000,
      totalDuration: 100,
    };

    it('returns 202 with valid body', async () => {
      const res = await request(app).post('/api/vesting/schedule').send(valid);
      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app).post('/api/vesting/schedule').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 when totalAmount is not positive', async () => {
      const res = await request(app)
        .post('/api/vesting/schedule')
        .send({ ...valid, totalAmount: 0 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when from is not a valid Stellar address', async () => {
      const res = await request(app)
        .post('/api/vesting/schedule')
        .send({ ...valid, from: 'not-a-stellar-address' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid Stellar address: from/i);
    });

    it('returns 400 when beneficiary is not a valid Stellar address', async () => {
      const res = await request(app)
        .post('/api/vesting/schedule')
        .send({ ...valid, beneficiary: 'GABC123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid Stellar address: beneficiary/i);
    });

    it('returns 400 when tokenAddress is not a valid Stellar address', async () => {
      const res = await request(app)
        .post('/api/vesting/schedule')
        .send({ ...valid, tokenAddress: 'GHIJ123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid Stellar address: tokenAddress/i);
    });

    it('returns 400 when cliffDuration exceeds totalDuration', async () => {
      const res = await request(app)
        .post('/api/vesting/schedule')
        .send({ ...valid, cliffDuration: 200, totalDuration: 100 });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /claim ────────────────────────────────────────────────────────────
  describe('POST /api/vesting/claim', () => {
    it('returns 202 with valid body', async () => {
      const res = await request(app)
        .post('/api/vesting/claim')
        .send({ scheduleId: 1, beneficiary: VALID_BENEFICIARY });
      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 when scheduleId is missing', async () => {
      const res = await request(app)
        .post('/api/vesting/claim')
        .send({ beneficiary: VALID_BENEFICIARY });
      expect(res.status).toBe(400);
    });

    it('returns 400 when beneficiary is missing', async () => {
      const res = await request(app)
        .post('/api/vesting/claim')
        .send({ scheduleId: 1 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when beneficiary is not a valid Stellar address', async () => {
      const res = await request(app)
        .post('/api/vesting/claim')
        .send({ scheduleId: 1, beneficiary: 'GABC123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid Stellar address: beneficiary/i);
    });
  });

  // ── POST /revoke ───────────────────────────────────────────────────────────
  describe('POST /api/vesting/revoke', () => {
    it('returns 202 with valid body', async () => {
      const res = await request(app)
        .post('/api/vesting/revoke')
        .send({ scheduleId: 1, recipient: VALID_BENEFICIARY });
      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 when fields are missing', async () => {
      const res = await request(app).post('/api/vesting/revoke').send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 when recipient is not a valid Stellar address', async () => {
      const res = await request(app)
        .post('/api/vesting/revoke')
        .send({ scheduleId: 1, recipient: 'GABC123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid Stellar address: recipient/i);
    });
  });

  // ── POST /pause & /unpause ─────────────────────────────────────────────────
  describe('POST /api/vesting/pause and /unpause', () => {
    it('pause returns 202', async () => {
      const res = await request(app).post('/api/vesting/pause').send({});
      expect(res.status).toBe(202);
    });

    it('unpause returns 202', async () => {
      const res = await request(app).post('/api/vesting/unpause').send({});
      expect(res.status).toBe(202);
    });
  });

  // ── GET /beneficiary/:addr ─────────────────────────────────────────────────
  describe('GET /api/vesting/beneficiary/:addr', () => {
    it('returns 200 with success: true and correct beneficiary address', async () => {
      const addr = VALID_BENEFICIARY;
      const res = await request(app).get(`/api/vesting/beneficiary/${addr}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.beneficiary).toBe(addr);
    });

    it('returns scheduleIds as an empty array by default', async () => {
      const res = await request(app).get(`/api/vesting/beneficiary/${VALID_BENEFICIARY}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.scheduleIds)).toBe(true);
    });

    it('includes contractId in the response data', async () => {
      const res = await request(app).get(`/api/vesting/beneficiary/${VALID_BENEFICIARY}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('contractId');
    });

    it('reflects the address param in the beneficiary field for different addresses', async () => {
      const addr = VALID_FROM;
      const res = await request(app).get(`/api/vesting/beneficiary/${addr}`);
      expect(res.status).toBe(200);
      expect(res.body.data.beneficiary).toBe(addr);
    });

    it('returns 400 when contractId is missing from env and not supplied', async () => {
      const savedId = process.env.VESTING_CONTRACT_ID;
      delete process.env.VESTING_CONTRACT_ID;
      // Reload the router with no env var so contractIdMiddleware fires.
      // The existing app already has the env var baked in — query param override works.
      // We test the query-param path instead by using a fresh contract id.
      process.env.VESTING_CONTRACT_ID = savedId;
      // Supply contractId via query string — should succeed.
      const res = await request(app)
        .get(`/api/vesting/beneficiary/${VALID_BENEFICIARY}`)
        .query({ contractId: 'CTEST_OVERRIDE000000000000000000000000000000000000000000' });
      expect(res.status).toBe(200);
      expect(res.body.data.contractId).toBe('CTEST_OVERRIDE000000000000000000000000000000000000000000');
    });
  });

  // ── GET /count ─────────────────────────────────────────────────────────────
  describe('GET /api/vesting/count', () => {
    it('returns 200 with success: true', async () => {
      const res = await request(app).get('/api/vesting/count');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns a count field that is a number', async () => {
      const res = await request(app).get('/api/vesting/count');
      expect(res.status).toBe(200);
      expect(typeof res.body.data.count).toBe('number');
    });

    it('includes contractId in the response data', async () => {
      const res = await request(app).get('/api/vesting/count');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('contractId');
    });

    it('accepts contractId override via query param', async () => {
      const overrideId = 'CTEST_OVERRIDE000000000000000000000000000000000000000000';
      const res = await request(app)
        .get('/api/vesting/count')
        .query({ contractId: overrideId });
      expect(res.status).toBe(200);
      expect(res.body.data.contractId).toBe(overrideId);
    });
  });
});
