import logging
import asyncio
import itertools
from typing import Awaitable
from dataclasses import asdict
from http.client import responses

from sanic import SanicException, BadRequest, NotFound, Unauthorized
from sanic.blueprints import Blueprint
from sanic.response import json as sanic_json
from sanic.response import file as sanic_file

from .utils.github import *
from .utils.files import *
from .token_provider import get_github_token


health_bp = Blueprint("health", "/health")


@health_bp.get("/", strict_slashes=False)
async def health(request):
    return sanic_json({"status": True})

#
# UI
static_bp = Blueprint("static", url_prefix="")
static_bp.static("/", "html", index="index.html", name="index")

#
# API
API_PREFIX = "/api"
orgs_bp = Blueprint("orgs", url_prefix=f"{API_PREFIX}/orgs", strict_slashes=False)
org_workflows_bp = Blueprint(
    "org_workflows", url_prefix=f"{API_PREFIX}/orgs/<org_name>/workflows", strict_slashes=False)
org_workflow_fetch_bp = Blueprint(
    "org_workflow_fetch", url_prefix=f"{API_PREFIX}/orgs/<org_name>/fetch-workflows", strict_slashes=False)

repos_bp = Blueprint("repos", url_prefix=f"{API_PREFIX}/orgs/<org_name>/repos", strict_slashes=False)
repo_workflows_bp = Blueprint(
    "repo_workflows", url_prefix=f"{API_PREFIX}/orgs/<org_name>/repos/<repo_name>/workflows", strict_slashes=False)
repo_workflow_fetch_bp = Blueprint(
    "repo_workflow_fetch", url_prefix=f"{API_PREFIX}/orgs/<org_name>/repos/<repo_name>/fetch-workflows",
    strict_slashes=False)

workflows_bp = Blueprint("workflows", url_prefix=f"{API_PREFIX}/workflows", strict_slashes=False)
runs_on_labels_bp = Blueprint("runs_on_labels", url_prefix=f"{API_PREFIX}/runs-on-labels", strict_slashes=False)

# Create /api group
api_bp = Blueprint.group(orgs_bp, repos_bp, org_workflows_bp, repo_workflows_bp, org_workflow_fetch_bp,
                         repo_workflow_fetch_bp, workflows_bp, runs_on_labels_bp)


@runs_on_labels_bp.get("/", strict_slashes=False)
async def runs_on_labels(request):
    return sanic_json({"labels": PREDEFINED_RUNS_ON_LABELS})


@orgs_bp.get("/", strict_slashes=False)
async def orgs(request):
    token = await get_github_token()
    if not token.value:
        raise Unauthorized()
    try:
        all_orgs = await list_available_orgs(token)
    except RESTAPIError as e:
        raise SanicException(status_code=e.status, message=responses[e.status])

    return sanic_json(all_orgs)


@repos_bp.get("/", strict_slashes=False)
async def repos(request, org_name: str):
    token = await get_github_token(org_name)
    if not token.value:
        raise Unauthorized()
    try:
        all_repos = await list_available_repos(token, org_name)
    except RESTAPIError as e:
        raise SanicException(status_code=e.status, message=responses[e.status])

    logging.info(f"{len(all_repos)} repos found in `{org_name}`")
    return sanic_json([asdict(repo) for repo in all_repos])


@org_workflow_fetch_bp.get("/", strict_slashes=False)
@repo_workflow_fetch_bp.get("/", strict_slashes=False)
async def fetch_workflows(request, org_name: str, repo_name: str = None):
    token = await get_github_token(org_name)
    if not token.value:
        raise Unauthorized()
    try:
        fetched_branches = await github_clone_all_workflows(token, org_name, repo_name)
    except ValueError:
        raise NotFound()
    logging.info(f"{len(fetched_branches)} branches were fetched from `{org_name}/{repo_name if repo_name else ''}`")
    return sanic_json([asdict(branch) for branch in fetched_branches])


@org_workflows_bp.get("/", strict_slashes=False)
@repo_workflows_bp.get("/", strict_slashes=False)
async def get_workflows(request, org_name: str, repo_name: str = None):
    token = await get_github_token(org_name)
    if not token.value:
        raise Unauthorized()
    path = REPO_STORAGE_PATH / org_name
    if repo_name:
        path = path / repo_name
    all_workflows = await find_all_workflow_files(in_path=path)
    logging.info(f"{len(all_workflows)} workflows found in `{org_name}/{repo_name if repo_name else ''}`")
    return sanic_json([wf.serialize() for wf in all_workflows])


@workflows_bp.put("/", strict_slashes=False)
async def put_workflows(request):
    data = request.json
    if not isinstance(data, list):
        raise BadRequest("Invalid payload. Expected a JSON array.")

    try:
        workflows = [GitHubWorkflow.deserialize(wf) for wf in data]
    except Exception:
        raise BadRequest("Invalid payload. Expected path and base64 encoded content of each workflow file.")

    write_results = await asyncio.gather(*[write_file(wf) for wf in workflows], return_exceptions=True)
    return_results = {}
    for i, res in enumerate(write_results):
        if isinstance(res, Exception):
            logging.error(res)
            return_results[str(workflows[i].path)] = {"error": f"Could not write file changes. Error: {res}"}

    all_orgs = list(set([wf.org for wf in workflows]))
    tokens = await asyncio.gather(*[get_github_token(org_name) for org_name in all_orgs])
    if not [t for t in tokens if t.value]:
        raise Unauthorized()
    tokens = {t.org: t for t in tokens}

    push_tasks: Dict[Path, Awaitable] = {}
    commit_msg = "Bulk workflow update via GitHub Workflow Assistant by puzl.cloud [skip ci]"
    for wf in workflows:
        if wf.branch_full_path in push_tasks:
            continue

        token = tokens[wf.org]
        if token.is_installation:
            push_tasks[wf.branch_full_path] = github_commit_graphql(
                repo=wf.repo, branch=wf.branch, token=token, local_repo=wf.branch_full_path, message=commit_msg)
        else:
            push_tasks[wf.branch_full_path] = github_commit_and_push(
                repo=wf.repo, branch=wf.branch, token=token, local_repo=wf.branch_full_path, message=commit_msg,
                email=COMMIT_EMAIL, author=COMMIT_AUTHOR
            )

    commit_results = await asyncio.gather(*push_tasks.values(), return_exceptions=True)
    all_branch_paths = list(push_tasks.keys())
    for i, res in enumerate(commit_results):
        res_key = str(all_branch_paths[i])
        if isinstance(res, Exception):
            logging.error(res)
            return_results[res_key] = {"error": f"Could not commit workflow changes. Error: {res}"}
        else:
            return_results[res_key] = {"success": True}

    return sanic_json(return_results)
