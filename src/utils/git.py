import random
import time
import logging
import functools
import asyncio
import errno
from shlex import quote
from pathlib import Path
from typing import List, Optional, Callable

from .files import *
from src.models import GitError, GitConflictError, GitNotFoundError, GitBranch
from env import *
from src.common import *

_shell_semaphore = asyncio.Semaphore(SHELL_CONCURRENCY_LIMIT)


async def _git(args: List[str], cwd: Optional[Path] = None) -> str:
    try:
        return await _shell("git", args=args, cwd=cwd)
    except Exception as e:
        raise GitError(f"git {' '.join(args)} failed: {e}")


async def _shell(cmd: str, args: List[str] = None, cwd: Optional[Path] = None) -> str:
    args = args or []
    out, err, proc = "", None, None
    while True:
        try:
            async with _shell_semaphore:
                proc = await asyncio.create_subprocess_shell(
                    " ".join([cmd] + args),
                    cwd=str(cwd) if cwd else None,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE)
                out, err = await proc.communicate()
                break
        except OSError as e:
            if e.errno == errno.EMFILE:
                await asyncio.sleep(random.randint(200, 600) / 1000)
                continue
            raise
        except Exception as e:
            raise
    stdout = out.decode().strip()
    stderr = err.decode().strip()
    if proc.returncode != 0:
        raise Exception(f"Shell command failed: {stderr or stdout}")
    return stdout


async def git_clone_shallow(repo_url: str, dest: Path, branch: str, clone_repo_path: str) -> None:
    logging.info(f"git cloning path `{clone_repo_path}` on branch `{branch}` to `{dest}`...")
    if not await asyncio.to_thread(dest.exists):
        await asyncio.to_thread(lambda: dest.mkdir(parents=True, exist_ok=True))

    cmd = f"""
    git clone -n --depth 1 --single-branch --branch {quote(branch)} --filter=tree:0 {repo_url} {quote(str(dest))} && \
    cd {quote(str(dest))} && \
    git sparse-checkout set --cone {quote(clone_repo_path)} && \
    git checkout
    """
    try:
        await _shell(cmd, cwd=dest)
    except Exception as e:
        if "already exists and is not an empty" not in str(e):
            raise
        try:
            await git_force_refetch_shallow(dest, branch, repo_url)
        except Exception:
            raise FileExistsError(f"Destination `{dest}` exists and is not empty")


async def git_commit(repo_path: Path, message: str, email: str, author: str) -> None:
    cmd = f"""
    cd {quote(str(repo_path))} && \
    git add . && \
    git -c user.name={quote(author)} -c user.email={quote(email)} commit -m {quote(message)}
    """
    await _shell(cmd)


async def git_force_refetch_shallow(repo_path: Path, branch: str, origin: str) -> None:
    git_hard_reset = _git(["-C", quote(str(repo_path)), "reset", "--hard", "FETCH_HEAD"])
    try:
        stdout = await _git(["-C", quote(str(repo_path)), "pull", "--ff-only", "--depth", "1", quote(origin), quote(branch)])
    except Exception as e:
        if "not possible to fast-forward" in str(e).lower() or "to merge the remote branch into yours" in str(e).lower():
            await git_hard_reset
            raise GitConflictError(str(e))
        raise

    if "Already up to date" in stdout:
        await git_hard_reset


async def git_push(repo_path: Path, branch: str, origin: str) -> None:
    logging.info(f"git pushing branch `{branch}` from `{repo_path}`...")

    repo_path, origin, branch = quote(str(repo_path)), quote(origin), quote(branch)

    cmd = f"""
    cd {repo_path} && \
    git push {origin} {branch}
    """
    try:
        await _shell(cmd)
    except Exception as e:
        if "non-fast-forward" in str(e) or "fetch first" in str(e):
            raise GitConflictError(str(e))
        raise


async def git_commit_and_push(repo_path: Path, message: str, branch: str, origin: str, email: str, author: str) -> None:
    cmd = f"""
    cd {quote(str(repo_path))} && \
    git add . && \
    git -c user.name={quote(author)} -c user.email={quote(email)} commit -m {quote(message)} || true && \
    git push {quote(origin)} {quote(branch)}
    """
    while True:
        try:
            await _shell(cmd)
            break
        except Exception as e:
            if "your branch is ahead of" in str(e).lower() \
                    or "tip of your current branch is behind" in str(e).lower() \
                    or "to merge the remote branch into yours" in str(e).lower():
                await git_force_refetch_shallow(repo_path, branch, origin)
                await asyncio.sleep(1)
                continue
            raise


async def find_changed_files(repo_path: Path) -> List[str]:
    """
    Return a list of changed file paths in the given repo directory.
    Includes modified (M), added (A), and untracked (??) files.
    """
    # Run `git status --porcelain` in the specified directory
    output = await _git(["status", "--porcelain"], cwd=repo_path)
    paths: List[str] = []
    for line in output.splitlines():
        status = line[:2].strip()
        path = line[len(status)+1:]
        if status in ("M", "A", "??"):
            paths.append(path)
    return paths


async def get_remote_head(repo_path: Path, branch: str, origin: str) -> str:
    """
    Gets the remote HEAD SHA for the given branch.
    """
    output = await _git(["ls-remote", origin, f"refs/heads/{branch}"], cwd=repo_path)
    parts = output.split()
    if not parts:
        raise GitError(f"No output received from git ls-remote for branch '{branch}'")
    return parts[0]


async def get_all_branches(repo_url: str) -> List[str]:
    try:
        output = await _git(["ls-remote", "--heads", repo_url])
    except GitError as e:
        err = str(e)
        if "403" in err or "Forbidden" in err:
            raise PermissionError(f"Permission denied accessing {repo_url}: {e}")
        if "404" in err or "not found" in err.lower():
            raise GitNotFoundError(f"Repository {repo_url} not found: {e}")
        raise

    branches: List[str] = []
    for line in output.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[1].startswith("refs/heads/"):
            branches.append(parts[1].split("refs/heads/")[1])
    return branches


async def find_all_local_branches_in_orgs(*args: Path | str) -> List[Path]:
    """
    Return a list of paths for all branch-level
    directories under the organization's path following the structure org/repo/branch.
    """
    def _scan_candidates() -> List[Path]:
        dirs = []
        org_dirs = [Path(org_dir) for org_dir in args]
        for org_dir in org_dirs:
            dirs += [p for p in org_dir.rglob('*') if p.is_dir() and len(p.relative_to(org_dir).parts) == 2]
        return dirs

    return await asyncio.to_thread(functools.partial(safe_file_op, _scan_candidates))
