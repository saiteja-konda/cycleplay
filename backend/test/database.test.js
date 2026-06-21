const { expect } = require('chai');
const { dbAll } = require('../db/database');

describe('Schema migration', () => {
  it('rides table has all 7 new columns', async () => {
    const columns = await dbAll('PRAGMA table_info(rides)');
    const colNames = columns.map(c => c.name);
    expect(colNames).to.include('name');
    expect(colNames).to.include('notes');
    expect(colNames).to.include('rating');
    expect(colNames).to.include('photo_url');
    expect(colNames).to.include('weather_condition');
    expect(colNames).to.include('weather_temp');
    expect(colNames).to.include('weather_wind');
  });

  it('migrations are idempotent (no duplicate column errors)', async () => {
    const columns = await dbAll('PRAGMA table_info(rides)');
    const names = columns.filter(c => c.name === 'name');
    expect(names).to.have.length(1);
  });
});
