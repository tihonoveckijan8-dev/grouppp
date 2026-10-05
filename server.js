import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Serve static files from root
app.use(express.static(__dirname, {
  etag: false,
  maxAge: 0,
  index: 'index.html'
}));

// Route fallback for client-side routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`BandPlan running on http://${HOST}:${PORT}`);
});
