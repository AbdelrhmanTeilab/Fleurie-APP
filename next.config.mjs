import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export default {
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  webpack(config) { config.resolve.alias['@'] = path.join(root, 'src'); return config; },
};
