import { app } from './app.js';
import { env } from './config/env.js';

const host = '0.0.0.0';

app.listen(env.port, host, () => {
  console.log(`IARA-admin backend listening on http://${host}:${env.port}`);
});
