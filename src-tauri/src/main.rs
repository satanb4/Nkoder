#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use tauri::{command, Emitter, Runtime};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConvertRequest {
    pub input_path: String,
    pub output_path: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", content = "data")]
pub enum ConvertEvent {
    Started,
    Progress { line: String },
    Completed { output_path: String },
    Error { message: String },
}

#[command]
async fn convert_audio_to_stereo<R: Runtime>(
    app: tauri::AppHandle<R>,
    req: ConvertRequest,
) -> Result<String, String> {
    let input = PathBuf::from(&req.input_path);
    let output = PathBuf::from(&req.output_path);

    if !input.exists() {
        return Err(format!(
            "Input file does not exist: {}",
            input.display()
        ));
    }

    if let Some(parent) = output.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("Could not create output directory: {error}"))?;
        }
    }

    let output_path = req.output_path.clone();

    let mut command = Command::new("ffmpeg");
    command
        .arg("-y")
        .arg("-i")
        .arg(&input)
        .arg("-c:v")
        .arg("copy")
        .arg("-c:a")
        .arg("aac")
        .arg("-ac")
        .arg("2")
        .arg("-ar")
        .arg("44100")
        .arg("-b:a")
        .arg("256k")
        .arg(&output)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| {
            format!(
                "Could not start FFmpeg. Ensure FFmpeg is installed and available on PATH. Details: {error}"
            )
        })?;

    app.emit("convert-event", ConvertEvent::Started)
        .map_err(|error| format!("Could not emit start event: {error}"))?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Could not read FFmpeg diagnostic output.".to_string())?;

    let progress_app = app.clone();

    let stderr_task = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let _ = progress_app.emit(
                "convert-event",
                ConvertEvent::Progress { line },
            );
        }
    });

    let status = child
        .wait()
        .await
        .map_err(|error| format!("FFmpeg process failed unexpectedly: {error}"))?;

    let _ = stderr_task.await;

    if !status.success() {
        let exit_code = status
            .code()
            .map(|code| code.to_string())
            .unwrap_or_else(|| "terminated by signal".to_string());

        let message = format!("FFmpeg conversion failed (exit code: {exit_code}).");

        let _ = app.emit(
            "convert-event",
            ConvertEvent::Error {
                message: message.clone(),
            },
        );

        return Err(message);
    }

    app.emit(
        "convert-event",
        ConvertEvent::Completed {
            output_path: output_path.clone(),
        },
    )
    .map_err(|error| format!("Could not emit completion event: {error}"))?;

    Ok(output_path)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![convert_audio_to_stereo])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}