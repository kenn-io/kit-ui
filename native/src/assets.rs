use gpui::{AssetSource, SharedString};
use std::{borrow::Cow, path::Path};

/// Assets are read from the experiment checkout, never an installed app directory.
pub struct Assets;
impl AssetSource for Assets {
    fn load(&self, path: &str) -> gpui::Result<Option<Cow<'static, [u8]>>> {
        let path = Path::new(path);
        let path = if path.is_absolute() {
            path.to_path_buf()
        } else {
            Path::new(env!("CARGO_MANIFEST_DIR")).join(path)
        };
        Ok(Some(Cow::Owned(std::fs::read(path)?)))
    }
    fn list(&self, _: &str) -> gpui::Result<Vec<SharedString>> {
        Ok(vec![])
    }
}
