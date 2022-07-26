const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const port = process.env.PORT || 3001;
const shell = require('shelljs');

app.use(express.static('static'));

// REST API
// /api/shell
app.get('/api/shell', (req, res) => {
  // req.image-points
  // req.map-points
  // file-write req.image-points as image-points.json
  // file-write req
  shell.exec('python ./resources/demo.py', { async: true });
  res.send({ output: 'Waiting...' });
});

const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
