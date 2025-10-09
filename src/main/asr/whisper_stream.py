import base64
import io
import json
import sys
import time
from dataclasses import dataclass
from typing import Generator, Optional

import numpy as np

try:
    from faster_whisper import WhisperModel
except ImportError as exc:  # pragma: no cover - runtime dependency
    sys.stderr.write(json.dumps({"type": "error", "payload": f"faster-whisper missing: {exc}"}) + "\n")
    sys.exit(1)

TARGET_SAMPLE_RATE = 16000
MODEL_NAME = "distil-large-v3"


def iter_stdin() -> Generator[str, None, None]:
    while True:
        chunk = sys.stdin.readline()
        if not chunk:
            break
        yield chunk.strip()


def decode_chunk(payload: str) -> bytes:
    return base64.b64decode(payload)


@dataclass
class SegmentResult:
    segment_id: str
    text: str
    start: float
    end: float
    confidence: float


class WhisperStreamer:
    def __init__(self) -> None:
        self.model = WhisperModel(MODEL_NAME, device="cuda", compute_type="float16")
        self.buffer = io.BytesIO()
        self.segment_index = 0
        self.last_emit = time.time()

    def process_audio(self, audio_bytes: bytes) -> None:
        self.buffer.write(audio_bytes)
        now = time.time()
        if now - self.last_emit < 0.5:
            return
        self.last_emit = now
        audio_np = np.frombuffer(self.buffer.getvalue(), dtype=np.float32)
        if audio_np.size == 0:
            return
        segments, info = self.model.transcribe(
            audio_np,
            beam_size=1,
            vad_filter=True,
            temperature=0.0,
            condition_on_previous_text=False,
            word_timestamps=False,
            language="en",
            sample_rate=TARGET_SAMPLE_RATE,
        )
        partials = []
        last_final: Optional[SegmentResult] = None
        for segment in segments:
            seg = SegmentResult(
                segment_id=f"TX-{self.segment_index:04d}",
                text=segment.text.strip(),
                start=segment.start,
                end=segment.end,
                confidence=float(info.language_probability),
            )
            partials.append(
                {
                  "id": seg.segment_id,
                  "text": seg.text,
                  "avgLogProb": float(getattr(segment, "avg_logprob", 0.0) or 0.0),
                  "temperature": float(getattr(segment, "temperature", 0.0) or 0.0),
                }
            )
            if segment.no_speech_prob < 0.2 and segment.end - segment.start >= 1.0:
                last_final = seg
                self.segment_index += 1
        if partials:
            sys.stdout.write(json.dumps({"type": "partial", "payload": partials[-1]}) + "\n")
            sys.stdout.flush()
        if last_final:
            tx = {
                "id": last_final.segment_id,
                "timestamp": time.strftime("%H:%M:%S", time.gmtime(last_final.end)),
                "text": last_final.text,
                "confidence": last_final.confidence,
            }
            sys.stdout.write(json.dumps({"type": "final", "payload": tx}) + "\n")
            sys.stdout.flush()
            self.buffer = io.BytesIO()


def main() -> None:
    streamer = WhisperStreamer()
    sys.stdout.write(json.dumps({"type": "ready"}) + "\n")
    sys.stdout.flush()
    for line in iter_stdin():
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            continue
        if message.get("type") != "audio":
            continue
        audio_bytes = decode_chunk(message.get("payload", ""))
        streamer.process_audio(audio_bytes)


if __name__ == "__main__":
    main()
