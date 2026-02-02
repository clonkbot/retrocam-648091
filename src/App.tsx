import { useState, useRef, useEffect, useCallback } from 'react';

type FilterMode = 'Natural' | '70s Film' | 'Sepia' | 'Polaroid';

interface CameraState {
  status: 'idle' | 'requesting' | 'active' | 'error';
  error?: string;
}

const filterStyles: Record<FilterMode, string> = {
  'Natural': 'none',
  '70s Film': 'contrast(1.1) saturate(1.3) sepia(0.2) brightness(1.05)',
  'Sepia': 'sepia(0.8) contrast(1.1) brightness(1.05)',
  'Polaroid': 'contrast(1.2) saturate(0.9) brightness(1.1) sepia(0.1)',
};

function App() {
  const [cameraState, setCameraState] = useState<CameraState>({ status: 'idle' });
  const [selectedMode, setSelectedMode] = useState<FilterMode>('70s Film');
  const [filmCount, setFilmCount] = useState(24);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraState({ status: 'requesting' });

    // Stop any existing stream first
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('Video element not found'));
            return;
          }

          const video = videoRef.current;

          const onLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            video.play()
              .then(() => resolve())
              .catch(reject);
          };

          const onError = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            reject(new Error('Video failed to load'));
          };

          video.addEventListener('loadedmetadata', onLoadedMetadata);
          video.addEventListener('error', onError);

          // Timeout after 5 seconds
          setTimeout(() => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            reject(new Error('Camera initialization timed out'));
          }, 5000);
        });

        setCameraState({ status: 'active' });
      }
    } catch (err) {
      console.error('Camera error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        setCameraState({ status: 'error', error: 'Camera access denied. Please allow camera permissions and try again.' });
      } else if (errorMessage.includes('NotFoundError') || errorMessage.includes('DevicesNotFoundError')) {
        setCameraState({ status: 'error', error: 'No camera found on this device.' });
      } else {
        setCameraState({ status: 'error', error: `Camera error: ${errorMessage}` });
      }
    }
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || filmCount <= 0) return;

    setIsCapturing(true);
    setShowFlash(true);

    setTimeout(() => setShowFlash(false), 150);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.filter = filterStyles[selectedMode];
    ctx.drawImage(video, 0, 0);

    // Add film grain effect
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 20;
      data[i] += noise;
      data[i + 1] += noise;
      data[i + 2] += noise;
    }
    ctx.putImageData(imageData, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    setFilmCount(prev => prev - 1);

    setTimeout(() => setIsCapturing(false), 300);
  }, [filmCount, selectedMode]);

  const downloadPhoto = useCallback(() => {
    if (!capturedImage) return;

    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = `retrocam-${Date.now()}.jpg`;
    link.click();
  }, [capturedImage]);

  const modes: FilterMode[] = ['Natural', '70s Film', 'Sepia', 'Polaroid'];

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4 font-['Courier_Prime']">
      {/* Flash effect */}
      {showFlash && (
        <div className="fixed inset-0 bg-white z-50 pointer-events-none animate-flash" />
      )}

      {/* Camera Body */}
      <div className="relative w-full max-w-[380px]">
        <div
          className="rounded-[32px] p-5 shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, #F5F0E8 0%, #E8E0D4 100%)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.8), inset 0 -2px 0 rgba(0,0,0,0.1)'
          }}
        >
          {/* Top Section */}
          <div className="flex items-center justify-between mb-4 px-2">
            <h1
              className="text-[#3D3D3D] text-lg tracking-[0.3em] font-bold"
              style={{ fontFamily: "'Courier Prime', monospace" }}
            >
              RETROCAM
            </h1>

            {/* Film Counter */}
            <div
              className="bg-[#1a1a1a] rounded-lg px-3 py-1.5 flex items-center gap-2"
              style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}
            >
              <span className="text-[#8B8B8B] text-[10px] tracking-wider">FILM</span>
              <span
                className="text-[#FF6B35] text-xl font-bold tabular-nums"
                style={{
                  fontFamily: "'VT323', monospace",
                  textShadow: '0 0 10px rgba(255, 107, 53, 0.5)'
                }}
              >
                {filmCount.toString().padStart(2, '0')}
              </span>
            </div>

            {/* Speaker Grill */}
            <div className="flex gap-[3px]">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-1.5 h-4 rounded-full bg-[#3D3D3D] opacity-40" />
              ))}
            </div>
          </div>

          {/* Viewfinder */}
          <div
            className="relative rounded-2xl overflow-hidden mb-4"
            style={{
              background: 'linear-gradient(135deg, #C9A227 0%, #8B7315 100%)',
              padding: '4px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)'
            }}
          >
            <div className="relative bg-[#1E1E1E] rounded-xl overflow-hidden aspect-[4/3]">
              {/* Camera States */}
              {cameraState.status === 'idle' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[#666]">
                  <div className="w-16 h-16 border-2 border-[#444] rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <button
                    onClick={startCamera}
                    className="px-6 py-2 bg-[#8B2635] text-white rounded-full text-sm tracking-wider hover:bg-[#A03040] transition-colors"
                    style={{ fontFamily: "'Courier Prime', monospace" }}
                  >
                    START CAMERA
                  </button>
                </div>
              )}

              {cameraState.status === 'requesting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[#666]">
                  <div className="w-12 h-12 border-2 border-[#8B2635] border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm">Requesting camera access...</p>
                </div>
              )}

              {cameraState.status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[#666] p-6 text-center">
                  <div className="w-16 h-16 border-2 border-[#8B2635] rounded-full flex items-center justify-center mb-4">
                    <span className="text-[#8B2635] text-2xl">!</span>
                  </div>
                  <p className="text-sm mb-4">{cameraState.error}</p>
                  <button
                    onClick={startCamera}
                    className="px-6 py-2 bg-[#8B2635] text-white rounded-full text-sm tracking-wider hover:bg-[#A03040] transition-colors"
                    style={{ fontFamily: "'Courier Prime', monospace" }}
                  >
                    TRY AGAIN
                  </button>
                </div>
              )}

              {/* Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraState.status !== 'active' ? 'hidden' : ''}`}
                style={{ filter: filterStyles[selectedMode] }}
              />

              {/* Viewfinder Overlay */}
              {cameraState.status === 'active' && (
                <>
                  {/* Corner Brackets */}
                  <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-[#666] opacity-60" />
                  <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-[#666] opacity-60" />
                  <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-[#666] opacity-60" />
                  <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-[#666] opacity-60" />

                  {/* Center Focus Point */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-[#666] rounded-full opacity-40 flex items-center justify-center">
                    <div className="w-1 h-1 bg-[#666] rounded-full" />
                  </div>

                  {/* Recording Indicator */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#4ADE80] rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-[#4ADE80] rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mode Selector */}
          <div className="mb-6">
            <p
              className="text-center text-[#666] text-[10px] tracking-[0.3em] mb-3"
              style={{ fontFamily: "'Courier Prime', monospace" }}
            >
              MODE
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              {modes.map(mode => (
                <button
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  className={`px-4 py-2 rounded-full text-xs tracking-wider transition-all ${
                    selectedMode === mode
                      ? 'bg-[#8B2635] text-white shadow-lg'
                      : 'bg-[#E8E0D4] text-[#5D5D5D] hover:bg-[#DDD5C8]'
                  }`}
                  style={{
                    fontFamily: "'Courier Prime', monospace",
                    boxShadow: selectedMode === mode ? '0 4px 15px rgba(139, 38, 53, 0.4)' : 'none'
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Controls */}
          <div
            className="rounded-2xl py-4 px-6 flex items-center justify-between"
            style={{
              background: 'linear-gradient(180deg, #E8E0D4 0%, #DDD5C8 100%)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            {/* Gallery Button */}
            <button
              onClick={() => capturedImage && downloadPhoto()}
              className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                capturedImage
                  ? 'bg-[#3D3D3D] hover:bg-[#4D4D4D]'
                  : 'bg-[#CCCCC4] cursor-not-allowed'
              }`}
              disabled={!capturedImage}
            >
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Last capture"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <svg className="w-5 h-5 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </button>

            {/* Capture Button */}
            <button
              onClick={capturePhoto}
              disabled={cameraState.status !== 'active' || filmCount <= 0}
              className={`relative w-16 h-16 rounded-full transition-transform ${
                cameraState.status === 'active' && filmCount > 0
                  ? 'hover:scale-105 active:scale-95'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              style={{
                background: 'linear-gradient(180deg, #C9C9C4 0%, #A8A8A0 100%)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.2), inset 0 2px 0 rgba(255,255,255,0.5)'
              }}
            >
              <div
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full transition-all ${
                  isCapturing ? 'scale-90' : ''
                }`}
                style={{
                  background: 'linear-gradient(180deg, #8B2635 0%, #6B1825 100%)',
                  boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.3), 0 2px 8px rgba(139, 38, 53, 0.4)'
                }}
              />
            </button>

            {/* Switch Camera Button */}
            <button
              onClick={startCamera}
              className="w-12 h-12 rounded-lg bg-[#CCCCC4] flex items-center justify-center hover:bg-[#BBBBB4] transition-colors"
            >
              <svg className="w-5 h-5 text-[#5D5D5D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Footer */}
        <p
          className="text-center mt-6 text-[#555] text-xs tracking-wider"
          style={{ fontFamily: "'Courier Prime', monospace" }}
        >
          Requested by <span className="text-[#888]">@aiob_me</span> · Built by <span className="text-[#888]">@clonkbot</span>
        </p>
      </div>

      {/* Hidden Canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      <style>{`
        @keyframes flash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        .animate-flash {
          animation: flash 0.15s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default App;
