import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Encapsulates the getUserMedia lifecycle: permission request, live stream
 * attach/detach, capture-to-Blob, and camera-existence detection (distinct
 * from API *support* — a browser can support getUserMedia with zero actual
 * camera devices attached, e.g. most desktops without a webcam).
 *
 * Pure state/logic — no UI. The caller owns the <video>/<canvas> elements
 * and passes their refs in; this hook just drives what's attached to them.
 */
export function useCameraCapture() {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  // null = still checking, true/false once enumerateDevices resolves.
  const [hasCamera, setHasCamera] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  // Device *existence* check. enumerateDevices() doesn't require a
  // permission prompt to run — device labels come back blank pre-consent,
  // but the videoinput entry itself is still enumerable — so this can run
  // on mount to decide which entry-screen CTA gets primary emphasis
  // without asking for camera access just to find that out.
  useEffect(() => {
    if (!isSupported || !navigator.mediaDevices.enumerateDevices) {
      setHasCamera(false);
      return;
    }
    let cancelled = false;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (!cancelled) setHasCamera(devices.some((d) => d.kind === 'videoinput'));
      })
      .catch(() => {
        if (!cancelled) setHasCamera(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSupported]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsOpen(false);
  }, []);

  // Release the camera on unmount regardless of how the flow ended.
  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    if (isOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isOpen]);

  const open = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setIsOpen(true);
      return true;
    } catch (err) {
      streamRef.current = null;
      setError(err?.name === 'NotAllowedError' ? 'Camera access was denied.' : 'Camera unavailable.');
      return false;
    }
  }, []);

  const capture = useCallback(() => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        resolve(null);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
    });
  }, []);

  return { isSupported, hasCamera, isOpen, error, videoRef, canvasRef, open, stop, capture };
}
