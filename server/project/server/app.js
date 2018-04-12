const Happy = require('../../play-node');
const path = require('path')

const config = {
  SERVER_ROOT: __dirname,
  STATIC_PATH: path.resolve(__dirname, '../client'),
  KEYS: ['your-key', 'your-secret'],
  CDN_PATH: '//',
  AUTO_MIDDLEWARE: true
};

let happy = new Happy(config);

