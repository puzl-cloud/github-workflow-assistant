# GitHub Workflows Assistant

This tool helps you perform bulk operations on the GitHub Actions workflows among multiple repos and branches in a secure and convenient manner. 

Currently, the only supported bulk operation is the `runs-on` labels replacement.

## Setting up

### 1. Issue GitHub Personal Access Token

To issue your GitHub fine-grained personal token, follow this [official instruction](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token).

Choose the desired organization, where you'd like to perform operations, and set the required token permission scopes:

- Repositories:
  - Content: `Read and write`
  - Workflows: `Read and write`
- Organizations:
  - Members: `Read-only`

### 2. Run locally

1. Make sure you have docker daemon up and running on your machine.
2. Set the GitHub token, which you got on a previous step, in your shell environment:

```shell
export MY_PAT=github_pat_...
```

3. Run the container using official `latest` image

```shell
docker run --rm -d -p 3131:3000 -e GITHUB_PERSONAL_ACCESS_TOKEN=$MY_PAT ghcr.io/puzl-cloud/github-workflow-assistant:latest
```

4. Navigate to http://localhost:3131 to access the dashboard.

<img width="1200" alt="workflow-assistant" src="https://github.com/puzl-cloud/github-workflow-assistant/blob/main/ui/src/public/workflow-assistant.png?raw=true" />

## Using the Assistant

### Replace your `runs-on` labels

In the dashboard:

1. Choose your organization. 

It will start a shallow clone of `.github/workflows` folder from all branches in all repos available for your GitHub Personal Access Token.

2. Once clone is done, create `runs-on` replacement rule and choose repos and branches where you want to replace labels.

3. Review and commit your changes.

This operation will create commits in `.github/workflows` files in all the chosen branches. Workflow execution will be skipped for all the commits.
