'use client';

import { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export default function VideoConverter() {
  const [loaded, setLoaded] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [outputFormat, setOutputFormat] = useState<'gif' | 'webp'>('gif');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  
  const ffmpegRef = useRef(new FFmpeg());
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadFFmpeg();
  }, []);

  const loadFFmpeg = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    const ffmpeg = ffmpegRef.current;
    
    ffmpeg.on('log', ({ message }) => {
      console.log(message);
    });
    
    ffmpeg.on('progress', ({ progress: p }) => {
      setProgress(Math.round(p * 100));
    });

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      setLoaded(true);
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setOutputUrl('');
      setProgress(0);
    }
  };

  const handleVideoLoad = () => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      setVideoDuration(duration);
      setStartTime(0);
      setEndTime(duration);
    }
  };

  const convertVideo = async () => {
    if (!videoFile || !loaded) return;

    setConverting(true);
    setProgress(0);
    setOutputUrl('');

    const ffmpeg = ffmpegRef.current;

    try {
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

      const duration = endTime - startTime;
      const qualitySettings = {
        low: { fps: 10, scale: 320, quality: 60 },
        medium: { fps: 15, scale: 480, quality: 75 },
        high: { fps: 24, scale: 720, quality: 90 },
      };

      const settings = qualitySettings[quality];

      if (outputFormat === 'gif') {
        await ffmpeg.exec([
          '-ss', startTime.toString(),
          '-t', duration.toString(),
          '-i', 'input.mp4',
          '-vf', `fps=${settings.fps},scale=${settings.scale}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
          '-loop', '0',
          'output.gif'
        ]);
      } else {
        await ffmpeg.exec([
          '-ss', startTime.toString(),
          '-t', duration.toString(),
          '-i', 'input.mp4',
          '-vf', `fps=${settings.fps},scale=${settings.scale}:-1`,
          '-c:v', 'libwebp',
          '-quality', settings.quality.toString(),
          '-loop', '0',
          'output.webp'
        ]);
      }

      const data = await ffmpeg.readFile(outputFormat === 'gif' ? 'output.gif' : 'output.webp') as Uint8Array;
      const blob = new Blob([new Uint8Array(data)], { type: outputFormat === 'gif' ? 'image/gif' : 'image/webp' });
      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
    } catch (error) {
      console.error('Conversion failed:', error);
      alert('Ошибка конвертации. Попробуйте другое видео.');
    } finally {
      setConverting(false);
    }
  };

  const downloadOutput = () => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `converted.${outputFormat}`;
    a.click();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-2">
          🎬 Видео → GIF/WebP
        </h1>
        <p className="text-center text-purple-200 mb-8">
          Конвертируй видео прямо в браузере
        </p>

        {!loaded && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
            <p className="mt-4 text-purple-200">Загрузка FFmpeg...</p>
          </div>
        )}

        {loaded && (
          <div className="space-y-6">
            {/* Upload */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <label className="block">
                <div className="border-2 border-dashed border-purple-400 rounded-xl p-8 text-center cursor-pointer hover:border-purple-300 transition">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="text-5xl mb-3">📹</div>
                  <p className="text-lg font-medium">
                    {videoFile ? videoFile.name : 'Выбери видео'}
                  </p>
                  <p className="text-sm text-purple-200 mt-2">
                    MP4, MOV, AVI и другие форматы
                  </p>
                </div>
              </label>
            </div>

            {/* Video Preview & Timeline */}
            {videoUrl && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onLoadedMetadata={handleVideoLoad}
                  controls
                  className="w-full rounded-lg mb-4"
                />
                
                {videoDuration > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Выбери фрагмент</h3>
                    
                    <div>
                      <label className="block text-sm mb-2">
                        Начало: {formatTime(startTime)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max={videoDuration}
                        step="0.1"
                        value={startTime}
                        onChange={(e) => setStartTime(Math.min(parseFloat(e.target.value), endTime - 0.1))}
                        className="w-full h-2 bg-purple-500/30 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-2">
                        Конец: {formatTime(endTime)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max={videoDuration}
                        step="0.1"
                        value={endTime}
                        onChange={(e) => setEndTime(Math.max(parseFloat(e.target.value), startTime + 0.1))}
                        className="w-full h-2 bg-purple-500/30 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                    
                    <p className="text-sm text-purple-200">
                      Длительность: {formatTime(endTime - startTime)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Settings */}
            {videoFile && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Формат</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setOutputFormat('gif')}
                      className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                        outputFormat === 'gif'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      GIF
                    </button>
                    <button
                      onClick={() => setOutputFormat('webp')}
                      className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                        outputFormat === 'webp'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      WebP
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Качество</label>
                  <div className="flex gap-3">
                    {(['low', 'medium', 'high'] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => setQuality(q)}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                          quality === q
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        {q === 'low' ? 'Низкое' : q === 'medium' ? 'Среднее' : 'Высокое'}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={convertVideo}
                  disabled={converting || !loaded}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-xl transition text-lg"
                >
                  {converting ? `Конвертация... ${progress}%` : '✨ Конвертировать'}
                </button>
              </div>
            )}

            {/* Output */}
            {outputUrl && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="font-semibold text-lg mb-4">Готово! 🎉</h3>
                <img src={outputUrl} alt="Converted" className="w-full rounded-lg mb-4" />
                <button
                  onClick={downloadOutput}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition"
                >
                  ⬇️ Скачать {outputFormat.toUpperCase()}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}





