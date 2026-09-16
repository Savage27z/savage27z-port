// Optional, locally synthesized ambience. No downloads, microphone access,
// tracking or autoplay. The graph is created only by a sound-button gesture.
export function createAmbience() {
  let context = null, gain = null, timer = null, epoch = 0;
  return { async setEnabled(enabled) {
    const sequence = ++epoch;
    if (timer) { clearTimeout(timer); timer = null; }
    if (!enabled) {
      if (context) {
        gain.gain.cancelScheduledValues(context.currentTime);
        gain.gain.setTargetAtTime(0, context.currentTime, .04);
        timer = setTimeout(() => { context.suspend().catch(() => {}); timer = null; }, 220);
      }
      return false;
    }
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Web Audio unavailable');
      context = new Audio(); gain = context.createGain(); gain.gain.value = 0; gain.connect(context.destination);
      const noise = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
      const data = noise.getChannelData(0); let previous = 0;
      for (let i = 0; i < data.length; i++) { previous = (previous + (Math.random() * 2 - 1) * .02) / 1.02; data[i] = previous * 3; }
      const source = context.createBufferSource(); source.buffer = noise; source.loop = true;
      const lowPass = context.createBiquadFilter(); lowPass.type = 'lowpass'; lowPass.frequency.value = 700;
      source.connect(lowPass); lowPass.connect(gain); source.start();
      const hum = context.createOscillator(), humVolume = context.createGain();
      hum.type = 'sine'; hum.frequency.value = 64; humVolume.gain.value = .045;
      hum.connect(humVolume); humVolume.connect(gain); hum.start();
    }
    await context.resume();
    if (sequence !== epoch) return false;
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setTargetAtTime(.15, context.currentTime, .3);
    return true;
  }};
}
