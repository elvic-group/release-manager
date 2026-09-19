import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const MAX_AUDIO_BYTES = 250 * 1024 * 1024;
const COMMAND_TIMEOUT_MS = 120_000;
const TEMPO_SAMPLE_RATE = 8_000;
const TEMPO_FRAME_SAMPLES = 400;

export type AudioFileReference = {
  download_url: string;
  file_id: string;
  mime_type?: string;
  file_name?: string;
};

type AudioStream = {
  codec_name?: string;
  codec_long_name?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
  bits_per_sample?: number;
  bits_per_raw_sample?: string;
  sample_fmt?: string;
  bit_rate?: string;
};

export type AudioAnalysis = {
  kind: "audio-analysis";
  artist: string | null;
  trackTitle: string;
  file: { name: string; mimeType: string | null; sizeBytes: number };
  technical: {
    durationSeconds: number | null;
    durationLabel: string | null;
    container: string | null;
    codec: string | null;
    sampleRateHz: number | null;
    bitDepth: number | null;
    sampleFormat: string | null;
    bitrateKbps: number | null;
    channels: number | null;
    channelLayout: string | null;
    embeddedTags: Array<{ label: string; value: string }>;
  };
  analysis: {
    tempoBpm: number | null;
    tempoConfidence: "not-available" | "low" | "medium" | "high";
    energyLevel: "not-available" | "low" | "moderate" | "high";
    energyBasis: string;
    integratedLufs: number | null;
    loudnessRangeLu: number | null;
    peakDbfs: number | null;
    dynamics: "not-available" | "tight" | "controlled" | "dynamic";
    moodStatus: "artist-confirmation-needed";
  };
  creativeSuggestions: {
    genres: string[];
    genreConfidence: "detected" | "low";
    moods: string[];
    moodConfidence: "low";
    basis: string;
  };
  metadataSuggestions: Array<{ label: string; value: string; status: "detected" | "estimated" | "to-confirm" }>;
  limitations: string[];
  confirmBeforeUse: string[];
  privacyNote: string;
  safetyNote: string;
};

type ProcessResult = { stdout: Buffer; stderr: Buffer };

function execute(command: string, args: string[], maxOutputBytes = 32 * 1024 * 1024): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputSize = 0;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, COMMAND_TIMEOUT_MS);

    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      outputSize += chunk.length;
      if (outputSize > maxOutputBytes) {
        child.kill("SIGKILL");
        return;
      }
      target.push(chunk);
    };

    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error(`${command} timed out while processing the audio file.`));
      if (outputSize > maxOutputBytes) return reject(new Error(`${command} returned too much data while processing the audio file.`));
      if (code !== 0) return reject(new Error(`${command} could not process this audio file.`));
      resolve({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
    });
  });
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return null;
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  return `${minutes}:${String(rounded % 60).padStart(2, "0")}`;
}

function cleanTag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/[\r\n\t]+/g, " ").trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

function parseMeasurement(value: string, field: string): number | null {
  const matches = [...value.matchAll(new RegExp(`${field}:\\s*(-?(?:\\d+(?:\\.\\d+)?|inf))`, "gi"))];
  const last = matches.at(-1)?.[1];
  if (!last || last.toLowerCase().includes("inf")) return null;
  const parsed = Number(last);
  return Number.isFinite(parsed) ? parsed : null;
}

function energyLevel(lufs: number | null): AudioAnalysis["analysis"]["energyLevel"] {
  if (lufs === null) return "not-available";
  if (lufs >= -9) return "high";
  if (lufs >= -16) return "moderate";
  return "low";
}

function dynamics(lra: number | null): AudioAnalysis["analysis"]["dynamics"] {
  if (lra === null) return "not-available";
  if (lra < 4) return "tight";
  if (lra <= 8) return "controlled";
  return "dynamic";
}

