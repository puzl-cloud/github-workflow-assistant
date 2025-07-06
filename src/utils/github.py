import base64
import time
import textwrap
import asyncio
import functools
import itertools
import re
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Callable, Union
from http import HTTPMethod
from dataclasses import dataclass

import aiohttp

from src.utils.http import *
from src.utils.git import *
from src.models import GitBranch, GitHubRepo, Token, GitHubWorkflow
from env import *


_file_semaphore = asyncio.Semaphore(50)


async def github_request(
        method: HTTPMethod, endpoint: str, bearer_token: str = None,
        data: Optional[Dict[str, Any]] = None, retry_timeout: int = 5, max_attempts: int = 1,
        log_success: bool = False, accept_codes: List[int] | Callable = None, log_data: bool = False,
        log_response_body: bool = False) -> Dict | List:
    default_headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    headers = {"Authorization": f"Bearer {bearer_token}"} if bearer_token else {}
    response = await rest_api_request(
        method, endpoint, api_name="GitHub", default_headers=default_headers, headers=headers, data=data,
        retry_timeout=retry_timeout, max_attempts=max_attempts, log_success=log_success,
        accept_codes=accept_codes, log_data=log_data, retry_codes=[429, 500, 501, 502, 503, 504],
        log_response_body=log_response_body)
    if response and "error" in response:
        message = response.get("error_description", "")
        if "error_uri" in response:
            message += f" Additional information: {response.get('error_uri')}"
        raise RESTAPIError(status=400, response_text=response["error"], message=message)
    return response


#
# Native git functions
#
def github_repo_url(repo: str, token: Token = None) -> str:
    return f"https://x-access-token:{token.value}@github.com/{repo}.git"


async def github_clone_shallow(repo: str, branch: str, subdir: str, token: Token, dest: Path) -> None:
    logging.info(f"Shallow cloning branch `{branch}` of `{repo}`...")
    repo_path = github_repo_url(repo, token)
    try:
        await git_clone_shallow(repo_path, dest, branch, subdir)
    except FileExistsError:
        pass


async def github_get_all_branches(repo: str, token: Token) -> List[GitBranch]:
    repo_branches = await get_all_branches(github_repo_url(repo, token))
    return [GitBranch(repo=repo, name=branch) for branch in repo_branches]


async def github_push(repo: str, branch: str, token: Token, local_repo: Path) -> None:
    await git_push(local_repo, branch, github_repo_url(repo, token))


async def github_commit_and_push(
        repo: str, branch: str, token: Token, local_repo: Path, message: str, email: str, author: str) -> None:
    await git_commit_and_push(local_repo, message, branch, github_repo_url(repo, token), email, author)


#
# REST API functions
#
async def github_commit_graphql(repo: str, branch: str, token: Token, local_repo: Path, message: str) \
        -> Optional[Dict]:
    origin = github_repo_url(repo, token)
    files = await find_changed_files(local_repo)
    if not files:
        return None

    file_changes = []
    for rel_path in files:
        full_path = local_repo / rel_path
        data = await asyncio.to_thread(full_path.read_bytes)
        b64 = base64.b64encode(data).decode()
        file_changes.append({"path": rel_path, "contents": b64})

    mutation = """
    mutation($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit { oid url }
      }
    }
    """
    headers = {"Authorization": f"Bearer {token.value}"}

    max_mismatch_retries = 3
    for attempt in range(1, max_mismatch_retries + 1):
        head_oid = await get_remote_head(local_repo, branch, origin)
        variables = {
            "input": {
                "branch": {
                    "repositoryNameWithOwner": repo,
                    "branchName": branch
                },
                "expectedHeadOid": head_oid,
                "message": {"headline": message},
                "fileChanges": {"additions": file_changes}
            }
        }

        result = await graphql_query(
            endpoint=GITHUB_GRAPHQL_ENDPOINT, query_or_mutation=mutation, variables=variables, headers=headers,
            log_success=True)

        if "errors" in result:
            errors = result["errors"]
            # Retry on HEAD mismatch
            mismatch_msg = "expected head oid did not match"
            if any(mismatch_msg in err.get("message", "").lower() for err in errors) and attempt < max_mismatch_retries:
                await git_force_refetch_shallow(local_repo, branch, origin)
                await asyncio.sleep(1)
                continue
            return result

        return result

    raise Exception("Exceeded retries due to HEAD conflict")


