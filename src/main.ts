import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import "./style.css";

type ConversionEvent =
  | { type: "Started" }
  | { type: "Log"; data: { line: string } }
  | { type: "Completed"; data: { output_path: string } }
  | { type: "Failed"; data: { message: string } };

const videoExtensions = ["mp4", "mkv", "mov", "avi", "webm", "m4v"];

let inputPath = "";
let outputPath = "";
let isConverting = false;
let stopListening: (() => void) | undefined;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="app-shell">
    <section class="converter">
      <header class="hero">
        <div class="brand-mark" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div>
          <p class="eyebrow">NKoder Tools</p>
          <h1>Stereo Downmixer</h1>
          <p class="subtitle">
            Preserve the video stream. Convert 5.1 or 7.1 audio to high-quality stereo AAC.
          </p>
        </div>
      </header>

      <section class="workflow-card">
        <div class="workflow-heading">
          <span class="step-number">01</span>
          <div>
            <h2>Source video</h2>
            <p>Select a video with multichannel audio.</p>
          </div>
        </div>

        <button id="drop-zone" class="file-zone" type="button">
          <span class="file-icon" aria-hidden="true">↥</span>
          <span class="file-zone-title">Choose a video file</span>
          <span class="file-zone-copy">MP4, MKV, MOV, AVI, WebM, or M4V</span>
        </button>

        <div id="input-file" class="selected-file hidden">
          <div class="file-info">
            <span class="file-badge">IN</span>
            <div>
              <strong id="input-name"></strong>
              <span id="input-path"></span>
            </div>
          </div>
          <button id="change-input" class="text-button" type="button">Change</button>
        </div>
      </section>

      <section class="workflow-card">
        <div class="workflow-heading">
          <span class="step-number">02</span>
          <div>
            <h2>Output file</h2>
            <p>A stereo AAC audio track will be written into an MP4 container.</p>
          </div>
        </div>

        <div class="output-row">
          <div class="output-preview">
            <span class="file-badge output-badge">OUT</span>
            <div>
              <strong id="output-name">Choose source video first</strong>
              <span id="output-path">No output location selected</span>
            </div>
          </div>
          <button id="choose-output" class="secondary-button" type="button" disabled>
            Save as…
          </button>
        </div>
      </section>

      <section class="settings-card">
        <div>
          <p class="settings-label">Conversion profile</p>
          <h2>Video copy + AAC stereo</h2>
          <p class="command-summary">
            Video is copied without re-encoding. Audio becomes 2-channel AAC, 44.1 kHz, 256 kbps.
          </p>
        </div>

        <div class="format-pills" aria-label="Output format">
          <span>MP4</span>
          <span>AAC</span>
          <span>2 CH</span>
          <span>44.1 kHz</span>
          <span>256 kbps</span>
        </div>
      </section>

      <section id="activity-panel" class="activity-panel hidden" aria-live="polite">
        <div class="activity-header">
          <div class="activity-status">
            <span id="status-dot" class="status-dot"></span>
            <span id="status-text">Preparing conversion…</span>
          </div>
          <span id="elapsed-time"></span>
        </div>

        <div class="progress-track">
          <div id="progress-bar" class="progress-bar progress-indeterminate"></div>
        </div>

        <details class="log-details">
          <summary>FFmpeg activity log</summary>
          <pre id="log-output"></pre>
        </details>
      </section>

      <section id="result-panel" class="result-panel hidden" aria-live="polite">
        <span class="result-icon">✓</span>
        <div>
          <strong>Stereo version created</strong>
          <p id="result-path"></p>
        </div>
      </section>

      <section id="error-panel" class="error-panel hidden" aria-live="assertive">
        <span class="error-icon">!</span>
        <div>
          <strong>Conversion could not finish</strong>
          <p id="error-message"></p>
        </div>
      </section>

      <footer class="actions">
        <p class="command-note">
          FFmpeg: <code>-c:v copy -c:a aac -ac 2 -ar 44100 -b:a 256k</code>
        </p>
        <button id="convert-button" class="convert-button" type="button" disabled>
          <span>Convert to stereo</span>
          <span class="button-arrow">→</span>
        </button>
      </footer>
    </section>
  </main>
