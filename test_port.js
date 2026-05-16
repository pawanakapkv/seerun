const http = require('http');
const server = http.createServer((req, res) => {
  res.end('Hello');
});
server.listen(8085, '0.0.0.0', () => {
  console.log('Server running at http://0.0.0.0:8085/');
});
