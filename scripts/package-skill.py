#!/usr/bin/env python3
"""Build an offline, reproducible ZIP with SKILL.md at the archive root.

Only the Git publication candidate under skills/vvv is included. The archive
contains the portable skill, not the Remotion kit or rendered example media.
Existing output files are never overwritten. In a repository with commits, the
skill directory must match HEAD (no uncommitted or untracked, non-ignored
changes) unless --allow-dirty is given, so a release ZIP matches a commit.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile


def checker_module():
    spec = importlib.util.spec_from_file_location(
        'vvv_repository_checker', Path(__file__).with_name('check-repository.py'))
    checker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(checker)
    return checker


def package_files(root, checker):
    candidates = {path for path in checker.publication_files(root) if checker.SKILL in path.parents}
    errors = []
    for name in checker.REQUIRED:
        path = Path(name)
        if checker.SKILL in path.parents and path not in candidates:
            errors.append('%s: required skill file is missing or unpublished' % path)
    private_parts = checker.PRIVATE_PARTS | {'.git', '.work', '.agents', '.claude', '.codex', '.codebuddy', '.workbuddy'}
    for relative in sorted(candidates):
        source = root / relative
        private_config = (relative.name == '.env' or relative.name.startswith('.env.') or
                          relative.name in {'auth.json', 'credentials.json', 'settings.local.json'})
        if private_config or private_parts.intersection(relative.parts):
            errors.append('%s: private or generated material cannot be packaged' % relative)
        if any((root / part).is_symlink() for part in (relative, *relative.parents)):
            errors.append('%s: symbolic links cannot be packaged' % relative)
        elif not source.is_file() or not source.resolve().is_relative_to(root / checker.SKILL):
            errors.append('%s: skill files must be available regular files inside skills/vvv' % relative)
    # Check containment before any checker reads file contents.
    if not errors:
        checker.check_skill(root, candidates, errors)
        checker.check_links(root, candidates, errors)
        checker.check_vendor(root, candidates, errors)
    if errors:
        raise ValueError('\n'.join(errors))
    return sorted(candidates)


def dirty_skill_files(root, checker):
    """Uncommitted or untracked, non-ignored paths under skills/vvv; empty before the first commit."""
    head = subprocess.run(['git', '-C', str(root), 'rev-parse', '--verify', '--quiet', 'HEAD'],
                          capture_output=True)
    if head.returncode:
        return []
    result = subprocess.run(
        ['git', '-C', str(root), 'status', '--porcelain', '-z', '--untracked-files=all', '--',
         checker.SKILL.as_posix()], check=True, capture_output=True)
    entries = iter(os.fsdecode(item) for item in result.stdout.split(b'\0') if item)
    dirty = []
    for entry in entries:
        dirty.append(entry[3:])
        if entry[0] in 'RC':
            next(entries, None)  # a rename or copy is followed by its original path
    return dirty


def build_archive(root, output, allow_dirty=False):
    if output.exists() or output.is_symlink():
        raise ValueError('output already exists: %s' % output)
    checker = checker_module()
    if not allow_dirty:
        dirty = dirty_skill_files(root, checker)
        if dirty:
            shown = ', '.join(dirty[:10]) + (' ...' if len(dirty) > 10 else '')
            raise ValueError('skills/vvv has uncommitted or untracked changes (%s); commit them first, '
                             'or pass --allow-dirty for a local test build' % shown)
    candidates = package_files(root, checker)
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix='.vvv-skill-', suffix='.tmp', dir=output.parent)
    temporary = Path(temporary_name)
    os.close(descriptor)
    try:
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for relative in candidates:
                entry = zipfile.ZipInfo(relative.relative_to(checker.SKILL).as_posix(), (1980, 1, 1, 0, 0, 0))
                entry.create_system = 3
                entry.external_attr = 0o100644 << 16
                entry.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(entry, (root / relative).read_bytes(), compresslevel=9)
        digest = hashlib.sha256(temporary.read_bytes()).hexdigest()
        # Publish the completed file atomically; link refuses a concurrently created output.
        os.link(temporary, output)
    finally:
        temporary.unlink()
    return {'path': str(output), 'sha256': digest, 'file_count': len(candidates)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1],
                        help='Git repository root (defaults to the checkout containing this script)')
    parser.add_argument('--output', type=Path, required=True, help='new ZIP path, relative to the current directory')
    parser.add_argument('--allow-dirty', action='store_true',
                        help='package uncommitted or untracked skill changes (local test builds only)')
    args = parser.parse_args()
    try:
        result = build_archive(args.root.resolve(), args.output.absolute(), args.allow_dirty)
    except (OSError, UnicodeError, ValueError, subprocess.SubprocessError) as error:
        print('FAIL: %s' % error, file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == '__main__':
    sys.exit(main())
