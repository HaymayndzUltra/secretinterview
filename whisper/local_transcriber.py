#!/usr/bin/env python3
"""Streaming Whisper transcription bridge for GPU-accelerated local inference.

This helper script is spawned by the Electron main process. It reads
base64-encoded Float32 PCM audio chunks from stdin and streams
transcription results back over stdout as JSON lines.

Requirements:
- Python 3.8+
- faster-whisper (`pip install faster-whisper`)
- numpy
- CUDA-capable GPU (for best performance with `--device cuda`)
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
from typing import Optional

import numpy as np


def emit(payload: dict) -> None:
    """Write a JSON payload to stdout with flush."""
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def emit_error(message: str, code: str = "local_asr_error") -> None:
    emit({"type": "error", "message": message, "code": code})


def emit_log(message: str) -> None:
    emit({"type": "log", "message": message})


def emit_transcript(text: str, *, full_text: Optional[str] = None, is_final: bool = False) -> None:
    payload = {"type": "transcript", "text": text, "is_final": is_final}
    if full_text is not None:
        payload["full_text"] = full_text
    emit(payload)


def load_model(args):
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except Exception as exc:  # pragma: no cover - import guarded for runtime availability
        emit_error(f"Failed to import faster-whisper: {exc}", code="import_error")
        sys.exit(1)

    try:
        model = WhisperModel(
            args.model,
            device=args.device,
            compute_type=args.compute_type,
        )
    except Exception as exc:  # pragma: no cover - runtime dependency issues
        emit_error(f"Failed to load Whisper model '{args.model}': {exc}", code="model_load_error")
        sys.exit(1)

    return model


def main() -> None:
    parser = argparse.ArgumentParser(description="Local streaming Whisper transcriber")
    parser.add_argument("--model", default="large-v3", help="Model identifier or path")
    parser.add_argument("--device", default="cuda", help="Device hint for faster-whisper")
    parser.add_argument("--compute-type", default="float16", help="Compute precision (e.g. float16, int8) ")
    parser.add_argument("--chunk-size", type=int, default=320, help="Inference trigger chunk size in milliseconds")
    parser.add_argument("--window-size", type=int, default=3000, help="Sliding window size in milliseconds")
    parser.add_argument("--stride-size", type=int, default=120, help="Stride between inference windows in milliseconds")
    parser.add_argument("--beam-size", type=int, default=1, help="Beam size for decoding")
    parser.add_argument("--temperature", type=float, default=0.0, help="Sampling temperature")
    parser.add_argument("--language", default=None, help="Primary language hint (e.g. en)")
    parser.add_argument("--vad-filter", default="0", help="Enable VAD filtering (1/0 or true/false)")
    parser.add_argument("--sample-rate", type=int, default=16000, help="Audio sample rate in Hz")

    args = parser.parse_args()

    language = None if not args.language or args.language == "auto" else args.language
    vad_filter = str(args.vad_filter).lower() in {"1", "true", "yes", "y"}

    model = load_model(args)
    emit({"type": "ready"})

    sample_rate = max(args.sample_rate, 1)
    trigger_samples = max(int(args.chunk_size * sample_rate / 1000), 1)
    window_samples = max(int(args.window_size * sample_rate / 1000), trigger_samples)

    audio_buffer = np.zeros(0, dtype=np.float32)
    last_text = ""
    pending_samples = 0

    def run_inference(force_final: bool = False) -> None:
        nonlocal audio_buffer, last_text

        if audio_buffer.size < trigger_samples:
            return

        window = audio_buffer[-window_samples:]
        try:
            segments, _ = model.transcribe(
                window,
                beam_size=args.beam_size,
                temperature=args.temperature,
                vad_filter=vad_filter,
                language=language,
                without_timestamps=True,
            )
        except Exception as exc:  # pragma: no cover - runtime inference failure
            emit_error(f"Inference failed: {exc}", code="inference_error")
            return

        text = "".join(segment.text for segment in segments).strip()
        if not text:
            return

        if last_text and text.startswith(last_text):
            new_text = text[len(last_text):].strip()
        else:
            new_text = text

        if new_text:
            emit_transcript(new_text, full_text=text, is_final=force_final)

        if force_final:
            last_text = ""
            audio_buffer = np.zeros(0, dtype=np.float32)
        else:
            last_text = text

    try:
        for raw_line in sys.stdin:
            line = raw_line.strip()
            if not line:
                continue

            try:
                message = json.loads(line)
            except json.JSONDecodeError:
                emit_error(f"Invalid JSON payload: {line}", code="parse_error")
                continue

            message_type = message.get("type")

            if message_type == "chunk":
                payload = message.get("data", "")
                if not payload:
                    continue
                try:
                    chunk = np.frombuffer(base64.b64decode(payload), dtype=np.float32)
                except Exception as exc:
                    emit_error(f"Failed to decode audio chunk: {exc}", code="chunk_decode_error")
                    continue

                if chunk.size == 0:
                    continue

                audio_buffer = np.concatenate([audio_buffer, chunk])
                # Prevent unbounded growth by keeping at most 3x the window size
                if audio_buffer.size > window_samples * 3:
                    audio_buffer = audio_buffer[-window_samples * 3 :]

                pending_samples += chunk.size
                if pending_samples >= trigger_samples:
                    run_inference()
                    pending_samples = 0

            elif message_type == "flush":
                run_inference(force_final=True)
                pending_samples = 0

            elif message_type == "stop":
                run_inference(force_final=True)
                break

            else:
                emit_error(f"Unsupported message type: {message_type}", code="unknown_message")
    except KeyboardInterrupt:  # pragma: no cover - graceful shutdown
        emit_log("Interrupted")
    finally:
        emit_log("Local ASR stopped")


if __name__ == "__main__":
    main()
