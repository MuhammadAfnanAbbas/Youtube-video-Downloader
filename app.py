from flask import Flask, render_template, request, send_from_directory, flash
from pytube import YouTube
import os
import re

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'
DOWNLOAD_FOLDER = "downloads"
app.config["DOWNLOAD_FOLDER"] = DOWNLOAD_FOLDER

def get_video_stream(yt):
    return yt.streams.filter(progressive=True, file_extension="mp4").order_by("resolution").desc().first()

def create_safe_filename(title):
    safe_title = re.sub(r'[^a-zA-Z0-9]', '_', title)  # Replace non-alphanumeric characters with underscores
    return f"{safe_title}.mp4"

@app.route('/', methods=['GET', 'POST'])
def index():
    filename = None

    if request.method == 'POST':
        video_url = request.form['video_url']

        try:
            yt = YouTube(video_url)
            video_stream = get_video_stream(yt)

            if video_stream:
                title = yt.title
                safe_filename = create_safe_filename(title)
                file_path = os.path.join(app.config["DOWNLOAD_FOLDER"], safe_filename)
                os.makedirs(app.config["DOWNLOAD_FOLDER"], exist_ok=True)

                video_stream.download(output_path=app.config["DOWNLOAD_FOLDER"], filename=safe_filename)
                flash("Download completed.", "success")

                filename = safe_filename

        except Exception as e:
            flash(f"Error: {str(e)}", "error")

    return render_template('index.html', filename=filename)

@app.route('/download/<filename>')
def download_file(filename):
    file_path = os.path.join(app.config["DOWNLOAD_FOLDER"], filename)
    return send_from_directory(app.config["DOWNLOAD_FOLDER"], filename, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)