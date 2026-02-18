class ResampleProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0) {
      return true;
    }

    const ratio = sampleRate / 16000;
    const outputLength = Math.max(1, Math.floor(input.length / ratio));
    const output = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i += 1) {
      const sampleIndex = Math.floor(i * ratio);
      const sample = Math.max(-1, Math.min(1, input[sampleIndex] || 0));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    this.port.postMessage(output.buffer, [output.buffer]);
    return true;
  }
}

registerProcessor("resample-processor", ResampleProcessor);
