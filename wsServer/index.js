const http = require('http');
const server = require('websocket').server;

const httpServer = http.createServer(() => { });
httpServer.listen(1337, () => {
  console.log('Server listening at port 1337');
});

const express = require('express')
const app = express()
app.use(express.static('../client'));
const port = 1400

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

const wsServer = new server({
  httpServer,
});

let clients = [];

wsServer.on('request', request => {
  const connection = request.accept();
  const id = (Math.random() * 10000);
  clients.push({ connection, id });

  connection.on('message', message => {
    console.log(message);
    clients
      .filter(client => client.id !== id)
      .forEach(client => client.connection.send(message.utf8Data));
  });

  connection.on('close', () => {
    clients = clients.filter(client => client.id !== id);
  });
});