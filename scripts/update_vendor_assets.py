#!/usr/bin/env python
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable
from urllib.parse import quote
from urllib.request import Request, urlopen


ROOT_DIR = Path(__file__).resolve().parent.parent
STATIC_VENDOR_DIR = ROOT_DIR / "static" / "vendor"
STATE_FILE = Path(__file__).resolve().with_name("vendor_assets_state.json")

EASYMDE_SPELLCHECK_AFF = "/static/vendor/easymde/spellchecker/en_US.aff"
EASYMDE_SPELLCHECK_DIC = "/static/vendor/easymde/spellchecker/en_US.dic"
LIVE2D_CUBISM_CORE_NOTICE_TEMPLATE = """Live2D Cubism Core

Source URL:
{source_url}

Managed Version:
{version}

License:
This file is proprietary Live2D redistributable code. Keep the original header
inside live2dcubismcore.min.js intact and review the Live2D proprietary software
license agreement before updating or redistributing it:
https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html

Maintenance:
This file is managed by scripts/update_vendor_assets.py using the pinned version
from scripts/vendor_assets_state.json.
"""
LIVE2D_CUBISM_CORE_VERSION_URLS = {
    "5.1.0": "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
}

USER_AGENT = "wacmk-blog-vendor-updater/1.0"
CSS_URL_PATTERN = re.compile(r"url\((?P<quote>['\"]?)(?P<url>[^)\"']+)(?P=quote)\)")
EASYMDE_AFF_URL = "https://cdn.jsdelivr.net/codemirror.spell-checker/latest/en_US.aff"
EASYMDE_DIC_URL = "https://cdn.jsdelivr.net/codemirror.spell-checker/latest/en_US.dic"
PIXI_LIVE2D_BROWSER_PROCESS_TOKEN = "process.env.NODE_ENV"
PIXI_LIVE2D_BROWSER_PROCESS_REPLACEMENT = '"production"'


class ScriptError(RuntimeError):
    pass


@dataclass(frozen=True)
class PackageSpec:
    package: str
    state_key: str


@dataclass(frozen=True)
class ExternalFileSpec:
    name: str
    state_key: str
    filename: str
    url_template: str


@dataclass(frozen=True)
class ResourceSpec:
    name: str
    target_dir: Path
    packages: tuple[PackageSpec, ...]
    builder: Callable[[Path, dict[str, str], "Logger"], None]
    external_files: tuple[ExternalFileSpec, ...] = ()
    preserve_files: tuple[str, ...] = ()
    pin_versions: bool = False


class Logger:
    def __init__(self, verbose: bool = False):
        self.verbose_enabled = verbose

    def info(self, message: str) -> None:
        print(message)

    def verbose(self, message: str) -> None:
        if self.verbose_enabled:
            print(message)

    def warn(self, message: str) -> None:
        print(f"[WARN] {message}")

    def error(self, message: str) -> None:
        print(f"[ERROR] {message}", file=sys.stderr)


def read_json(url: str) -> dict:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request) as response:
        return json.load(response)


def download_file(url: str, destination: Path, logger: Logger) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = Request(url, headers={"User-Agent": USER_AGENT})
    logger.verbose(f"Downloading {url}")
    with urlopen(request) as response, destination.open("wb") as target:
        shutil.copyfileobj(response, target)


