# YouTube Video Downloader

This project is a simple yet powerful YouTube video downloader that allows users to fetch and download YouTube videos in various formats and qualities. Currently, it supports downloading in 3G format with audio and video, and more options are coming soon, including support for MP3, MP4 in multiple qualities (1080p, 720p, etc.).

## Features

* Fetch and download YouTube videos with **audio and video** (currently supports 3G format).
* **Real-time progress tracking** for downloads with **Server-Sent Events (SSE)**.
* **Animated background** and modern design.
* **Format and quality selection** from a wide range of options.
* **Enhanced loading spinner** for better user experience.

## Upcoming Features

* **More formats**: MP3, MP4, WEBM, and more.
* **Multiple qualities**: 1080p, 720p, 480p, etc.

## Requirements

* Node.js (version 14 or higher)
* Express.js
* ytdl-core (YouTube video download library)
* CORS (Cross-Origin Resource Sharing)

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/MuhammadAfnanAbbas/Youtube-video-Downloader.git
   ```

2. Navigate to the project directory:

   ```bash
   cd youtube-video-downloader
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Run the application:

   ```bash
   npm start
   ```

5. Open the app in your browser:

   ```bash
   http://localhost:3000
   ```

## Usage

1. Enter the YouTube URL of the video you want to download.
2. Click on "Fetch Formats" to fetch the available download formats.
3. Select your preferred format from the dropdown.
4. Click "Start Download" to begin downloading the video. You'll be able to track the download progress in real-time.

## Features in Development

* **Support for additional video qualities**: We will soon add support for video qualities such as **1080p, 720p**, and more.
* **MP3 and audio-only formats**: We plan to add the ability to download just the audio of a video (MP3).
* **More container formats**: We plan to support other formats like **WEBM** and more.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.