const express = require('express');
const startBot = require('./main');

const app = express();
const PORT = process.env.PORT || 3000;

// Web status check route
app.get('/', (req, res) => {
  res.send('🤖 Yukira bot is running!');
});

// Start express server
app.listen(PORT, () => {
  console.log(`🌐 Express server listening on port ${PORT}`);

  // Start the bot after server is ready
  startBot();
});