function creativeSuggestions(
  tempoBpm: number | null,
  energy: AudioAnalysis["analysis"]["energyLevel"],
  dynamicRange: AudioAnalysis["analysis"]["dynamics"],
  embeddedGenre: string | null
): AudioAnalysis["creativeSuggestions"] {
  const fast = tempoBpm !== null && tempoBpm >= 125;
  const slow = tempoBpm !== null && tempoBpm < 95;
  let genres: string[];
  let moods: string[];

  if (embeddedGenre) {
    genres = [embeddedGenre];
  } else if (energy === "high" && fast) {
    genres = ["Dance-pop", "Electronic", "Up-tempo pop"];
  } else if (energy === "high" && slow) {
    genres = ["Hip-hop / R&B", "Alternative pop", "Contemporary pop"];
  } else if (energy === "high") {
    genres = ["Pop", "Hip-hop", "Rock / alternative"];
  } else if (energy === "moderate" && slow) {
    genres = ["R&B / soul", "Singer-songwriter", "Alternative pop"];
  } else if (energy === "moderate") {
    genres = ["Pop", "Indie pop", "Alternative"];
  } else if (energy === "low") {
    genres = ["Singer-songwriter", "Ambient", "Acoustic / alternative"];
  } else {
    genres = ["Genre needs artist input"];
  }

  if (energy === "high" && fast) {
    moods = ["Energetic", "Driving", "Uplifting"];
  } else if (energy === "high" && slow) {
    moods = ["Intense", "Confident", "Moody"];
  } else if (energy === "high") {
    moods = ["Confident", "Focused", "Energetic"];
  } else if (energy === "moderate" && slow) {
    moods = ["Reflective", "Warm", "Melancholic"];
  } else if (energy === "moderate") {
    moods = ["Upbeat", "Warm", "Focused"];
  } else if (energy === "low") {
    moods = ["Calm", "Intimate", "Reflective"];
  } else {
    moods = ["Mood needs artist input"];
  }

  const pace = tempoBpm ? `${tempoBpm} BPM` : "no confident tempo estimate";
  return {
    genres,
    genreConfidence: embeddedGenre ? "detected" : "low",
    moods,
    moodConfidence: "low",
    basis: `Starting points based on ${pace}, ${energy} measured energy, and ${dynamicRange} dynamics${embeddedGenre ? "; the genre tag was found in the audio file" : ""}.`,
  };
}

function estimateTempo(audio: Buffer): { bpm: number | null; confidence: AudioAnalysis["analysis"]["tempoConfidence"] } {
  const floatCount = Math.floor(audio.length / Float32Array.BYTES_PER_ELEMENT);
  if (floatCount < TEMPO_FRAME_SAMPLES * 30) return { bpm: null, confidence: "not-available" };

  const values = new Float32Array(audio.buffer, audio.byteOffset, floatCount);
  const energy: number[] = [];
  for (let start = 0; start + TEMPO_FRAME_SAMPLES <= values.length; start += TEMPO_FRAME_SAMPLES) {
    let sum = 0;
    for (let index = start; index < start + TEMPO_FRAME_SAMPLES; index += 1) sum += values[index] * values[index];
    energy.push(Math.log1p((sum / TEMPO_FRAME_SAMPLES) * 1_000));
  }
  const onsets = energy.map((value, index) => Math.max(0, value - (energy[index - 1] ?? value)));
  const onsetPower = onsets.reduce((sum, value) => sum + value * value, 0);
  if (onsetPower <= 0.0001) return { bpm: null, confidence: "not-available" };

  const frameRate = TEMPO_SAMPLE_RATE / TEMPO_FRAME_SAMPLES;
  let best = { bpm: 0, score: -1 };
  for (let bpm = 70; bpm <= 180; bpm += 1) {
    const lag = Math.round((60 * frameRate) / bpm);
    let dot = 0;
    let currentPower = 0;
    let laggedPower = 0;
    for (let index = lag; index < onsets.length; index += 1) {
      dot += onsets[index] * onsets[index - lag];
      currentPower += onsets[index] * onsets[index];
      laggedPower += onsets[index - lag] * onsets[index - lag];
    }
    const score = dot / Math.sqrt(currentPower * laggedPower || 1);
    if (score > best.score) best = { bpm, score };
  }
  if (best.score < 0.15) return { bpm: null, confidence: "not-available" };
  return {
    bpm: best.bpm,
    confidence: best.score >= 0.42 ? "high" : best.score >= 0.26 ? "medium" : "low",
  };
}