def extract_tarball(tarball: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(tarball, "r:gz") as archive:
        archive.extractall(destination, filter="data")


def npm_metadata_url(package_name: str) -> str:
    return f"https://registry.npmjs.org/{quote(package_name, safe='')}"


def resolve_latest_package(package_name: str) -> tuple[str, str]:
    metadata = read_json(npm_metadata_url(package_name))
    version = metadata["dist-tags"]["latest"]
    tarball = metadata["versions"][version]["dist"]["tarball"]
    return version, tarball


def resolve_external_file_url(external_file: ExternalFileSpec, version: str) -> str:
    if external_file.state_key == "live2d_cubism_core":
        source_url = LIVE2D_CUBISM_CORE_VERSION_URLS.get(version)
        if not source_url:
            raise ScriptError(
                f"Unsupported {external_file.name} version {version!r}. Add it to LIVE2D_CUBISM_CORE_VERSION_URLS first."
            )
        return source_url
    return external_file.url_template.format(version=version)


def resolve_package_version(package_name: str, state_key: str, state: dict[str, str], logger: Logger, *, pinned: bool = False) -> tuple[str, str]:
    if not pinned:
        latest_version, tarball = resolve_latest_package(package_name)
        logger.info(f"Latest: {package_name} -> {latest_version}")
        return latest_version, tarball
    pinned_version = state.get(state_key)
    if pinned_version:
        metadata = read_json(npm_metadata_url(package_name))
        version_metadata = metadata.get("versions", {}).get(pinned_version)
        tarball = version_metadata.get("dist", {}).get("tarball") if isinstance(version_metadata, dict) else None
        if tarball:
            logger.info(f"Latest: {package_name} -> {pinned_version} (pinned)")
            return pinned_version, tarball
    latest_version, tarball = resolve_latest_package(package_name)
    logger.info(f"Latest: {package_name} -> {latest_version}")
    return latest_version, tarball


def parse_semver_major(version: str | None) -> int | None:
    if not version:
        return None
    match = re.match(r"^(\d+)", version)
    if not match:
        return None
    return int(match.group(1))


def copy_file(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def copy_tree(source: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for path in source.rglob("*"):
        if path.is_dir():
            continue
        relative = path.relative_to(source)
        copy_file(path, destination / relative)


def replace_in_file(path: Path, replacements: dict[str, str]) -> None:
    content = path.read_text(encoding="utf-8")
    for source, target in replacements.items():
        content = content.replace(source, target)
    path.write_text(content, encoding="utf-8")


def validate_css_urls(resource_name: str, resource_root: Path) -> None:
    for css_file in resource_root.rglob("*.css"):
        content = css_file.read_text(encoding="utf-8")
        for match in CSS_URL_PATTERN.finditer(content):
            url = match.group("url").strip()
            if not url or url.startswith(("data:", "http://", "https://", "/")):
                continue
            candidate = (css_file.parent / url).resolve()
            if not candidate.exists():
                raise ScriptError(
                    f"{resource_name}: missing CSS dependency {url!r} referenced by {css_file.relative_to(resource_root)}"
                )


def compare_directories(existing: Path, staged: Path) -> tuple[list[Path], list[Path], list[Path]]:
    existing_files: set[Path] = set()
    staged_files: set[Path] = set()
    if existing.exists():
        existing_files = {path.relative_to(existing) for path in existing.rglob("*") if path.is_file()}
    staged_files = {path.relative_to(staged) for path in staged.rglob("*") if path.is_file()}

    added = sorted(staged_files - existing_files)
    removed = sorted(existing_files - staged_files)
    changed: list[Path] = []
    for relative in sorted(staged_files & existing_files):
        if (existing / relative).read_bytes() != (staged / relative).read_bytes():
            changed.append(relative)
    return added, changed, removed


def summarize_changes(resource_name: str, target_dir: Path, staged_dir: Path, logger: Logger) -> None:
    added, changed, removed = compare_directories(target_dir, staged_dir)
    logger.info(
        f"[{resource_name}] plan: {len(added)} add, {len(changed)} update, {len(removed)} remove"
    )
    if logger.verbose_enabled:
        for label, items in (("ADD", added), ("UPDATE", changed), ("REMOVE", removed)):
            for relative in items:
                logger.verbose(f"[{resource_name}] {label} {relative.as_posix()}")


def apply_resource(resource_name: str, target_dir: Path, staged_dir: Path, logger: Logger) -> None:
    resource = RESOURCE_SPECS[resource_name]
    preserved_files: dict[str, bytes] = {}
    if target_dir.exists():
        for relative_name in resource.preserve_files:
            existing_path = target_dir / relative_name
            if existing_path.exists() and existing_path.is_file():
                preserved_files[relative_name] = existing_path.read_bytes()
        shutil.rmtree(target_dir)
    shutil.copytree(staged_dir, target_dir)
    for relative_name, content in preserved_files.items():
        destination = target_dir / relative_name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
    logger.info(f"[{resource_name}] applied to {target_dir.relative_to(ROOT_DIR).as_posix()}")


def require_file(path: Path, description: str) -> Path:
    if not path.exists():
        raise ScriptError(f"Missing expected file: {description} ({path})")
    return path


def stage_fontawesome(output_root: Path, extracted: dict[str, str], logger: Logger) -> None:
    package_dir = Path(extracted["fontawesome"]) / "package"
    copy_file(require_file(package_dir / "css" / "all.min.css", "Font Awesome CSS"), output_root / "css" / "all.min.css")
    copy_file(require_file(package_dir / "LICENSE.txt", "Font Awesome license"), output_root / "LICENSE.txt")
    webfonts_dir = require_file(package_dir / "webfonts", "Font Awesome webfonts directory")
    copy_tree(webfonts_dir, output_root / "webfonts")
    validate_css_urls("fontawesome", output_root)
    logger.verbose("Prepared Font Awesome assets")


def stage_easymde(output_root: Path, extracted: dict[str, str], logger: Logger) -> None:
    package_dir = Path(extracted["easymde"]) / "package"
    spellchecker_dir = Path(extracted["spellchecker"]) / "package" / "dist"
    copy_file(require_file(package_dir / "dist" / "easymde.min.css", "EasyMDE CSS"), output_root / "easymde.min.css")
    copy_file(require_file(package_dir / "dist" / "easymde.min.js", "EasyMDE JS"), output_root / "easymde.min.js")
    copy_file(require_file(package_dir / "LICENSE", "EasyMDE license"), output_root / "LICENSE")
    copy_file(require_file((Path(extracted["spellchecker"]) / "package" / "LICENSE"), "Spellchecker license"), output_root / "LICENSE-spellchecker")
    copy_file(require_file(spellchecker_dir / "en_US.aff", "Spellchecker aff"), output_root / "spellchecker" / "en_US.aff")
    copy_file(require_file(spellchecker_dir / "en_US.dic", "Spellchecker dic"), output_root / "spellchecker" / "en_US.dic")
    replace_in_file(
        output_root / "easymde.min.js",
        {
            EASYMDE_AFF_URL: EASYMDE_SPELLCHECK_AFF,
            EASYMDE_DIC_URL: EASYMDE_SPELLCHECK_DIC,
        },
    )
    validate_css_urls("easymde", output_root)
    patched_content = (output_root / "easymde.min.js").read_text(encoding="utf-8")
    if EASYMDE_AFF_URL in patched_content or EASYMDE_DIC_URL in patched_content:
        raise ScriptError("easymde: spellchecker CDN URL replacement did not complete")
    logger.verbose("Prepared EasyMDE assets with local spellchecker patch")


def stage_katex(output_root: Path, extracted: dict[str, str], logger: Logger) -> None:
    package_dir = Path(extracted["katex"]) / "package"
    dist_dir = package_dir / "dist"
    copy_file(require_file(dist_dir / "katex.min.css", "KaTeX CSS"), output_root / "katex.min.css")
    copy_file(require_file(dist_dir / "katex.min.js", "KaTeX JS"), output_root / "katex.min.js")
    copy_file(require_file(dist_dir / "contrib" / "auto-render.min.js", "KaTeX auto-render"), output_root / "contrib" / "auto-render.min.js")
    copy_file(require_file(package_dir / "LICENSE", "KaTeX license"), output_root / "LICENSE")
    fonts_dir = require_file(dist_dir / "fonts", "KaTeX fonts directory")
    copy_tree(fonts_dir, output_root / "fonts")
    validate_css_urls("katex", output_root)
    logger.verbose("Prepared KaTeX assets")


def minimize_font_css_block(css_text: str) -> tuple[str, list[str]]:
    compact = re.sub(r",\s*url\([^)]*\.woff\) format\(['\"]woff['\"]\)", "", css_text.strip())
    filenames = re.findall(r"url\(\.\/files\/([^)]*?\.woff2)\)", compact)
    return compact, filenames


def build_fonts_css(extracted: dict[str, str]) -> tuple[str, list[str]]:
    output_blocks: list[str] = []
    filenames: list[str] = []

    baloo_dir = Path(extracted["fontsource_baloo_2"]) / "package"
    noto_dir = Path(extracted["fontsource_noto_sans_sc"]) / "package"

    baloo_weights = [400, 500, 600, 700, 800]
    baloo_subsets = ["latin-ext", "latin"]
    for weight in baloo_weights:
        for subset in baloo_subsets:
            css_file = baloo_dir / f"{subset}-{weight}.css"
            compact, block_filenames = minimize_font_css_block(require_file(css_file, f"Baloo 2 {subset}-{weight} css").read_text(encoding="utf-8"))
            output_blocks.append(compact)
            filenames.extend(block_filenames)

    noto_weights = [400, 500, 600, 700, 800]
    noto_subsets = ["latin-ext", "latin", "chinese-simplified"]
    for weight in noto_weights:
        for subset in noto_subsets:
            css_file = noto_dir / f"{subset}-{weight}.css"
            compact, block_filenames = minimize_font_css_block(require_file(css_file, f"Noto Sans SC {subset}-{weight} css").read_text(encoding="utf-8"))
            output_blocks.append(compact)
            filenames.extend(block_filenames)

    unique_filenames = list(dict.fromkeys(filenames))
    return "\n\n".join(output_blocks) + "\n", unique_filenames


def stage_fonts(output_root: Path, extracted: dict[str, str], logger: Logger) -> None:
    css_text, filenames = build_fonts_css(extracted)
    (output_root / "files").mkdir(parents=True, exist_ok=True)
    (output_root / "fonts.css").write_text(css_text, encoding="utf-8")

    baloo_files = Path(extracted["fontsource_baloo_2"]) / "package" / "files"
    noto_files = Path(extracted["fontsource_noto_sans_sc"]) / "package" / "files"

    for filename in filenames:
        source = baloo_files / filename
        if not source.exists():
            source = noto_files / filename
        copy_file(require_file(source, f"Font file {filename}"), output_root / "files" / filename)

    copy_file(require_file(Path(extracted["fontsource_baloo_2"]) / "package" / "LICENSE", "Baloo 2 license"), output_root / "LICENSE-baloo-2")
    copy_file(require_file(Path(extracted["fontsource_noto_sans_sc"]) / "package" / "LICENSE", "Noto Sans SC license"), output_root / "LICENSE-noto-sans-sc")
    validate_css_urls("fonts", output_root)
    logger.verbose("Prepared local font assets")


def stage_live2d_runtime(output_root: Path, extracted: dict[str, str], logger: Logger) -> None:
    pixi_package_dir = Path(extracted["pixi_js"]) / "package"
    live2d_package_dir = Path(extracted["pixi_live2d_display"]) / "package"
    cubism_core_path = Path(extracted["live2d_cubism_core"])
    cubism_core_version = extracted.get("live2d_cubism_core_version", "unknown")
    cubism_core_source_url = extracted.get("live2d_cubism_core_source_url", "")
    pixi_bundle_path = pixi_package_dir / "dist" / "browser" / "pixi.min.js"
    if not pixi_bundle_path.exists():
        pixi_bundle_path = require_file(pixi_package_dir / "dist" / "pixi.min.js", "PixiJS browser bundle")
    copy_file(pixi_bundle_path, output_root / "pixi.min.js")
    copy_file(require_file(pixi_package_dir / "LICENSE", "PixiJS license"), output_root / "LICENSE-pixi.js")
    copy_file(require_file(live2d_package_dir / "dist" / "cubism4.min.js", "pixi-live2d-display cubism4 bundle"), output_root / "cubism4.min.js")
    copy_file(require_file(live2d_package_dir / "LICENSE", "pixi-live2d-display license"), output_root / "LICENSE-pixi-live2d-display")
    replace_in_file(
        output_root / "cubism4.min.js",
        {
            PIXI_LIVE2D_BROWSER_PROCESS_TOKEN: PIXI_LIVE2D_BROWSER_PROCESS_REPLACEMENT,
        },
    )
    patched_renderer = (output_root / "cubism4.min.js").read_text(encoding="utf-8")
    if PIXI_LIVE2D_BROWSER_PROCESS_TOKEN in patched_renderer:
        raise ScriptError("live2d_runtime: browser compatibility patch for cubism4.min.js did not complete")
    cubism_core_content = require_file(cubism_core_path, "Live2D Cubism Core bundle").read_text(encoding="utf-8")
    if "Live2D Cubism Core" not in cubism_core_content or "Redistributable Code" not in cubism_core_content:
        raise ScriptError("live2d_runtime: downloaded live2dcubismcore.min.js is missing the expected license header")
    copy_file(cubism_core_path, output_root / "live2dcubismcore.min.js")
    (output_root / "NOTICE-live2dcubismcore.txt").write_text(
        LIVE2D_CUBISM_CORE_NOTICE_TEMPLATE.format(
            source_url=cubism_core_source_url,
            version=cubism_core_version,
        ),
        encoding="utf-8",
    )
    logger.verbose("Prepared Live2D runtime assets")


RESOURCE_SPECS: dict[str, ResourceSpec] = {
    "fontawesome": ResourceSpec(
        name="fontawesome",
        target_dir=STATIC_VENDOR_DIR / "fontawesome",
        packages=(PackageSpec("@fortawesome/fontawesome-free", "fontawesome"),),
        builder=stage_fontawesome,
    ),
    "easymde": ResourceSpec(
        name="easymde",
        target_dir=STATIC_VENDOR_DIR / "easymde",
        packages=(
            PackageSpec("easymde", "easymde"),
            PackageSpec("codemirror-spell-checker", "spellchecker"),
        ),
        builder=stage_easymde,
    ),
    "katex": ResourceSpec(
        name="katex",
        target_dir=STATIC_VENDOR_DIR / "katex",
        packages=(PackageSpec("katex", "katex"),),
        builder=stage_katex,
    ),
    "fonts": ResourceSpec(
        name="fonts",
        target_dir=STATIC_VENDOR_DIR / "fonts",
        packages=(
            PackageSpec("@fontsource/baloo-2", "fontsource_baloo_2"),
            PackageSpec("@fontsource/noto-sans-sc", "fontsource_noto_sans_sc"),
        ),
        builder=stage_fonts,
    ),
    "live2d_runtime": ResourceSpec(
        name="live2d_runtime",
        target_dir=STATIC_VENDOR_DIR / "live2d-runtime",
        packages=(
            PackageSpec("pixi.js", "pixi_js"),
            PackageSpec("pixi-live2d-display", "pixi_live2d_display"),
        ),
        external_files=(
            ExternalFileSpec(
                name="live2dcubismcore.min.js",
                state_key="live2d_cubism_core",
                filename="live2dcubismcore.min.js",
                url_template="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
            ),
        ),
        builder=stage_live2d_runtime,
        pin_versions=True,
    ),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update vendored static assets under static/vendor.")
    parser.add_argument(
        "--resource",
        action="append",
        choices=["all", *RESOURCE_SPECS.keys()],
        help="Resource to update. Repeat for multiple resources. Defaults to all.",
    )
    parser.add_argument("--apply", action="store_true", help="Write the updated assets into the repository.")
    parser.add_argument("--allow-major", action="store_true", help="Allow automatic upgrades across major versions.")
    parser.add_argument("--work-dir", help="Optional working directory for downloaded and extracted packages.")
    parser.add_argument("--verbose", action="store_true", help="Show verbose progress output.")
    return parser.parse_args()


def normalize_resources(raw_resources: list[str] | None) -> list[ResourceSpec]:
    if not raw_resources or "all" in raw_resources:
        return [RESOURCE_SPECS[name] for name in ("fontawesome", "easymde", "katex", "fonts", "live2d_runtime")]
    ordered: list[ResourceSpec] = []
    seen: set[str] = set()
    for name in raw_resources:
        if name in seen:
            continue
        seen.add(name)
        ordered.append(RESOURCE_SPECS[name])
    return ordered


def load_state() -> dict[str, str]:
    if not STATE_FILE.exists():
        raise ScriptError(f"Missing state file: {STATE_FILE}")
    return json.loads(STATE_FILE.read_text(encoding="utf-8"))


def save_state(state: dict[str, str]) -> None:
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")


def check_major_upgrade(package_name: str, state_key: str, current_version: str | None, next_version: str, allow_major: bool) -> None:
    current_major = parse_semver_major(current_version)
    next_major = parse_semver_major(next_version)
    if current_major is None or next_major is None:
        return
    if next_major > current_major and not allow_major:
        raise ScriptError(
            f"{package_name} would upgrade from {current_version} to {next_version}. Re-run with --allow-major to continue."
        )


def current_version_summary(resource: ResourceSpec, state: dict[str, str]) -> str:
    parts = []
    for package in resource.packages:
        parts.append(f"{package.package}={state.get(package.state_key, 'unknown')}")
    for external_file in resource.external_files:
        parts.append(f"{external_file.name}={state.get(external_file.state_key, 'unknown')}")
    return ", ".join(parts)


def latest_version_summary(versions: dict[str, str], resource: ResourceSpec) -> str:
    parts = []
    for package in resource.packages:
        parts.append(f"{package.package}={versions[package.state_key]}")
    for external_file in resource.external_files:
        parts.append(f"{external_file.name}={versions[external_file.state_key]}")
    return ", ".join(parts)


def update_resources(resources: Iterable[ResourceSpec], apply: bool, allow_major: bool, work_dir: Path | None, logger: Logger) -> None:
    state = load_state()
    updated_state = dict(state)

    cleanup_temp = work_dir is None
    temp_dir = Path(tempfile.mkdtemp(prefix="vendor-assets-", dir=work_dir)) if cleanup_temp else Path(work_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)
    logger.verbose(f"Working directory: {temp_dir}")

    try:
        for resource in resources:
            logger.info(f"\n== {resource.name} ==")
            logger.info(f"Current: {current_version_summary(resource, state)}")

            downloaded_versions: dict[str, str] = {}
            extracted_roots: dict[str, str] = {}
            for package in resource.packages:
                latest_version, tarball_url = resolve_package_version(
                    package.package,
                    package.state_key,
                    state,
                    logger,
                    pinned=resource.pin_versions,
                )
                check_major_upgrade(
                    package.package,
                    package.state_key,
                    state.get(package.state_key),
                    latest_version,
                    allow_major,
                )
                downloaded_versions[package.state_key] = latest_version

                tarball_path = temp_dir / f"{package.state_key}-{latest_version}.tgz"
                extract_dir = temp_dir / f"extract-{package.state_key}-{latest_version}"
                if tarball_path.exists():
                    tarball_path.unlink()
                if extract_dir.exists():
                    shutil.rmtree(extract_dir)
                download_file(tarball_url, tarball_path, logger)
                extract_tarball(tarball_path, extract_dir)
                extracted_roots[package.state_key] = str(extract_dir)

            for external_file in resource.external_files:
                pinned_version = state.get(external_file.state_key)
                if not pinned_version:
                    raise ScriptError(
                        f"Missing pinned version for {external_file.name} in {STATE_FILE.relative_to(ROOT_DIR).as_posix()}"
                    )
                source_url = resolve_external_file_url(external_file, pinned_version)
                downloaded_versions[external_file.state_key] = pinned_version
                destination_path = temp_dir / f"{external_file.state_key}-{pinned_version}-{external_file.filename}"
                if destination_path.exists():
                    destination_path.unlink()
                download_file(source_url, destination_path, logger)
                extracted_roots[external_file.state_key] = str(destination_path)
                extracted_roots[f"{external_file.state_key}_version"] = pinned_version
                extracted_roots[f"{external_file.state_key}_source_url"] = source_url

            staged_dir = temp_dir / f"staged-{resource.name}"
            if staged_dir.exists():
                shutil.rmtree(staged_dir)
            resource.builder(staged_dir, extracted_roots, logger)

            summarize_changes(resource.name, resource.target_dir, staged_dir, logger)
            logger.info(f"Target: {latest_version_summary(downloaded_versions, resource)}")

            if apply:
                apply_resource(resource.name, resource.target_dir, staged_dir, logger)
                for package in resource.packages:
                    updated_state[package.state_key] = downloaded_versions[package.state_key]
                for external_file in resource.external_files:
                    updated_state[external_file.state_key] = downloaded_versions[external_file.state_key]
            else:
                logger.info(f"[{resource.name}] dry-run only; use --apply to write changes")

        if apply:
            save_state(updated_state)
            logger.info(f"\nUpdated {STATE_FILE.relative_to(ROOT_DIR).as_posix()}")
    finally:
        if cleanup_temp:
            shutil.rmtree(temp_dir, ignore_errors=True)


def main() -> int:
    args = parse_args()
    logger = Logger(verbose=args.verbose)

    try:
        resources = normalize_resources(args.resource)
        work_dir = Path(args.work_dir).resolve() if args.work_dir else None
        update_resources(resources, apply=args.apply, allow_major=args.allow_major, work_dir=work_dir, logger=logger)
    except ScriptError as exc:
        logger.error(str(exc))
        return 1
    except KeyboardInterrupt:
        logger.error("Interrupted")
        return 130
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
