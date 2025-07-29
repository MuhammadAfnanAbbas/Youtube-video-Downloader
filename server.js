
// server.js
const express = require('express');
const ytdl = require('ytdl-core');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static('public'));

// Store download progress for each session
const downloadProgress = new Map();

// Fetch available formats
app.get('/api/formats', async (req, res) => {
  const videoURL = req.query.url;
  if (!ytdl.validateURL(videoURL)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const info = await ytdl.getBasicInfo(videoURL, {
      requestOptions: {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        cookie: 'CONSENT=YES+1',
      },
    });

    const rawFormats =
      (info.formats && info.formats.length && info.formats) ||
      (info.player_response?.streamingData?.formats ?? []);

    const formats = rawFormats
      .filter(f => f.contentLength && (f.qualityLabel || f.audioQuality))
      .map(f => ({
        itag: f.itag,
        label: f.qualityLabel ? `${f.qualityLabel}` : `${f.audioQuality} audio only`,
        container: f.container,
        size: `${(Number(f.contentLength) / (1024 * 1024)).toFixed(2)} MB`,
      }));

    if (!formats.length) {
      return res.status(500).json({ error: 'No downloadable formats found' });
    }

    res.json({ title: info.videoDetails.title, formats });
  } catch (err) {
    console.error('Error fetching formats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Progress tracking endpoint (Server-Sent Events)
app.get('/api/progress/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  
  console.log(`SSE connection established for session: ${sessionId}`);
  
  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Send initial connection message
  res.write('data: {"progress": 0, "status": "connected"}\n\n');
  
  // Store the response object for this session
  downloadProgress.set(sessionId, { 
    progress: 0, 
    response: res,
    startTime: Date.now()
  });
  
  // Clean up when client disconnects
  req.on('close', () => {
    console.log(`SSE connection closed for session: ${sessionId}`);
    downloadProgress.delete(sessionId);
  });
  
  req.on('error', (err) => {
    console.error(`SSE error for session ${sessionId}:`, err);
    downloadProgress.delete(sessionId);
  });
});

// Download selected format with progress tracking
app.get('/api/download', async (req, res) => {
  const sessionId = req.query.sessionId || Date.now().toString();
  console.log(`Download request received for session: ${sessionId}`);
  
  try {
    const videoUrl = decodeURIComponent(req.query.url);
    const itag = parseInt(req.query.itag, 10);

    console.log(`Download params: url=${videoUrl.substring(0, 50)}..., itag=${itag}`);

    if (!ytdl.validateURL(videoUrl) || isNaN(itag)) {
      console.log('Invalid parameters provided');
      // Send error via SSE if possible
      if (sessionId && downloadProgress.has(sessionId)) {
        const sessionData = downloadProgress.get(sessionId);
        if (sessionData && sessionData.response && !sessionData.response.destroyed) {
          try {
            sessionData.response.write(`data: {"progress": 0, "status": "error", "message": "Invalid parameters"}\n\n`);
          } catch (err) {
            console.error('Error sending error message:', err);
          }
        }
      }
      return res.status(400).send('Invalid parameters');
    }

    // Send initial status via SSE
    if (downloadProgress.has(sessionId)) {
      const sessionData = downloadProgress.get(sessionId);
      if (sessionData && sessionData.response && !sessionData.response.destroyed) {
        try {
          sessionData.response.write(`data: {"progress": 0, "status": "preparing"}\n\n`);
          console.log('Sent preparing status via SSE');
        } catch (err) {
          console.error('Error sending status update:', err);
        }
      }
    } else {
      console.log(`No SSE connection found for session: ${sessionId}`);
    }

    console.log('Fetching video info...');
    // Fetch full info for metadata & title
    const info = await ytdl.getInfo(videoUrl, {
      requestOptions: {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        cookie: 'CONSENT=YES+1',
      },
    });

    // Find the exact format
    const fmt = info.formats.find(f => f.itag === itag);
    if (!fmt) {
      console.log(`Format with itag ${itag} not found`);
      // Send error via SSE
      if (downloadProgress.has(sessionId)) {
        const sessionData = downloadProgress.get(sessionId);
        if (sessionData && sessionData.response && !sessionData.response.destroyed) {
          try {
            sessionData.response.write(`data: {"progress": 0, "status": "error", "message": "Format not found"}\n\n`);
          } catch (err) {
            console.error('Error sending error message:', err);
          }
        }
      }
      return res.status(404).send(`Format itag=${itag} not found`);
    }

    console.log(`Found format: ${fmt.qualityLabel || fmt.audioQuality}, size: ${fmt.contentLength} bytes`);

    // Prepare a safe filename
    const ext = fmt.container || 'mp4';
    const safeTitle = info.videoDetails.title
      .replace(/[\\/:*?"<>|]/g, '-')
      .slice(0, 100);

    console.log(`Starting download: ${safeTitle}.${ext}`);

    // Set headers for file download
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle}.${ext}"`
    );
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', fmt.contentLength || '0');
    
    // Initialize variables for progress tracking
    let downloaded = 0;
    const total = fmt.contentLength ? parseInt(fmt.contentLength, 10) : 0;

    console.log(`Total size: ${total} bytes`);

    // Send download started status via SSE
    if (downloadProgress.has(sessionId)) {
      const sessionData = downloadProgress.get(sessionId);
      if (sessionData && sessionData.response && !sessionData.response.destroyed) {
        try {
          sessionData.response.write(`data: {"progress": 0, "status": "downloading", "total": ${total}}\n\n`);
          console.log('Sent downloading status via SSE');
        } catch (err) {
          console.error('Error sending status update:', err);
        }
      }
    }

    // Create the video stream
    console.log('Creating video stream...');
    const videoStream = ytdl(videoUrl, { format: fmt });

    // Track download progress
    videoStream.on('data', (chunk) => {
      downloaded += chunk.length;

      // Send progress update via SSE if session exists
      if (total > 0 && downloadProgress.has(sessionId)) {
        const progress = Math.floor((downloaded / total) * 100);
        const sessionData = downloadProgress.get(sessionId);
        
        if (sessionData && sessionData.response && !sessionData.response.destroyed) {
          try {
            sessionData.response.write(`data: {"progress": ${progress}, "status": "downloading", "downloaded": ${downloaded}, "total": ${total}}\n\n`);
            sessionData.progress = progress;
            
            // Log progress every 10%
            if (progress % 10 === 0 && progress !== sessionData.lastLoggedProgress) {
              console.log(`Download progress: ${progress}% (${downloaded}/${total} bytes)`);
              sessionData.lastLoggedProgress = progress;
            }
          } catch (err) {
            console.error('Error sending progress update:', err);
          }
        }
      }
    });

    // Pipe the video stream to the response
    videoStream.pipe(res);

    // Handle completion
    videoStream.on('end', () => {
      console.log(`Download completed for session: ${sessionId}`);
      // Send completion message via SSE
      if (downloadProgress.has(sessionId)) {
        const sessionData = downloadProgress.get(sessionId);
        if (sessionData && sessionData.response && !sessionData.response.destroyed) {
          try {
            sessionData.response.write(`data: {"progress": 100, "status": "completed"}\n\n`);
            // Don't end the SSE connection immediately, let the frontend handle it
            setTimeout(() => {
              if (sessionData.response && !sessionData.response.destroyed) {
                sessionData.response.end();
              }
            }, 1000);
          } catch (err) {
            console.error('Error sending completion message:', err);
          }
        }
        setTimeout(() => downloadProgress.delete(sessionId), 2000);
      }
    });

    // Handle stream errors
    videoStream.on('error', (err) => {
      console.error('Stream error:', err);
      
      // Send error message via SSE
      if (downloadProgress.has(sessionId)) {
        const sessionData = downloadProgress.get(sessionId);
        if (sessionData && sessionData.response && !sessionData.response.destroyed) {
          try {
            sessionData.response.write(`data: {"progress": 0, "status": "error", "message": "${err.message}"}\n\n`);
            sessionData.response.end();
          } catch (sseErr) {
            console.error('Error sending error message:', sseErr);
          }
        }
        downloadProgress.delete(sessionId);
      }
      
      if (!res.headersSent) {
        res.status(500).send('Stream error: ' + err.message);
      }
    });

  } catch (err) {
    console.error('Download error:', err);
    
    // Send error via SSE if possible
    if (sessionId && downloadProgress.has(sessionId)) {
      const sessionData = downloadProgress.get(sessionId);
      if (sessionData && sessionData.response && !sessionData.response.destroyed) {
        try {
          sessionData.response.write(`data: {"progress": 0, "status": "error", "message": "${err.message}"}\n\n`);
          sessionData.response.end();
        } catch (sseErr) {
          console.error('Error sending error message:', sseErr);
        }
      }
      downloadProgress.delete(sessionId);
    }
    
    if (!res.headersSent) {
      res.status(500).send('Download failed: ' + err.message);
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
