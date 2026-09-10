require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { upsertRestaurants, getPool } = require('../db');

async function seed() {
    const dataPath = path.join(__dirname, '../../js/data/restaurant.json');
    const restaurants = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const count = await upsertRestaurants(restaurants);
    console.log(`Seeded ${count} curated restaurants.`);
    await getPool().end();
}

seed().catch(error => {
    console.error('Restaurant seed failed:', error.message);
    getPool()?.end(() => process.exit(1));
});