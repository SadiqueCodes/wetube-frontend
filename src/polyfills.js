import process from 'process';

if (typeof window !== 'undefined') {
  window.process = process;
  window.global = window;
}

window.process = {
  env: {
    NODE_ENV: process.env.NODE_ENV || 'development'
  },
  nextTick: function(callback) {
    setTimeout(callback, 0);
  }
}; 