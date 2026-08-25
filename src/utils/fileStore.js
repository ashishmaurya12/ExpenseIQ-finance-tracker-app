const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config/config');

/**
 * Ensure the data directory and file exist.
 * Creates an empty JSON array file if missing.
 */
function ensureFile(filename) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf8');
  }
  return filePath;
}

/**
 * Read and parse a JSON data file.
 * @param {string} filename - e.g. 'users.json'
 * @returns {Array} parsed array
 */
function readData(filename) {
  const filePath = ensureFile(filename);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    return [];
  }
}

/**
 * Write data to a JSON file (atomic: write to temp, then rename).
 * @param {string} filename - e.g. 'users.json'
 * @param {Array} data - array to serialize
 */
function writeData(filename, data) {
  const filePath = ensureFile(filename);
  const tmpPath = filePath + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error(`Error writing ${filename}:`, err.message);
    // Clean up temp file if rename failed
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
    throw err;
  }
}

module.exports = { readData, writeData };
