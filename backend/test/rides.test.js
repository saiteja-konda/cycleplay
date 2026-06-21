const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const ridesRouter = require('../routes/rides');

describe('GET /api/rides/stats', () => {
  let app;

  before(() => {
    app = express();
    app.use(express.json());
    app.use('/api/rides', ridesRouter);
  });

  it('returns 200 with monthly, yearly, and totals', async () => {
    const res = await request(app).get('/api/rides/stats');
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('monthly');
    expect(res.body).to.have.property('yearly');
    expect(res.body).to.have.property('totals');
    expect(res.body.totals).to.have.property('distance_km');
    expect(res.body.totals).to.have.property('ride_count');
    expect(res.body.totals).to.have.property('moving_hours');
  });

  it('returns arrays for monthly and yearly', async () => {
    const res = await request(app).get('/api/rides/stats');
    expect(Array.isArray(res.body.monthly)).to.be.true;
    expect(Array.isArray(res.body.yearly)).to.be.true;
  });

  it('monthly entries have correct fields', async () => {
    const res = await request(app).get('/api/rides/stats');
    if (res.body.monthly.length > 0) {
      const entry = res.body.monthly[0];
      expect(entry).to.have.all.keys('year', 'month', 'distance_km', 'ride_count', 'moving_hours');
    }
  });
});

describe('PUT /api/rides/:id', () => {
  let app;
  let testRideId;

  before(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/rides', ridesRouter);

    // Create a ride to test with
    const startRes = await request(app).post('/api/rides/start').send({});
    testRideId = startRes.body.ride_id;
    // Stop it to make it complete
    await request(app).post('/api/rides/stop').send({ ride_id: testRideId, moving_seconds: 60, pause_count: 0 });
  });

  it('updates ride name and returns updated ride', async () => {
    const res = await request(app).put(`/api/rides/${testRideId}`).send({ name: 'Test Ride', notes: 'Great!', rating: 2 });
    expect(res.status).to.equal(200);
    expect(res.body.name).to.equal('Test Ride');
    expect(res.body.notes).to.equal('Great!');
    expect(res.body.rating).to.equal(2);
  });

  it('returns 400 when no fields provided', async () => {
    const res = await request(app).put(`/api/rides/${testRideId}`).send({});
    expect(res.status).to.equal(400);
  });

  it('returns 404 for non-existent ride', async () => {
    const res = await request(app).put('/api/rides/9999').send({ name: 'Ghost' });
    expect(res.status).to.equal(404);
  });
});

describe('Weather data in start/stop', () => {
  let app;

  before(() => {
    app = express();
    app.use(express.json());
    app.use('/api/rides', ridesRouter);
  });

  it('POST /start accepts weather data on start', async () => {
    const res = await request(app)
      .post('/api/rides/start')
      .send({ weather_condition: 'Clear', weather_temp: 22, weather_wind: 12 });
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('ride_id');

    // Stop to verify weather persisted
    const stopRes = await request(app).post('/api/rides/stop').send({
      ride_id: res.body.ride_id, moving_seconds: 60, pause_count: 0
    });
    expect(stopRes.status).to.equal(200);
    expect(stopRes.body.weather_condition).to.equal('Clear');
    expect(stopRes.body.weather_temp).to.equal(22);
    expect(stopRes.body.weather_wind).to.equal(12);
  });

  it('POST /stop accepts weather data on stop', async () => {
    const startRes = await request(app).post('/api/rides/start').send({});
    const stopRes = await request(app).post('/api/rides/stop').send({
      ride_id: startRes.body.ride_id, moving_seconds: 60, pause_count: 0,
      weather_condition: 'Rain', weather_temp: 15, weather_wind: 20
    });
    expect(stopRes.status).to.equal(200);
    expect(stopRes.body.weather_condition).to.equal('Rain');
    expect(stopRes.body.weather_temp).to.equal(15);
    expect(stopRes.body.weather_wind).to.equal(20);
  });

  it('handles ride without weather data', async () => {
    const startRes = await request(app).post('/api/rides/start').send({});
    const stopRes = await request(app).post('/api/rides/stop').send({
      ride_id: startRes.body.ride_id, moving_seconds: 60, pause_count: 0
    });
    expect(stopRes.status).to.equal(200);
    expect(stopRes.body.weather_condition).to.be.null;
    expect(stopRes.body.weather_temp).to.be.null;
    expect(stopRes.body.weather_wind).to.be.null;
  });
});
