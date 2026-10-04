import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';

export interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[] | string;
  initialIndex?: number;
  title?: string;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  title,
}) => {
  const imageList = Array.isArray(images) ? images : [images];
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Transform states
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);

  // Dragging / Panning states
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const positionStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch pinch states
  const touchDistanceRef = useRef<number | null>(null);

  const resetTransform = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  // Sync initialIndex when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, imageList.length - 1)));
      resetTransform();
    }
  }, [isOpen, initialIndex, imageList.length, resetTransform]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.35, 5));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.35, 0.5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handlePrev = useCallback(() => {
    if (imageList.length <= 1) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : imageList.length - 1));
    resetTransform();
  }, [imageList.length, resetTransform]);

  const handleNext = useCallback(() => {
    if (imageList.length <= 1) return;
    setCurrentIndex((prev) => (prev < imageList.length - 1 ? prev + 1 : 0));
    resetTransform();
  }, [imageList.length, resetTransform]);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
        case '_':
          handleZoomOut();
          break;
        case 'r':
        case 'R':
          handleRotate();
          break;
        case '0':
          resetTransform();
          break;
        case 'ArrowLeft':
          handlePrev();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext, resetTransform]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Double-click / Double-tap zoom toggle
  const handleDoubleClick = () => {
    if (scale > 1.2) {
      resetTransform();
    } else {
      setScale(2.5);
    }
  };

  // Drag handlers (Mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return; // Only allow panning when zoomed
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...position };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: positionStartRef.current.x + dx,
      y: positionStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers (Mobile Pan & Pinch Zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      positionStartRef.current = { ...position };
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPosition({
        x: positionStartRef.current.x + dx,
        y: positionStartRef.current.y + dy,
      });
    } else if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const factor = dist / touchDistanceRef.current;
      setScale((prev) => Math.min(Math.max(prev * (factor > 1 ? 1.04 : 0.96), 0.5), 5));
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchDistanceRef.current = null;
  };

  // Download image
  const handleDownload = () => {
    const currentImg = imageList[currentIndex];
    if (!currentImg) return;
    const a = document.createElement('a');
    a.href = currentImg;
    a.download = `pledgebook-photo-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen || imageList.length === 0) return null;

  const currentSrc = imageList[currentIndex];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-black/90 backdrop-blur-md select-none touch-none animate-in fade-in duration-200"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Header Bar */}
      <div className="w-full flex items-center justify-between px-4 py-3 sm:px-6 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3 text-white">
          <span className="text-sm font-semibold tracking-wide truncate max-w-[200px] sm:max-w-md">
            {title || `Photo (${currentIndex + 1}/${imageList.length})`}
          </span>
          {imageList.length > 1 && (
            <span className="text-xs bg-white/20 text-white/90 px-2 py-0.5 rounded-full font-mono">
              {currentIndex + 1} / {imageList.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            title="Download image"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-rose-600 rounded-full transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Display Area */}
      <div
        className="relative flex-1 w-full flex items-center justify-center overflow-hidden cursor-default"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={currentSrc}
          alt={`Photo ${currentIndex + 1}`}
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          className="max-w-[90vw] max-h-[75vh] object-contain shadow-2xl rounded-lg pointer-events-auto"
        />

        {/* Previous & Next Buttons */}
        {imageList.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-3 sm:left-6 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/10 backdrop-blur-sm shadow-xl transition-all hover:scale-105 active:scale-95"
              title="Previous Photo (Left Arrow)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-3 sm:right-6 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/10 backdrop-blur-sm shadow-xl transition-all hover:scale-105 active:scale-95"
              title="Next Photo (Right Arrow)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Floating Bottom Toolbar */}
      <div className="w-full pb-6 pt-2 flex items-center justify-center z-10 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-neutral-900/90 border border-white/20 shadow-2xl backdrop-blur-md">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-full transition-all"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={resetTransform}
            className="px-2.5 py-1 text-xs font-mono font-bold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors min-w-[54px] text-center"
            title="Reset Zoom (0)"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 5}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-full transition-all"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <div className="w-px h-5 bg-white/20 mx-1" />

          <button
            type="button"
            onClick={handleRotate}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Rotate 90° (R)"
          >
            <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={resetTransform}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
