module.exports = {
  apps: [{
    name: 'htw',
    script: 'server/server.cjs',
    watch: ['.env'],
    watch_delay: 2000,
    ignore_watch: ['node_modules', 'dist', 'logs'],
    max_restarts: 30,
    restart_delay: 5000
  }]
};