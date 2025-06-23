const express = require('express');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('db.json');
const db = low(adapter);

// Initialize database with enhanced structure
db.defaults({ users: [] }).write();
if (db.get('users').value().length === 0) {
  db.get('users').push({
    userId: 'default',
    timeData: {}
  }).write();
}

const app = express();
app.use(cors({
  origin: ['http://localhost', 'http://frontend'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

const PORT = 3001;



// Real-time update endpoint
app.post('/api/realtime-update', (req, res) => {
  const { domain, seconds, productive } = req.body;
  const today = new Date().toISOString().split('T')[0];
  
  let user = db.get('users').find({ userId: 'default' }).value();
  
  if (!user.timeData[today]) {
    user.timeData[today] = {
      productive: 0,
      unproductive: 0,
      neutral: 0,
      domains: {}
    };
  }

  const category = productive === true ? 'productive' : 
                  productive === false ? 'unproductive' : 'neutral';
  
  user.timeData[today][category] += seconds;
  
  if (!user.timeData[today].domains[domain]) {
    user.timeData[today].domains[domain] = { 
      time: 0, 
      productive: productive 
    };
  }
  
  user.timeData[today].domains[domain].time += seconds;
  
  db.get('users')
    .find({ userId: 'default' })
    .assign({ timeData: user.timeData })
    .write();

  res.json({ success: true });
});

// Data endpoints
app.get('/api/time-data', (req, res) => {
  const user = db.get('users').find({ userId: 'default' }).value();
  res.json(user?.timeData || {});
});

app.get('/api/weekly-report', (req, res) => {
  const user = db.get('users').find({ userId: 'default' }).value();
  const dates = Object.keys(user?.timeData || {}).sort().slice(-7);
  
  const report = dates.map(date => ({
    date,
    productive: user.timeData[date]?.productive || 0,
    unproductive: user.timeData[date]?.unproductive || 0,
    neutral: user.timeData[date]?.neutral || 0
  }));

  res.json(report);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});