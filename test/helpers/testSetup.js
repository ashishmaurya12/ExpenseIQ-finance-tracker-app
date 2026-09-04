const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Set up an isolated data directory for a test suite run.
 * Overrides process.env.DATA_DIR so fileStore reads/writes to a private directory.
 * @param {string} suiteName
 * @returns {{ isolatedDir: string, cleanup: Function }}
 */
function setupTestIsolation(suiteName) {
  const sanitizeName = (suiteName || 'suite').replace(/[^a-zA-Z0-9_-]/g, '_');
  const uniqueId = `${sanitizeName}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const isolatedDir = path.join(__dirname, '..', 'scratch_data', uniqueId);

  fs.mkdirSync(isolatedDir, { recursive: true });
  process.env.DATA_DIR = isolatedDir;

  return {
    isolatedDir,
    cleanup: () => {
      if (fs.existsSync(isolatedDir)) {
        try {
          fs.rmSync(isolatedDir, { recursive: true, force: true });
        } catch {}
      }
    }
  };
}

module.exports = { setupTestIsolation };
