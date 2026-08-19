/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Camera, RefreshCw, Upload, Check, VideoOff, Lightbulb, X, ChevronLeft, ChevronRight } from "lucide-react";
import { resizeBase64Image } from "../utils/imageUtils";

interface CameraCaptureProps {
  capturedImages: string[];
  onAddImage: (base64DataUrl: string, rawBase64: string, mimeType: string) => void;
  onRemoveImage: (index: number) => void;
  onClearAll: () => void;
  onActiveChange?: (isActive: boolean) => void;
}

export default function CameraCapture({ capturedImages, onAddImage, onRemoveImage, onClearAll, onActiveChange }: CameraCaptureProps) {
  const [isActive, setIsActive] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    onActiveChange?.(isActive);
  }, [isActive, onActiveChange]);

  // Keep selectedIndex in bounds when images change
  useEffect(() => {
    if (capturedImages.length === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= capturedImages.length) {
      setSelectedIndex(capturedImages.length - 1);
    }
  }, [capturedImages.length, selectedIndex]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showTip, setShowTip] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("appraisal_tip_dismissed") !== "true";
    } catch {
      return true;
    }
  });

  const handleDismissTip = () => {
    setShowTip(false);
    try {
      sessionStorage.setItem("appraisal_tip_dismissed", "true");
    } catch (err) {
      console.error("Failed to save tip preference:", err);
    }
  };
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setPermissionError(null);
    setIsActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setPermissionError(
        "Could not access camera. Please check permissions or use the upload photo option instead."
      );
      setIsActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsActive(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    setIsProcessing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const fullBase64 = canvas.toDataURL("image/jpeg", 0.92);
        
        // Preserve original photo size (up to 1600px max width for clean detail)
        const resized = await resizeBase64Image(fullBase64, 1600);
        const parts = resized.split(",");
        const mimeType = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
        const rawBase64 = parts[1];
        
        onAddImage(resized, rawBase64, mimeType);
      }
    } catch (err) {
      console.error("Error capturing photo:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (event) => {
            try {
              const result = event.target?.result as string;
              if (result) {
                const resized = await resizeBase64Image(result, 1600);
                const parts = resized.split(",");
                const mimeType = parts[0].match(/:(.*?);/)?.[1] || file.type || "image/jpeg";
                const rawBase64 = parts[1];
                onAddImage(resized, rawBase64, mimeType);
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error("File reading failed"));
          reader.readAsDataURL(file);
        });
      }
    } catch (err) {
      console.error("Error loading image files:", err);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset input
      }
    }
  };

  // Use the selected photo or last captured photo as preview
  const activeImageIndex = selectedIndex < capturedImages.length ? selectedIndex : Math.max(0, capturedImages.length - 1);
  const previewImage = capturedImages.length > 0 ? capturedImages[activeImageIndex] : null;

  return (
    <div className="w-full space-y-3">
      {/* Brand Tip Banner */}
      {showTip && (
        <div className="bg-amber-50/70 border border-amber-200/50 rounded-xl p-3 text-[11px] text-amber-800 flex items-start justify-between space-x-2.5 animate-fade-in">
          <div className="flex items-start space-x-2.5">
            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="leading-normal">
              <strong className="font-bold text-amber-900">Appraisal Tip:</strong> Try to include a photo showing the <span className="underline decoration-amber-400 font-semibold text-amber-950">brand name or logo</span>. This helps Gemini recognize the exact model and delivers a much higher confidence appraisal score!
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismissTip}
            className="text-amber-500 hover:text-amber-800 hover:bg-amber-100/60 p-1 rounded-lg transition-colors cursor-pointer shrink-0 -mr-0.5 -mt-0.5"
            title="Dismiss appraisal tip"
            aria-label="Close appraisal tip"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Photo Preview / Capture Frame */}
      <div className={`relative w-full bg-slate-900 rounded-2xl border border-slate-200/80 overflow-hidden shadow-inner flex flex-col items-center justify-center transition-all duration-300 ${
        isActive
          ? "w-full h-[18rem] sm:h-[22rem] md:h-[24rem] max-h-[26rem]"
          : "w-full h-[13rem] sm:h-[15rem] md:h-[17rem] max-h-[18rem]"
      }`}>
        {isActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : previewImage ? (
          <img
            src={previewImage}
            alt={`Item snapshot ${activeImageIndex + 1}`}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain p-1 cursor-pointer"
            onClick={() => setLightboxImage(previewImage)}
            title="Click to view enlarged image"
          />
        ) : (
          <div className="text-center p-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-slate-200/70 flex items-center justify-center text-slate-500 mb-4 shadow-sm">
              <Camera className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium text-slate-700">No Photos Captured</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
              Use your camera or upload files. You can capture multiple angles/logos of the same item!
            </p>
          </div>
        )}

        {/* Left and Right Toggles for cycling through captured photos */}
        {capturedImages.length > 1 && !isActive && (
          <>
            <button
              type="button"
              onClick={() => setSelectedIndex((prev) => (prev > 0 ? prev - 1 : capturedImages.length - 1))}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 bg-slate-900/80 hover:bg-indigo-600 text-white p-2 rounded-full border border-white/20 shadow-lg backdrop-blur-xs transition-all hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
              title="Previous photo"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedIndex((prev) => (prev < capturedImages.length - 1 ? prev + 1 : 0))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 bg-slate-900/80 hover:bg-indigo-600 text-white p-2 rounded-full border border-white/20 shadow-lg backdrop-blur-xs transition-all hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
              title="Next photo"
              aria-label="Next photo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Multi-Photo Count Tag */}
        {capturedImages.length > 0 && !isActive && (
          <span className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-xs text-white border border-white/10 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md z-10 flex items-center space-x-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>
              Photo {activeImageIndex + 1} of {capturedImages.length}
            </span>
          </span>
        )}

        {/* Floating overlays */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-10">
            <div className="bg-white/95 px-4 py-3 rounded-xl shadow-lg flex items-center space-x-3 border border-slate-100">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
              <span className="text-xs font-semibold text-slate-800 tracking-wide">Processing image(s)...</span>
            </div>
          </div>
        )}

        {permissionError && (
          <div className="absolute bottom-4 left-4 right-4 bg-rose-50/95 border border-rose-100 p-3 rounded-xl shadow-md text-xs text-rose-700 font-medium text-center z-10">
            {permissionError}
          </div>
        )}
      </div>

      {/* Captured Photo Queue (Thumbnails with Delete badge) */}
      {capturedImages.length > 0 && (
        <div className="bg-slate-50/50 border border-slate-200/60 p-2 rounded-xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1.5">Photo Queue</p>
          <div className="flex gap-3 overflow-x-auto pt-2 pb-1.5 px-2.5 scrollbar-thin scrollbar-thumb-slate-200">
            {capturedImages.map((img, idx) => (
              <div key={idx} className="relative w-16 h-12 shrink-0 mr-1.5 last:mr-0">
                <div 
                  onClick={() => setSelectedIndex(idx)}
                  className={`w-full h-full rounded-lg border overflow-hidden bg-white shadow-xs cursor-pointer hover:scale-105 transition-all group ${
                    idx === activeImageIndex ? "border-indigo-600 ring-2 ring-indigo-500/40" : "border-slate-200 hover:border-indigo-400"
                  }`}
                  title={`Select Photo ${idx + 1}`}
                >
                  <img 
                    src={img} 
                    alt={`Capture ${idx + 1}`} 
                    className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveImage(idx);
                  }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md hover:scale-110 transition-all cursor-pointer flex items-center justify-center z-10"
                  title="Remove this photo"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-2">
        {isActive ? (
          <>
            <button
              type="button"
              id="btn-capture-photo"
              onClick={capturePhoto}
              disabled={isProcessing}
              className="flex-1 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center space-x-2"
            >
              <Camera className="w-4 h-4" />
              <span>Snap Photo ({capturedImages.length})</span>
            </button>
            <button
              type="button"
              id="btn-stop-camera"
              onClick={stopCamera}
              className="px-4 min-h-[44px] bg-slate-800 hover:bg-slate-900 text-white font-medium text-sm rounded-xl transition-all flex items-center justify-center space-x-2"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Done</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              id="btn-start-camera"
              onClick={startCamera}
              disabled={isProcessing}
              className="flex-1 min-h-[44px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-semibold text-sm rounded-xl transition-all flex items-center justify-center space-x-2 active:scale-98"
            >
              <Camera className="w-4.5 h-4.5" />
              <span>{capturedImages.length > 0 ? "Capture More" : "Start Camera"}</span>
            </button>
            <button
              type="button"
              id="btn-upload-file"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex-1 min-h-[44px] bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-medium text-sm rounded-xl transition-all flex items-center justify-center space-x-2 active:scale-98"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Photos</span>
            </button>
            {capturedImages.length > 0 && (
              <button
                type="button"
                id="btn-clear-photo"
                onClick={onClearAll}
                className="px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-medium text-sm rounded-xl transition-all flex items-center justify-center"
              >
                Clear All
              </button>
            )}
          </>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Lightbox Modal for Full View */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center z-[9999] p-4 transition-all"
          onClick={() => setLightboxImage(null)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all cursor-pointer hover:scale-105"
            aria-label="Close image preview"
          >
            <X className="w-6 h-6" />
          </button>
          
          {/* Image container */}
          <div 
            className="relative max-w-full max-h-[80vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black/40 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={lightboxImage} 
              alt="Enlarged captured snapshot" 
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[75vh] object-contain select-none"
            />
          </div>
          
          <p className="text-white/60 text-xs mt-4 font-medium tracking-wide">Click anywhere outside to close preview</p>
        </div>
      )}
    </div>
  );
}
