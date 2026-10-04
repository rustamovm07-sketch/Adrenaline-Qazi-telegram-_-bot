"""Safe filesystem resolution for private uploaded media."""

from pathlib import Path


def is_owned_media(filename: str, telegram_id: int) -> bool:
    return filename.startswith(f"{telegram_id}_")


def resolve_upload_file(root: Path, filename: str) -> Path | None:
    """Resolve a generated filename and reject traversal and symlink escape."""
    if (
        not filename
        or filename in {".", ".."}
        or Path(filename).name != filename
        or "/" in filename
        or "\\" in filename
    ):
        return None
    trusted_root = root.resolve()
    candidate = (trusted_root / filename).resolve()
    try:
        candidate.relative_to(trusted_root)
    except ValueError:
        return None
    return candidate if candidate.is_file() else None
