(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))a(n);new MutationObserver(n=>{for(const o of n)if(o.type==="childList")for(const l of o.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&a(l)}).observe(document,{childList:!0,subtree:!0});function r(n){const o={};return n.integrity&&(o.integrity=n.integrity),n.referrerPolicy&&(o.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?o.credentials="include":n.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function a(n){if(n.ep)return;n.ep=!0;const o=r(n);fetch(n.href,o)}})();function _(e,s=!1){return window.__TAURI_INTERNALS__.transformCallback(e,s)}async function m(e,s={},r){return window.__TAURI_INTERNALS__.invoke(e,s,r)}var y;(function(e){e.WINDOW_RESIZED="tauri://resize",e.WINDOW_MOVED="tauri://move",e.WINDOW_CLOSE_REQUESTED="tauri://close-requested",e.WINDOW_DESTROYED="tauri://destroyed",e.WINDOW_FOCUS="tauri://focus",e.WINDOW_BLUR="tauri://blur",e.WINDOW_SCALE_FACTOR_CHANGED="tauri://scale-change",e.WINDOW_THEME_CHANGED="tauri://theme-changed",e.WINDOW_CREATED="tauri://window-created",e.WINDOW_SUSPENDED="tauri://suspended",e.WINDOW_RESUMED="tauri://resumed",e.WEBVIEW_CREATED="tauri://webview-created",e.DRAG_ENTER="tauri://drag-enter",e.DRAG_OVER="tauri://drag-over",e.DRAG_DROP="tauri://drag-drop",e.DRAG_LEAVE="tauri://drag-leave"})(y||(y={}));async function N(e,s){window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener(e,s),await m("plugin:event|unlisten",{event:e,eventId:s})}async function O(e,s,r){var a;const n=(a=void 0)!==null&&a!==void 0?a:{kind:"Any"};return m("plugin:event|listen",{event:e,target:n,handler:_(s)}).then(o=>async()=>N(e,o))}async function L(e={}){return typeof e=="object"&&Object.freeze(e),await m("plugin:dialog|open",{options:e})}async function x(e={}){return typeof e=="object"&&Object.freeze(e),await m("plugin:dialog|save",{options:e})}const A=["mp4","mkv","mov","avi","webm","m4v"];let c="",u="",i=!1,f;document.querySelector("#app").innerHTML=`
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
`;const t={dropZone:document.querySelector("#drop-zone"),inputFile:document.querySelector("#input-file"),inputName:document.querySelector("#input-name"),inputPath:document.querySelector("#input-path"),changeInput:document.querySelector("#change-input"),outputName:document.querySelector("#output-name"),outputPath:document.querySelector("#output-path"),chooseOutput:document.querySelector("#choose-output"),convert:document.querySelector("#convert-button"),activity:document.querySelector("#activity-panel"),statusDot:document.querySelector("#status-dot"),statusText:document.querySelector("#status-text"),elapsed:document.querySelector("#elapsed-time"),progress:document.querySelector("#progress-bar"),logs:document.querySelector("#log-output"),result:document.querySelector("#result-panel"),resultPath:document.querySelector("#result-path"),error:document.querySelector("#error-panel"),errorMessage:document.querySelector("#error-message")};function b(e){return e.replace(/\\/g,"/").split("/").pop()||e}function g(e){const s=e.replace(/\\/g,"/"),r=s.lastIndexOf("/"),a=r>=0?s.slice(0,r+1):"",n=r>=0?s.slice(r+1):s,o=n.lastIndexOf("."),l=o>0?n.slice(0,o):n;return`${a}${l}_stereo.mp4`}function v(){t.result.classList.add("hidden"),t.error.classList.add("hidden")}function d(){t.chooseOutput.disabled=!c||i,t.convert.disabled=!c||!u||i,t.dropZone.disabled=i,t.changeInput.disabled=i}function E(e){c=e,t.inputName.textContent=b(e),t.inputPath.textContent=e,t.inputFile.classList.remove("hidden"),t.dropZone.classList.add("hidden"),u||h(g(e)),d()}function h(e){u=e,t.outputName.textContent=b(e),t.outputPath.textContent=e,d()}function D(e){t.errorMessage.textContent=e,t.error.classList.remove("hidden")}function p(e){const r=`${t.logs.textContent??""}${e}
`;t.logs.textContent=r.length>4e4?r.slice(-4e4):r,t.logs.scrollTop=t.logs.scrollHeight}async function C(){if(i)return;const e=await L({multiple:!1,directory:!1,filters:[{name:"Video files",extensions:A}]});typeof e=="string"&&(v(),u="",E(e),h(g(e)))}async function I(){if(!c||i)return;const e=await x({defaultPath:u||g(c),filters:[{name:"MP4 video",extensions:["mp4"]}]});typeof e=="string"&&(v(),h(e.toLowerCase().endsWith(".mp4")?e:`${e}.mp4`))}function R(){i=!0,v(),t.activity.classList.remove("hidden"),t.statusText.textContent="Starting FFmpeg…",t.statusDot.className="status-dot running",t.progress.className="progress-bar progress-indeterminate",t.elapsed.textContent="",t.logs.textContent="",d()}function S(){i=!1,t.statusText.textContent="Conversion complete",t.statusDot.className="status-dot complete",t.progress.className="progress-bar progress-complete",t.elapsed.textContent="Finished",d()}function w(e){i=!1,t.statusText.textContent="Conversion failed",t.statusDot.className="status-dot failed",t.progress.className="progress-bar progress-failed",t.elapsed.textContent="Stopped",D(e),d()}async function P(){f=await O("conversion-event",({payload:e})=>{if(e.type==="Started"){t.statusText.textContent="Downmixing audio to stereo…",p("FFmpeg process started.");return}if(e.type==="Log"){p(e.data.line);return}if(e.type==="Completed"){S(),t.resultPath.textContent=e.data.output_path,t.result.classList.remove("hidden"),p(`Completed: ${e.data.output_path}`);return}e.type==="Failed"&&(w(e.data.message),p(`ERROR: ${e.data.message}`))})}async function W(){if(!(!c||!u||i)){R();try{const e=await m("convert_to_stereo",{request:{inputPath:c,outputPath:u}});i&&(S(),t.resultPath.textContent=e,t.result.classList.remove("hidden"))}catch(e){const s=typeof e=="string"?e:String(e);i&&(w(s),p(`ERROR: ${s}`))}}}t.dropZone.addEventListener("click",C);t.changeInput.addEventListener("click",C);t.chooseOutput.addEventListener("click",I);t.convert.addEventListener("click",W);P();d();window.addEventListener("beforeunload",()=>{f==null||f()});