`;

const elements = {
  dropZone: document.querySelector<HTMLButtonElement>("#drop-zone")!,
  inputFile: document.querySelector<HTMLDivElement>("#input-file")!,
  inputName: document.querySelector<HTMLElement>("#input-name")!,
  inputPath: document.querySelector<HTMLElement>("#input-path")!,
  changeInput: document.querySelector<HTMLButtonElement>("#change-input")!,
  outputName: document.querySelector<HTMLElement>("#output-name")!,
  outputPath: document.querySelector<HTMLElement>("#output-path")!,
  chooseOutput: document.querySelector<HTMLButtonElement>("#choose-output")!,
  convert: document.querySelector<HTMLButtonElement>("#convert-button")!,
  activity: document.querySelector<HTMLDivElement>("#activity-panel")!,
  statusDot: document.querySelector<HTMLSpanElement>("#status-dot")!,
  statusText: document.querySelector<HTMLSpanElement>("#status-text")!,
  elapsed: document.querySelector<HTMLSpanElement>("#elapsed-time")!,
  progress: document.querySelector<HTMLDivElement>("#progress-bar")!,
  logs: document.querySelector<HTMLPreElement>("#log-output")!,
  result: document.querySelector<HTMLDivElement>("#result-panel")!,
  resultPath: document.querySelector<HTMLParagraphElement>("#result-path")!,
  error: document.querySelector<HTMLDivElement>("#error-panel")!,
  errorMessage: document.querySelector<HTMLParagraphElement>("#error-message")!
};

function fileName(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() || path;
}

function proposedOutputPath(path: string): string {
  const normalised = path.replace(/\\/g, "/");
  const slash = normalised.lastIndexOf("/");
  const directory = slash >= 0 ? normalised.slice(0, slash + 1) : "";
  const filename = slash >= 0 ? normalised.slice(slash + 1) : normalised;
  const extensionPosition = filename.lastIndexOf(".");
  const base = extensionPosition > 0 ? filename.slice(0, extensionPosition) : filename;

  return `${directory}${base}_stereo.mp4`;
}

function resetMessages(): void {
  elements.result.classList.add("hidden");
  elements.error.classList.add("hidden");
}

function updateButtons(): void {
  elements.chooseOutput.disabled = !inputPath || isConverting;
  elements.convert.disabled = !inputPath || !outputPath || isConverting;
  elements.dropZone.disabled = isConverting;
  elements.changeInput.disabled = isConverting;
}

function showInput(path: string): void {
  inputPath = path;
  elements.inputName.textContent = fileName(path);
  elements.inputPath.textContent = path;
  elements.inputFile.classList.remove("hidden");
  elements.dropZone.classList.add("hidden");

  if (!outputPath) {
    showOutput(proposedOutputPath(path));
  }

  updateButtons();
}

function showOutput(path: string): void {
  outputPath = path;
  elements.outputName.textContent = fileName(path);
  elements.outputPath.textContent = path;
  updateButtons();
}

function showError(message: string): void {
  elements.errorMessage.textContent = message;
  elements.error.classList.remove("hidden");
}

function appendLog(line: string): void {
  const maximumLogLength = 40_000;
  const updated = `${elements.logs.textContent ?? ""}${line}\n`;

  elements.logs.textContent =
    updated.length > maximumLogLength ? updated.slice(-maximumLogLength) : updated;

  elements.logs.scrollTop = elements.logs.scrollHeight;
}

async function chooseInputFile(): Promise<void> {
  if (isConverting) return;

  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Video files", extensions: videoExtensions }]
  });

  if (typeof selected !== "string") return;

  resetMessages();
  outputPath = "";
  showInput(selected);
  showOutput(proposedOutputPath(selected));
}

async function chooseOutputFile(): Promise<void> {
  if (!inputPath || isConverting) return;

  const selected = await save({
    defaultPath: outputPath || proposedOutputPath(inputPath),
    filters: [{ name: "MP4 video", extensions: ["mp4"] }]
  });

  if (typeof selected !== "string") return;

  resetMessages();
  showOutput(selected.toLowerCase().endsWith(".mp4") ? selected : `${selected}.mp4`);
}

function beginActivity(): void {
  isConverting = true;
  resetMessages();
  elements.activity.classList.remove("hidden");
  elements.statusText.textContent = "Starting FFmpeg…";
  elements.statusDot.className = "status-dot running";
  elements.progress.className = "progress-bar progress-indeterminate";
  elements.elapsed.textContent = "";
  elements.logs.textContent = "";
  updateButtons();
}

function completeActivity(): void {
  isConverting = false;
  elements.statusText.textContent = "Conversion complete";
  elements.statusDot.className = "status-dot complete";
  elements.progress.className = "progress-bar progress-complete";
  elements.elapsed.textContent = "Finished";
  updateButtons();
}

function failActivity(message: string): void {
  isConverting = false;
  elements.statusText.textContent = "Conversion failed";
  elements.statusDot.className = "status-dot failed";
  elements.progress.className = "progress-bar progress-failed";
  elements.elapsed.textContent = "Stopped";
  showError(message);
  updateButtons();
}

async function configureEventListener(): Promise<void> {
  stopListening = await listen<ConversionEvent>("conversion-event", ({ payload }) => {
    if (payload.type === "Started") {
      elements.statusText.textContent = "Downmixing audio to stereo…";
      appendLog("FFmpeg process started.");
      return;
    }

    if (payload.type === "Log") {
      appendLog(payload.data.line);
      return;
    }

    if (payload.type === "Completed") {
      completeActivity();
      elements.resultPath.textContent = payload.data.output_path;
      elements.result.classList.remove("hidden");
      appendLog(`Completed: ${payload.data.output_path}`);
      return;
    }

    if (payload.type === "Failed") {
      failActivity(payload.data.message);
      appendLog(`ERROR: ${payload.data.message}`);
    }
  });
}

async function convertVideo(): Promise<void> {
  if (!inputPath || !outputPath || isConverting) return;

  beginActivity();

  try {
    const completedPath = await invoke<string>("convert_to_stereo", {
      request: {
        inputPath,
        outputPath
      }
    });

    // The event normally updates the UI. This fallback covers an event delivery race.
    if (isConverting) {
      completeActivity();
      elements.resultPath.textContent = completedPath;
      elements.result.classList.remove("hidden");
    }
  } catch (error) {
    const message = typeof error === "string" ? error : String(error);

    if (isConverting) {
      failActivity(message);
      appendLog(`ERROR: ${message}`);
    }
  }
}

elements.dropZone.addEventListener("click", chooseInputFile);
elements.changeInput.addEventListener("click", chooseInputFile);
elements.chooseOutput.addEventListener("click", chooseOutputFile);
elements.convert.addEventListener("click", convertVideo);

void configureEventListener();
updateButtons();

window.addEventListener("beforeunload", () => {
  stopListening?.();
});