function titleFromFileName(name: string): string {
  const extension = extname(name);
  return name.slice(0, extension ? -extension.length : undefined).replace(/[_-]+/g, " ").trim() || "Untitled track";
}

function safeSourceUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname) || url.hostname.endsWith(".local")) {
    throw new Error("The audio file must be supplied through a secure ChatGPT file download URL.");
  }
  return url;
}

async function downloadAudioFile(source: URL, destination: string): Promise<number> {
  const response = await fetch(source, { signal: AbortSignal.timeout(COMMAND_TIMEOUT_MS), redirect: "error" });
  if (!response.ok || !response.body) throw new Error("The audio file could not be downloaded for analysis.");
  const expectedBytes = Number(response.headers.get("content-length") ?? "0");
  if (expectedBytes > MAX_AUDIO_BYTES) throw new Error("The audio file is larger than the 250 MB analysis limit.");

  let bytes = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > MAX_AUDIO_BYTES ? new Error("The audio file is larger than the 250 MB analysis limit.") : null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body as never), limiter, createWriteStream(destination, { flags: "wx" }));
  return bytes;
}

export async function analyzeAudioFile(file: AudioFileReference, artist?: string, trackTitle?: string): Promise<AudioAnalysis> {
  const sourceUrl = safeSourceUrl(file.download_url);
  const fileName = cleanTag(file.file_name) ?? "audio-file";
  const extension = extname(fileName).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 16) || ".audio";
  const workingDirectory = await mkdtemp(join(tmpdir(), "mrm-audio-"));
  const sourcePath = join(workingDirectory, `source${extension}`);

  try {
    const sizeBytes = await downloadAudioFile(sourceUrl, sourcePath);
    const probe = await execute("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", sourcePath]);
    const data = JSON.parse(probe.stdout.toString("utf8")) as {
      format?: { duration?: string; bit_rate?: string; format_name?: string; tags?: Record<string, unknown> };
      streams?: Array<AudioStream & { codec_type?: string }>;
    };
    const stream = data.streams?.find((candidate) => candidate.codec_type === "audio");
    if (!stream) throw new Error("No audio stream was found in the supplied file.");

    const durationSeconds = Number(data.format?.duration);
    const tags = data.format?.tags ?? {};
    const tagLabels: Record<string, string> = {
      title: "Title", artist: "Artist", album: "Album", album_artist: "Album artist", date: "Date", year: "Year", genre: "Genre", mood: "Mood", track: "Track number", disc: "Disc number", isrc: "ISRC", copyright: "Copyright", composer: "Composer",
    };
    const embeddedTags = Object.entries(tagLabels)
      .map(([key, label]) => ({ label, value: cleanTag(tags[key] ?? tags[key.toUpperCase()]) }))
      .filter((entry): entry is { label: string; value: string } => Boolean(entry.value));

    let integratedLufs: number | null = null;
    let loudnessRangeLu: number | null = null;
    let peakDbfs: number | null = null;
    let tempoBpm: number | null = null;
    let tempoConfidence: AudioAnalysis["analysis"]["tempoConfidence"] = "not-available";
    const limitations: string[] = [];

    try {
      const loudness = await execute("ffmpeg", ["-v", "info", "-i", sourcePath, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"]);
      const report = loudness.stderr.toString("utf8");
      integratedLufs = parseMeasurement(report, "I");
      loudnessRangeLu = parseMeasurement(report, "LRA");
      peakDbfs = parseMeasurement(report, "Peak");
    } catch {
      limitations.push("Loudness and dynamic-range measurement was unavailable for this file.");
    }

    try {
      const decoded = await execute("ffmpeg", ["-v", "error", "-ss", "10", "-t", "90", "-i", sourcePath, "-vn", "-ac", "1", "-ar", String(TEMPO_SAMPLE_RATE), "-f", "f32le", "pipe:1"], 16 * 1024 * 1024);
      const tempo = estimateTempo(decoded.stdout);
      tempoBpm = tempo.bpm;
      tempoConfidence = tempo.confidence;
      if (tempoBpm === null) limitations.push("Tempo could not be estimated confidently from this audio signal.");
    } catch {
      limitations.push("Tempo estimation was unavailable for this file.");
    }

    const title = trackTitle?.trim() || embeddedTags.find((tag) => tag.label === "Title")?.value || titleFromFileName(fileName);
    const bitrate = Number(stream.bit_rate ?? data.format?.bit_rate);
    const sampleRate = Number(stream.sample_rate);
    const bitDepth = Number(stream.bits_per_raw_sample ?? stream.bits_per_sample);
    const embeddedGenre = embeddedTags.find((tag) => tag.label === "Genre")?.value ?? null;
    const suggestions = creativeSuggestions(tempoBpm, energyLevel(integratedLufs), dynamics(loudnessRangeLu), embeddedGenre);
    const detectedSuggestions = [
      durationSeconds ? { label: "Duration", value: formatDuration(durationSeconds) ?? "To confirm", status: "detected" as const } : null,
      embeddedTags.find((tag) => tag.label === "Title") ? { label: "Embedded title", value: embeddedTags.find((tag) => tag.label === "Title")!.value, status: "detected" as const } : null,
      embeddedTags.find((tag) => tag.label === "Artist") ? { label: "Embedded artist", value: embeddedTags.find((tag) => tag.label === "Artist")!.value, status: "detected" as const } : null,
      tempoBpm ? { label: "Tempo", value: `${tempoBpm} BPM (${tempoConfidence} confidence estimate)`, status: "estimated" as const } : null,
      { label: "Genre candidates", value: suggestions.genres.join(" · "), status: suggestions.genreConfidence === "detected" ? "detected" as const : "estimated" as const },
      { label: "Mood candidates", value: suggestions.moods.join(" · "), status: "estimated" as const },
    ].filter((entry): entry is { label: string; value: string; status: "detected" | "estimated" } => Boolean(entry));

    return {
      kind: "audio-analysis",
      artist: artist?.trim() || null,
      trackTitle: title,
      file: { name: fileName, mimeType: cleanTag(file.mime_type), sizeBytes },
      technical: {
        durationSeconds: Number.isFinite(durationSeconds) ? Number(durationSeconds.toFixed(3)) : null,
        durationLabel: formatDuration(durationSeconds),
        container: cleanTag(data.format?.format_name),
        codec: cleanTag(stream.codec_long_name ?? stream.codec_name),
        sampleRateHz: Number.isFinite(sampleRate) ? sampleRate : null,
        bitDepth: Number.isFinite(bitDepth) && bitDepth > 0 ? bitDepth : null,
        sampleFormat: cleanTag(stream.sample_fmt),
        bitrateKbps: Number.isFinite(bitrate) ? Math.round(bitrate / 1_000) : null,
        channels: stream.channels ?? null,
        channelLayout: cleanTag(stream.channel_layout),
        embeddedTags,
      },
      analysis: {
        tempoBpm,
        tempoConfidence,
        energyLevel: energyLevel(integratedLufs),
        energyBasis: integratedLufs === null ? "No loudness measurement was available." : `Measured from integrated loudness (${integratedLufs.toFixed(1)} LUFS).`,
        integratedLufs,
        loudnessRangeLu,
        peakDbfs,
        dynamics: dynamics(loudnessRangeLu),
        moodStatus: "artist-confirmation-needed",
      },
      creativeSuggestions: suggestions,
      metadataSuggestions: detectedSuggestions,
      limitations,
      confirmBeforeUse: [
        "Confirm the estimated BPM with the producer or session before using it in distributor metadata.",
        "Use the genre and mood candidates as a starting point, then choose artist-approved wording for distributor, platform, press, and campaign fields.",
        "Verify that embedded tags are current before reusing them in a distributor or public listing.",
      ],
      privacyNote: "The supplied audio is downloaded only to measure this request, is not retained in a database, and the temporary working file is deleted before the result is returned.",
      safetyNote: "This analysis reads a supplied audio file only. It does not edit the master, save the audio, register metadata, submit a release, publish anything, or access artist accounts.",
    };
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

export { formatDuration };
