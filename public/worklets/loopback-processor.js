class LoopbackProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = options.processorOptions || {};
    this.targetSampleRate = processorOptions.targetSampleRate || 16000;
    this.chunkDurationMs = processorOptions.chunkDurationMs || 512;
    this.decimationFactor = Math.max(1, Math.floor(sampleRate / this.targetSampleRate));
    this.buffer = [];
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }
    const channel = input[0];
    if (!channel) {
      return true;
    }
    for (let i = 0; i < channel.length; i += this.decimationFactor) {
      this.buffer.push(channel[i]);
    }
    const chunkSize = Math.floor((this.targetSampleRate * this.chunkDurationMs) / 1000);
    while (this.buffer.length >= chunkSize) {
      const chunk = this.buffer.slice(0, chunkSize);
      this.buffer = this.buffer.slice(chunkSize);
      const float32 = new Float32Array(chunk);
      this.port.postMessage({ buffer: float32.buffer }, [float32.buffer]);
    }
    return true;
  }
}

registerProcessor('loopback-processor', LoopbackProcessor);
