"""Real image diagnostics for bench use. No learned terrain or metric SLAM claims."""
import time
import cv2
import numpy as np

def inspect_frame(data: bytes):
    started = time.perf_counter()
    frame = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError('Invalid image. Send a JPEG or PNG frame.')
    if frame.shape[0] * frame.shape[1] > 8_000_000:
        raise ValueError('Image exceeds 8 megapixels.')
    ratio = min(1, 640 / frame.shape[1])
    frame = cv2.resize(frame, None, fx=ratio, fy=ratio)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    mean = float(gray.mean())
    exposure = 'Dark' if mean < 65 else 'Glare' if float((gray > 245).mean()) > .25 else 'Good'
    normalized = cv2.createCLAHE(clipLimit=2, tileGridSize=(8, 8)).apply(gray)
    orb = cv2.ORB_create(nfeatures=500)
    raw_points = orb.detect(gray, None)
    adjusted_points = orb.detect(normalized, None)
    enhanced = exposure != 'Good' and len(adjusted_points) > len(raw_points)
    points = adjusted_points if enhanced else raw_points
    return dict(source='bench_camera', exposure=exposure, brightness=round(mean, 1), feature_count=len(points), raw_features=len(raw_points), normalized_features=len(adjusted_points), enhancement_active=enhanced, features=[[round(p.pt[0] / frame.shape[1], 3), round(p.pt[1] / frame.shape[0], 3)] for p in points[:150]], latency_ms=round((time.perf_counter()-started)*1000, 2), width=frame.shape[1], height=frame.shape[0], segmentation=None, pose=None)
