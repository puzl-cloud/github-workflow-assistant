import os
from pathlib import Path


SSL_CERT_PATH = os.getenv("SSL_CERT_PATH")
SSL_KEY_PATH = os.getenv("SSL_KEY_PATH")
LISTEN_HOST = os.getenv("LISTEN_HOST", "0.0.0.0")
LISTEN_PORT = int(os.getenv("LISTEN_PORT", 17007))

#
# Setting up git environment
REPO_STORAGE = os.getenv("REPO_STORAGE", "/tmp")
REPO_STORAGE_PATH = Path(REPO_STORAGE)
SHELL_CONCURRENCY_LIMIT = int(os.getenv("SHELL_CONCURRENCY_LIMIT", 100))
FS_CONCURRENCY_LIMIT = int(os.getenv("FS_CONCURRENCY_LIMIT", 50))

#
# GitHub API
GITHUB_API_ENDPOINT = os.getenv("GITHUB_API_ENDPOINT", "api.github.com")
GITHUB_API_URL = os.getenv("GITHUB_API_URL", f"https://{GITHUB_API_ENDPOINT}")
GITHUB_GRAPHQL_ENDPOINT = os.getenv("GITHUB_GRAPHQL_ENDPOINT", f"{GITHUB_API_ENDPOINT}/graphql")
PREDEFINED_RUNS_ON_LABELS = [
    label.strip() for label in os.getenv(
        "PREDEFINED_RUNS_ON_LABELS",
        "puzl-ubuntu-latest,puzl-ubuntu-24.04,puzl-ubuntu-22.04,puzl-any,puzl-custom").split(',')
    if label.strip()
]

#
# For self-hosted flow
GITHUB_PERSONAL_ACCESS_TOKEN = os.getenv("GITHUB_PERSONAL_ACCESS_TOKEN")
COMMIT_AUTHOR = os.getenv("COMMIT_AUTHOR", "puzl.cloud")
COMMIT_EMAIL = os.getenv("COMMIT_EMAIL", "198101009+puzl-cloud[bot]@users.noreply.github.com")

#
# For application flow
GITHUB_INSTALLATION_TOKEN_PROVIDER = os.getenv("GITHUB_INSTALLATION_TOKEN_PROVIDER")
GITHUB_INSTALLATION_TOKEN_PROVIDER_SECRET = os.getenv("GITHUB_INSTALLATION_TOKEN_PROVIDER_SECRET")

assert GITHUB_INSTALLATION_TOKEN_PROVIDER or GITHUB_PERSONAL_ACCESS_TOKEN, \
    "You must provide either a Personal Access Token https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token"
