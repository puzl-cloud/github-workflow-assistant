import textwrap
import re
from pathlib import Path
from typing import Set

WORKFLOW_DIR = ".github/workflows"


def extract_runs_on_labels(workflow_yaml: str) -> Set[str]:
    labels = set()
    lines = textwrap.dedent(workflow_yaml).splitlines()
    in_jobs = False
    jobs_indent = 0
    in_job = False
    job_indent = 0

    for i, line in enumerate(lines):
        stripped = line.lstrip()
        indent = len(line) - len(stripped)

        # Enter jobs section
        if not in_jobs and re.match(r'^\s*jobs\s*:\s*$', line):
            in_jobs = True
            jobs_indent = indent
            continue

        # Exit jobs section only on non-blank lines at or above jobs indent
        if in_jobs and indent <= jobs_indent and stripped and not re.match(r'^\s*jobs\s*:\s*$', line):
            in_jobs = False
            in_job = False

        if not in_jobs:
            continue

        # Detect job entry: one level deeper than jobs
        if indent == jobs_indent + 2 and re.match(r'^\s+[\w-]+:\s*$', line):
            in_job = True
            job_indent = indent
            continue

        # Exit job block only on non-blank lines at or above job indent
        if in_job and indent <= job_indent and stripped:
            in_job = False

        # Within job, detect runs-on
        if in_job and stripped.startswith('runs-on:') and indent > job_indent:
            # Strip inline comment from the entire value
            raw = stripped.split('runs-on:', 1)[1].split('#', 1)[0].strip()

            # Inline list (flow sequence)
            if raw.startswith('[') and raw.endswith(']'):
                content = raw[1:-1]
                for part in content.split(','):
                    item = part.strip().strip('\'"')
                    if item:
                        labels.add(item)

            # Single value
            elif raw:
                part = raw.strip('\'"')
                labels.add(part)

            # Multi-line list
            else:
                for sub in lines[i+1:]:
                    sub_stripped = sub.lstrip()
                    sub_indent = len(sub) - len(sub_stripped)
                    if sub_indent <= indent:
                        break
                    if sub_stripped.startswith('-'):
                        item = sub_stripped[1:].split('#', 1)[0].strip().strip('\'"')
                        if item:
                            labels.add(item)
    return labels


def git_branch_by_full_path(path: Path | str, base_dir: Path | str, repo_content_prefix: Path | str = None) -> str:
    repo_content_prefix = Path(repo_content_prefix) if repo_content_prefix else None
    relative_path, branch_with_repo =  Path(path).relative_to(base_dir), None

    # Branch name could contain slashes, process it properly
    if repo_content_prefix:
        for idx in range(len(relative_path.parts) - len(repo_content_prefix.parts) + 1):
            if relative_path.parts[idx:idx + len(repo_content_prefix.parts)] == repo_content_prefix.parts:
                branch_with_repo = Path(*relative_path.parts[:idx])
                break

    # drop the first two segments (org/name)
    parts_after_org = (branch_with_repo or relative_path).parts[2:]
    return str(Path(*parts_after_org)) if parts_after_org else "."
