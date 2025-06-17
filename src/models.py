import base64
import functools
import asyncio

from dataclasses import dataclass, field, asdict
from typing import Optional, ClassVar, Dict, Self
from pathlib import Path

from env import *
from src.common import *


@dataclass(kw_only=True)
class Token:
    installation_id: Optional[int] = field(default=None)
    org: Optional[str] = field(default=None)
    value: str
    expires_at: Optional[int] = field(default=None)
    @property
    def is_installation(self) -> bool: return self.installation_id is not None

    def __post_init__(self):
        assert self.value.startswith("ghs_") or self.value.startswith("github_pat_"), \
            "You must provide either a Personal Access Token https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token " \
            "or installation token"


class GitError(Exception):
    """General git failure."""
    pass


class GitConflictError(GitError):
    """Raised on non-fast-forward push or fetch divergence."""
    pass


class GitNotFoundError(GitError):
    """Raised when git repo is not found."""
    pass


class RESTAPIError(Exception):
    """Custom exception for REST API errors."""
    def __init__(self, status: int, message: str, response_text: str):
        super().__init__(message)
        self.status = status
        self._message = message
        self.response_text = response_text

    def __str__(self): return f"HTTP Error {self.status}: {self._message}. Response: {self.response_text}"


class GraphQLError(Exception):
    """Raised when the GraphQL response contains errors."""
    pass


@dataclass(kw_only=True)
class GitBranch:
    repo: str
    name: str
    @property
    def local_destination(self) -> Path: return Path(f"{REPO_STORAGE}/{self.repo}/{self.name}")


@dataclass(kw_only=True)
class GitHubRepo:
    id: int
    name: str
    owner: str
    owner_id: int
    private: bool
    @property
    def full_name(self) -> str: return f"{self.owner}/{self.name}"


@dataclass(kw_only=True)
class File:
    path: Path
    content: Optional[str]
    root: ClassVar[Path] = REPO_STORAGE_PATH
    @property
    def full_path(self) -> Path: return self.root / self.path

    def serialize(self) -> Dict:
        return {
            "path": str(self.path),
            "content": base64.b64encode(self.content.encode('utf-8')).decode('utf-8')
        }

    @classmethod
    def deserialize(cls, data: Dict) -> Self:
        return cls(path=Path(data["path"]), content=base64.b64decode(data["content"]).decode('utf-8'))

    def write(self) -> None:
        target = self.full_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(self.content)


@dataclass(kw_only=True)
class GitHubWorkflow(File):
    # We don't treat branch and runs_on as properties because we want them returned to the client
    branch: str = field(default=None, init=False)
    runs_on: Set[str] = field(default_factory=set, init=False)
    @property
    def org(self) -> str: return self.path.parts[0]
    @property
    def repo(self) -> str: return f"{self.org}/{self.path.parts[1]}"
    @property
    def branch_full_path(self) -> Path: return self.root / self.repo / self.branch

    def __post_init__(self):
        self.runs_on = extract_runs_on_labels(self.content)
        self.branch = git_branch_by_full_path(self.full_path, self.root, WORKFLOW_DIR)

    def serialize(self) -> Dict:
        return {
            "path": str(self.path),
            "content": base64.b64encode(self.content.encode('utf-8')).decode('utf-8'),
            "runs-on": list(self.runs_on)
        }
