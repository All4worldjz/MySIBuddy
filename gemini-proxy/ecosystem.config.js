module.exports = {
  apps: [{
    name: 'gemini-proxy',
    script: 'src/index.js',
    cwd: '/opt/gemini-proxy',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production',
      PORT: 8787
    }
  }]
};