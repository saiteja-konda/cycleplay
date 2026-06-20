const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5100;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const rideRoutes = require('./routes/rides');
app.use('/api/rides', rideRoutes);

// Serve frontend static files
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Fallback to index.html for SPA routing/PWA
app.use((req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`CyclePlay backend listening at http://localhost:${PORT}`);
});
