use gpui::{Context, IntoElement, Render, Task, Window};
use kit_ui_gpui::theme::label;
use std::time::Duration;

pub struct RuntimeStats {
    executable_bytes: Option<u64>,
    resident_bytes: Option<u64>,
    _refresh: Task<()>,
}

impl RuntimeStats {
    pub fn new(cx: &mut Context<Self>) -> Self {
        let refresh = cx.spawn(async move |this, cx| {
            loop {
                cx.background_executor().timer(Duration::from_secs(1)).await;
                if this
                    .update(cx, |this, cx| {
                        this.executable_bytes = executable_bytes();
                        this.resident_bytes = resident_bytes();
                        cx.notify();
                    })
                    .is_err()
                {
                    break;
                }
            }
        });
        Self {
            executable_bytes: executable_bytes(),
            resident_bytes: resident_bytes(),
            _refresh: refresh,
        }
    }
}

impl Render for RuntimeStats {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let build = if cfg!(debug_assertions) {
            "Debug"
        } else {
            "Release"
        };
        label(
            format!(
                "{build} · Executable: {} · Memory (resident): {}",
                format_bytes(self.executable_bytes),
                format_bytes(self.resident_bytes),
            ),
            cx,
        )
    }
}

fn executable_bytes() -> Option<u64> {
    std::env::current_exe()
        .ok()
        .and_then(|path| std::fs::metadata(path).ok())
        .map(|metadata| metadata.len())
}

fn format_bytes(bytes: Option<u64>) -> String {
    bytes
        .map(|bytes| format!("{:.1} MiB", bytes as f64 / (1024. * 1024.)))
        .unwrap_or_else(|| "unavailable".into())
}

#[cfg(target_os = "macos")]
#[allow(deprecated)] // libc exports the macOS task port but recommends a separate Mach crate.
fn resident_bytes() -> Option<u64> {
    let mut info = std::mem::MaybeUninit::<libc::mach_task_basic_info>::uninit();
    let mut count = libc::MACH_TASK_BASIC_INFO_COUNT;
    // task_info fills exactly the structure identified by this flavor and count.
    let status = unsafe {
        libc::task_info(
            libc::mach_task_self_,
            libc::MACH_TASK_BASIC_INFO,
            info.as_mut_ptr().cast(),
            &mut count,
        )
    };
    if status == libc::KERN_SUCCESS && count == libc::MACH_TASK_BASIC_INFO_COUNT {
        Some(unsafe { info.assume_init() }.resident_size)
    } else {
        None
    }
}

#[cfg(not(target_os = "macos"))]
fn resident_bytes() -> Option<u64> {
    None
}
