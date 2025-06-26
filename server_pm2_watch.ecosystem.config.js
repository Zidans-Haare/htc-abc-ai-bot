// this is the configuration file for the pm2 process manager
// that starts the node server.cjs file
// it automatically watches for changes in all files in this directory and all subdirecories
// -> needs to ignore the sql database and ai_fragen folder and server.pid file, because those will change a lot
// 		otherweise the server enters a restart loop

// start the server with:
// cd dev.olomek.com ; pm2 kill ; nohup pm2 start server_pm2_watch.ecosystem.config.js ; pm2 list

module.exports = {
  apps: [
    {
      name: 'server', // Name of your application
      script: './server.cjs', // Entry point of your application
      watch: true, // Enable watch mode
      ignore_watch: ['ai_fragen/*', 'chatbot.*', 'server.pid'], // Exclude ai_fragen folder and its contents
	  watch_delay: 3000, // Wait 3 seconds before restarting
    },
  ],
};