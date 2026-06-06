const DefaultWaveformPeakCount = 64;
const MaxStoredWaveformPeakCount = 96;
const MinMeteringDb = -60;
const MaxMeteringSampleCount = 1200;

export function appendMeteringSample(samples: number[], metering: number) {
  if (!Number.isFinite(metering)) {
    return samples;
  }

  const nextSamples = [...samples, metering];

  if (nextSamples.length <= MaxMeteringSampleCount) {
    return nextSamples;
  }

  return nextSamples.slice(nextSamples.length - MaxMeteringSampleCount);
}

export function createWaveformPeaksFromMetering(
  samples: number[],
  peakCount = DefaultWaveformPeakCount
) {
  const finiteSamples = samples.filter(Number.isFinite);

  if (finiteSamples.length === 0 || peakCount <= 0) {
    return [];
  }

  const resolvedPeakCount = Math.min(MaxStoredWaveformPeakCount, Math.max(1, Math.floor(peakCount)));
  const bucketCount = resolvedPeakCount;

  return Array.from({ length: bucketCount }, (_, bucketIndex) => {
    const startIndex = Math.floor((bucketIndex * finiteSamples.length) / bucketCount);
    const endIndex = Math.max(
      startIndex + 1,
      Math.floor(((bucketIndex + 1) * finiteSamples.length) / bucketCount)
    );
    const bucketSamples = finiteSamples.slice(startIndex, endIndex);
    const bucketLevels = bucketSamples.map(normalizeMeteringDb);
    const peak = getRepresentativePeak(bucketLevels);
    return roundPeak(peak);
  });
}

export function createDisplayWaveformPeaks(
  value: unknown,
  maxPeakCount = DefaultWaveformPeakCount
) {
  const targetPeakCount = Math.min(
    MaxStoredWaveformPeakCount,
    Math.max(1, Math.floor(maxPeakCount))
  );
  const peaks = resampleWaveformPeaks(normalizeWaveformPeaks(value), targetPeakCount);

  if (peaks.length <= 1) {
    return peaks;
  }

  const smoothedPeaks = peaks.map((peak, index) => {
    const previousPeak = peaks[index - 1] ?? peak;
    const nextPeak = peaks[index + 1] ?? peak;
    return previousPeak * 0.18 + peak * 0.64 + nextPeak * 0.18;
  });
  const lowerBound = getQuantile(smoothedPeaks, 0.12);
  const upperBound = getQuantile(smoothedPeaks, 0.88);
  const spread = upperBound - lowerBound;

  if (spread < 0.025) {
    return smoothedPeaks.map((peak) => roundPeak(0.2 + peak * 0.58));
  }

  return smoothedPeaks.map((peak) => {
    const contrasted = Math.max(0, Math.min(1, (peak - lowerBound) / spread));
    const shaped = Math.pow(contrasted, 0.72);
    return roundPeak(0.12 + shaped * 0.88);
  });
}

export function normalizeWaveformPeaks(value: unknown, maxPeakCount = MaxStoredWaveformPeakCount) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((peak) => (typeof peak === 'number' && Number.isFinite(peak) ? [roundPeak(peak)] : []))
    .slice(0, Math.max(0, Math.floor(maxPeakCount)));
}

function normalizeMeteringDb(metering: number) {
  const clampedDb = Math.min(0, Math.max(MinMeteringDb, metering));
  const floorAmplitude = 10 ** (MinMeteringDb / 20);
  const amplitude = 10 ** (clampedDb / 20);
  const normalizedAmplitude = (amplitude - floorAmplitude) / (1 - floorAmplitude);
  return Math.max(0, Math.min(1, normalizedAmplitude ** 0.45));
}

function getRepresentativePeak(levels: number[]) {
  if (levels.length === 0) {
    return 0;
  }

  const averageLevel = levels.reduce((total, level) => total + level, 0) / levels.length;
  const upperLevel = getQuantile(levels, 0.78);
  return averageLevel * 0.44 + upperLevel * 0.56;
}

function resampleWaveformPeaks(peaks: number[], targetPeakCount: number) {
  if (targetPeakCount <= 0 || peaks.length === 0) {
    return [];
  }

  if (peaks.length <= targetPeakCount) {
    return peaks;
  }

  return Array.from({ length: targetPeakCount }, (_, bucketIndex) => {
    const startIndex = Math.floor((bucketIndex * peaks.length) / targetPeakCount);
    const endIndex = Math.max(
      startIndex + 1,
      Math.floor(((bucketIndex + 1) * peaks.length) / targetPeakCount)
    );
    return roundPeak(getRepresentativePeak(peaks.slice(startIndex, endIndex)));
  });
}

function getQuantile(values: number[], quantile: number) {
  if (values.length === 0) {
    return 0;
  }

  const sortedValues = [...values].sort((a, b) => a - b);
  const boundedQuantile = Math.max(0, Math.min(1, quantile));
  const resolvedIndex = Math.round((sortedValues.length - 1) * boundedQuantile);
  return sortedValues[resolvedIndex] ?? 0;
}

function roundPeak(value: number) {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}
