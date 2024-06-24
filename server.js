const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 8080;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let participantNames = [];
let surveyResponses = [];

wss.on('connection', ws => {
  ws.on('message', message => {
    console.log('received: %s', message);
  });

  ws.send(JSON.stringify({ type: 'init', participantNames, surveyResponses }));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// Info endpoint
app.get('/api/info', (req, res) => {
  res.status(200).json({ name: 'Manito Game', version: '1.0.0' });
});

// Config endpoint to provide environment variables to the client
const serverUrls = process.env.SERVER_URLS ? process.env.SERVER_URLS.split(',') : ['http://localhost:8080'];

app.get('/config', (req, res) => {
    res.json({ serverUrls });
});

app.post('/startGame', (req, res) => {
  participantNames = req.body.participants;
  surveyResponses = [];
  console.log('Started new game with participants:', participantNames);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'start', participantNames }));
    }
  });
  res.sendStatus(200);
});

app.get('/getParticipants', (req, res) => {
  res.json(participantNames);
});

app.post('/submitSurvey', (req, res) => {
  const { name, manitee, predictedManito, satisfaction, overallPrediction } = req.body;
  const existingResponse = surveyResponses.find(response => response.name === name);

  if (existingResponse) {
    res.json({ status: 'duplicate' });
    return;
  }

  surveyResponses.push(req.body);
  console.log('Received survey response:', req.body);

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'submit', name }));
    }
  });

  if (surveyResponses.length === participantNames.length) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'completed' }));
      }
    });
    res.json({ status: 'completed' });  // 모든 참여자가 설문을 완료한 경우
  } else {
    res.json({ status: 'pending' });  // 설문이 제출되었지만 모든 참여자가 완료하지 않은 경우
  }
});

app.get('/getSurveyResults', (req, res) => {
  res.json(surveyResponses);
});

server.listen(port, () => {
  console.log(`Manito game server running at http://localhost:${port}`);
});
