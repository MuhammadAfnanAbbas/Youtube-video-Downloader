from pytube import YouTube

# Replace this with the URL of the YouTube video you want to download
video_url = "https://www.youtube.com/watch?v=gH_GdC0k_GQ"

# Create a YouTube object
yt = YouTube(video_url)

# Filter the stream list to get the highest resolution video (HD)
video_stream = yt.streams.filter(progressive=True, file_extension="mp4").order_by("resolution").desc().first()

# Print video details
print("Video Title:", yt.title)
print("Video Resolution:", video_stream.resolution)
print("Video Filesize:", video_stream.filesize)

# Set the path where you want to save the video
output_path = "/downloads"

# Download the video
video_stream.download(output_path)

print("Download completed.")