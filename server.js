// // server.js
// const express = require('express');
// const ytdl    = require('ytdl-core');
// const cors    = require('cors');
// const app     = express();

// app.use(cors());
// app.use(express.static('public'));

// app.get('/api/formats', async (req, res) => {
//   const videoURL = req.query.url;
//   if (!ytdl.validateURL(videoURL)) {
//     return res.status(400).json({ error: 'Invalid YouTube URL' });
//   }

//   try {
//     // 1) Fetch info with a browser-like User-Agent
//     const info = await ytdl.getBasicInfo(videoURL, {
//       requestOptions: {
//         headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
//       }
//     });

//     // 2) Fallback to whatever formats YouTube gave us
//     const rawFormats =
//       (info.formats && info.formats.length && info.formats) ||
//       (info.player_response?.streamingData?.formats ?? []);

//     // 3) Debug dump to your server console
//     console.warn('🔥 allFormats:', rawFormats.map(f => ({
//       itag:         f.itag,
//       qualityLabel: f.qualityLabel,
//       audioQuality: f.audioQuality,
//       hasAudio:     !!f.audioQuality || !!f.audioBitrate,
//       hasVideo:     !!f.qualityLabel,
//       container:    f.container,
//       size:         f.contentLength
//                      ? `${(Number(f.contentLength)/(1024*1024)).toFixed(2)} MB`
//                      : 'N/A'
//     })));

//     // 4) Looser filter: keep anything with audio or video + a size
//     const formats = rawFormats
//       .filter(f => f.contentLength && (f.qualityLabel || f.audioQuality))
//       .map(f => ({
//         itag:      f.itag,
//         label:     f.qualityLabel
//                      ? `${f.qualityLabel}`
//                      : `${f.audioQuality} audio only`,
//         container: f.container,
//         size:      `${(Number(f.contentLength)/(1024*1024)).toFixed(2)} MB`
//       }));

//     // 5) Warn if still empty
//     if (!formats.length) {
//       console.warn('⚠️ No formats found after looser filter', rawFormats);
//       return res.status(500).json({ error: 'No downloadable formats found' });
//     }

//     // 6) Send to client
//     res.json({ title: info.videoDetails.title, formats });
//   } catch (err) {
//     console.error('Error fetching formats:', err);
//     res.status(500).json({ error: err.message });
//   }
// });

// app.get('/api/download', async (req, res) => {
//   const { url, itag } = req.query;
//   if (!ytdl.validateURL(url) || !itag) {
//     return res.status(400).send('Invalid parameters');
//   }

//   try {
//     // Re-fetch info so we can name the file & get the exact format
//     const info = await ytdl.getBasicInfo(url, {
//       requestOptions: {
//         headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
//       }
//     });
//     const fmt = info.formats.find(f => f.itag.toString() === itag);

//     if (!fmt) {
//       throw new Error(`Format with itag=${itag} not found`);
//     }

//     // Set the download filename
//     const ext = fmt.container || 'mp4';
//     const safeTitle = info.videoDetails.title
//       .replace(/[\/\\?%*:|"<>]/g, '-')  // remove illegal filename chars
//       .slice(0, 100);                  // limit length
//     res.header(
//       'Content-Disposition',
//       `attachment; filename="${safeTitle}.${ext}"`
//     );

//     // Stream the download
//     ytdl.downloadFromInfo(info, { quality: itag }).pipe(res);
//   } catch (err) {
//     console.error('Download error:', err);
//     res.status(500).send('Download failed: ' + err.message);
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
// server.js
const express = require('express');
const ytdl    = require('ytdl-core');
const cors    = require('cors');
const app     = express();

app.use(cors());
app.use(express.static('public'));

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
        cookie: 'CONSENT=YES+1'
      }
    });

    const rawFormats =
      (info.formats && info.formats.length && info.formats) ||
      (info.player_response?.streamingData?.formats ?? []);

    console.warn('🔥 allFormats:', rawFormats.map(f => ({
      itag:         f.itag,
      qualityLabel: f.qualityLabel,
      audioQuality: f.audioQuality,
      hasAudio:     !!f.audioQuality || !!f.audioBitrate,
      hasVideo:     !!f.qualityLabel,
      container:    f.container,
      size:         f.contentLength
                     ? `${(Number(f.contentLength)/(1024*1024)).toFixed(2)} MB`
                     : 'N/A'
    })));

    const formats = rawFormats
      .filter(f => f.contentLength && (f.qualityLabel || f.audioQuality))
      .map(f => ({
        itag:      f.itag,
        label:     f.qualityLabel ? `${f.qualityLabel}` : `${f.audioQuality} audio only`,
        container: f.container,
        size:      `${(Number(f.contentLength)/(1024*1024)).toFixed(2)} MB`
      }));

    if (!formats.length) {
      console.warn('⚠️ No formats found after looser filter', rawFormats);
      return res.status(500).json({ error: 'No downloadable formats found' });
    }

    res.json({ title: info.videoDetails.title, formats });
  } catch (err) {
    console.error('Error fetching formats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Download selected format
app.get('/api/download', async (req, res) => {
  try {
    const videoUrl = decodeURIComponent(req.query.url);
    const itag      = parseInt(req.query.itag, 10);

    if (!ytdl.validateURL(videoUrl) || isNaN(itag)) {
      return res.status(400).send('Invalid parameters');
    }

    // Fetch full info for metadata & title
    const info = await ytdl.getInfo(videoUrl, {
      requestOptions: {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        cookie: 'CONSENT=YES+1'
      }
    });

    // Find the exact format
    const fmt = info.formats.find(f => f.itag === itag);
    if (!fmt) {
      return res.status(404).send(`Format itag=${itag} not found`);
    }

    // Prepare a safe filename
    const ext = fmt.container || 'mp4';
    const safeTitle = info.videoDetails.title
      .replace(/[\\/:*?"<>|]/g, '-')
      .slice(0, 100);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle}.${ext}"`
    );

    // Stream the chosen format directly
    ytdl(videoUrl, { format: fmt }).
      on('error', err => {
        console.error('Stream error:', err);
        // If headers not yet sent
        if (!res.headersSent) res.status(500).send('Stream error');
      })
      .pipe(res);

  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('Download failed: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
