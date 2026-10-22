/** Frame rate over the last second of frames: a ring of frame times and their running sum. */
export function createFpsMeter() {
  const CAP = 1024
  const times = new Float64Array(CAP)
  let head = 0, count = 0, sum = 0
  return {
    frame(dtMs: number) {
      if (count === CAP) { sum -= times[head]; head = (head + 1) % CAP; count-- }
      times[(head + count) % CAP] = dtMs
      count++
      sum += dtMs
      // Drop the oldest frames while the rest still cover a full second
      while (count > 1 && sum - times[head] >= 1000) { sum -= times[head]; head = (head + 1) % CAP; count-- }
    },
    fps: () => (sum > 0 ? (count * 1000) / sum : 0),
    ms: () => (count ? sum / count : 0),
  }
}
