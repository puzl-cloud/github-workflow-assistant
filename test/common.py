import unittest

from src.common import extract_runs_on_labels, git_branch_by_full_path


class TestExtractRunsOnLabels(unittest.TestCase):
    def test_empty(self):
        workflow_yaml = """
        """
        self.assertEqual(extract_runs_on_labels(workflow_yaml), set())

    def test_single_line(self):
        workflow_yaml = """
        jobs:
          build:
            runs-on: puzl-cloud
        """
        self.assertEqual(extract_runs_on_labels(workflow_yaml), {"puzl-cloud"})

    def test_blank_lines(self):
        workflow_yaml = """
        name: Many Blank Lines WF
        on:
          issue_comment:
            types:
              - created
            
          pull_request_review_comment:
            types:
              - created
        
        
        jobs:
          claude-code-action:
            if: >
              (github.event_name == 'issue_comment' &&
              contains(github.event.comment.body, '@puzl')) ||
        
              (github.event_name == 'pull_request_review_comment' &&
              contains(github.event.comment.body, '@puzl')) ||
        
            runs-on:
              - puzl-cloud
        
            steps:
              - name: Checkout repository
                uses: actions/checkout@v4
                with:
                  fetch-depth: 1
              - name: cat
                run: mount
        """
        self.assertEqual(extract_runs_on_labels(workflow_yaml), {"puzl-cloud"})

    def test_single_line_templated(self):
        workflow_yaml = """
            jobs:
              build:
                runs-on: ${{ some.var }}
        """
        self.assertEqual(extract_runs_on_labels(workflow_yaml), {"${{ some.var }}"})

    def test_bracket_list(self):
        workflow_yaml = """
        jobs:
          test:
            runs-on: [ubuntu-20.04, puzl-cloud, ${{ matrix.os }}]
        """
        self.assertEqual(extract_runs_on_labels(workflow_yaml), {"ubuntu-20.04", "puzl-cloud", "${{ matrix.os }}"})

    def test_multiline_list(self):
        workflow_yaml = """
        jobs:
          deploy:
            runs-on:
              - macos-latest
              - puzl-cloud
              - ${{ matrix.os }}
        """
        self.assertEqual(extract_runs_on_labels(workflow_yaml), {"macos-latest", "puzl-cloud", "${{ matrix.os }}"})

    def test_ignores_nested_text(self):
        workflow_yaml = """
        jobs:
          build:
            steps:
              - run: |
                  echo "runs-on: fake-runner"
            runs-on: puzl-cloud
        """
        self.assertEqual(extract_runs_on_labels(workflow_yaml), {"puzl-cloud"})

    def test_stress_ng(self):
        workflow_yaml = """
        name: test-job
        on:
          push:
            branches:
              - '**'
            tags:
              - '**'
          pull_request:
            branches:
              - '**'
          release:
            types: [published, created, edited, deleted, prereleased, released]
          workflow_dispatch:

        jobs:
          stress-test:
            runs-on: puzl-cloud
            steps:
            - name: Run
              run: |
                df -h
                lsblk
                sleep 3000
        """
        self.assertEqual(extract_runs_on_labels(workflow_yaml), {"puzl-cloud"})

    def test_inline_list_with_comments(self):
        content = """
        jobs:
          build:
            runs-on: [ubuntu-20.04, self-hosted] # Some comment
        """
        expected = {"ubuntu-20.04", "self-hosted"}
        self.assertEqual(extract_runs_on_labels(content), expected)

    def test_multi_line_with_comments(self):
        content = """
        jobs:
          deploy:
            runs-on:
              - macos-15 # primary runner
              - self-hosted # fallback
        """
        expected = {"macos-15", "self-hosted"}
        self.assertEqual(extract_runs_on_labels(content), expected)

    def test_single_value_with_comment(self):
        content = """
        jobs:
          build:
            runs-on: macos-15 # macOS 15 ARM (you can adjust to macOS version as needed)
        """
        expected = {"macos-15"}
        self.assertEqual(extract_runs_on_labels(content), expected)


class TestGitBranchByPath(unittest.TestCase):
    def test_basic_extraction(self):
        cases = [
            ("/root/org1/repo1/featureX/.github/workflows/test.yaml", "/root", ".github/workflows", "featureX"),
            ("/root/org1/repo1/featureX/path/to/content/file.txt", "/root", "content", "featureX/path/to"),
            ("/root/org1/repo1/content/file.txt", "/root", "content", "."),
            ("/root/org1/repo1/a/b/c.txt", "/root", "dummy", "a/b/c.txt")
        ]
        for path, base_dir, prefix, expected in cases:
            with self.subTest(path=path, prefix=prefix):
                self.assertEqual(git_branch_by_full_path(path, base_dir, prefix), expected)

    def test_empty_prefix(self):
        self.assertEqual(git_branch_by_full_path("/root/org/repo/a/b", "/root", ""), "a/b")

    def test_base_dir_not_found(self):
        with self.assertRaises(ValueError):
            git_branch_by_full_path("/invalid/path", "/root", "prefix")

    def test_base_dir_not_found_raises(self):
        with self.assertRaises(ValueError) as cm1:
            git_branch_by_full_path("/invalid/path", "/repo", "prefix")
        self.assertIn("is not in the subpath", str(cm1.exception))
