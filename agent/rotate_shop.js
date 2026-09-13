import 'dotenv/config';
import { rotateShop } from './shopRotation.js';

rotateShop()
  .then((rows) => {
    console.log(`Shop rotated: ${rows.map((r) => `${r.name} (${r.rarity})`).join(', ')}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Shop rotation failed:', err);
    process.exit(1);
  });