async def list_available_repos(token: Token, org_name: str = None, per_page: int = 30) -> List[GitHubRepo]:
    repos, page = [], 1
    if org_name:
        endpoint = f"{GITHUB_API_URL}/orgs/{org_name}/repos"
    else:
        endpoint = f"{GITHUB_API_URL}/installation/repositories" if token.is_installation \
            else f"{GITHUB_API_URL}/user/repos"

    while True:
        request_url = f"{endpoint}?per_page={per_page}&page={page}"
        result = await github_request(HTTPMethod.GET, request_url, bearer_token=token.value, max_attempts=2)
        page_repos = result.get("repositories", []) if "repositories" in result else result
        if not page_repos:
            break
        repos += [
            GitHubRepo(
                id=r["id"], name=r["name"], private=r["private"], owner=r["owner"]["login"], owner_id=r["owner"]["id"])
            for r in page_repos
        ]
        if len(page_repos) < per_page:
            break
        page += 1
    return repos


async def list_available_orgs(token: Token, per_page: int = 30) -> List[str]:
    if token.is_installation:
        return [token.org]

    orgs, page = [], 1
    endpoint = f"{GITHUB_API_URL}/user/memberships/orgs"
    while True:
        request_url = f"{endpoint}?per_page={per_page}&page={page}"
        page_orgs = await github_request(HTTPMethod.GET, request_url, bearer_token=token.value, max_attempts=2)
        if not page_orgs:
            break
        orgs += [org["organization"]["login"] for org in page_orgs]
        if len(page_orgs) < per_page:
            break
        page += 1
    return orgs


async def github_clone_all_workflows(token: Token, org_name: str = None, repo_name: str = None) -> List[GitBranch]:
    all_repos = await list_available_repos(token, org_name)
    if repo_name:
        all_repos = [r for r in all_repos if r.name == repo_name]

    if not all_repos:
        raise ValueError(f"No requested repos found: org_name={org_name}, repo_name={repo_name}")

    # Get all branches
    branches_by_repo = await asyncio.gather(*[github_get_all_branches(repo.full_name, token) for repo in all_repos])
    all_branches: List[GitBranch] = list(itertools.chain.from_iterable(branches_by_repo))

    # Clone them all
    await asyncio.gather(*[
        github_clone_shallow(branch.repo, branch.name, WORKFLOW_DIR, token, branch.local_destination)
        for branch in all_branches
    ])

    return all_branches


async def find_all_workflow_files(in_path: Path) -> List[GitHubWorkflow]:
    """
    Return a list of paths (relative to repo root) for all valid
    GitHub Actions workflow files under .github/workflows. A file
    is considered a workflow if it lives in that directory,
    has a .yml or .yaml extension, and contains a top-level 'on:'
    or 'jobs:' key.
    """
    def _scan_candidates() -> List[Path]:
        all_files = [p for ext in ("*.yml", "*.yaml") for p in in_path.rglob(ext) if p.is_file()]
        return all_files

    candidates = await asyncio.to_thread(functools.partial(safe_file_op, _scan_candidates))
    if not candidates:
        return []

    async def _check(fp: Path) -> Optional[GitHubWorkflow]:
        try:
            text = await async_safe_file_op(functools.partial(safe_file_op, fp.read_text))
        except Exception:
            return None

        def non_workflow_file(file_content: str) -> bool:
            # Strip off any common leading indent
            clean_text = textwrap.dedent(file_content)
            return bool(re.search(r'(?m)^(?![ \t]*#)(?:on|jobs)\b\s*:', clean_text, re.MULTILINE))

        # Filter other non-workflow files
        if not await asyncio.to_thread(functools.partial(non_workflow_file, text)):
            return None

        return GitHubWorkflow(path=fp.relative_to(REPO_STORAGE_PATH), content=text)

    results = await asyncio.gather(*(_check(p) for p in candidates))
    return [wf for wf in results if wf]
