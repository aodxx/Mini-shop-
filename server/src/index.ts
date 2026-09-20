import { createApp } from './app.js';
import { parseEnv } from './env.js';

const env = parseEnv();
const app = createApp();

try {
  await app.listen({ host: '0.0.0.0', port: env.PORT });
  console.log(`Mini Shop API listening on port ${env.PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
