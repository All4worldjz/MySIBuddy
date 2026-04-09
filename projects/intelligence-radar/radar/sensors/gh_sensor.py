"""
gh_sensor.py - GitHub 传感器
通过 gh CLI 抓取指定仓库的 Issues/PRs/Commits 动态
"""
import json
import subprocess
from typing import List, Dict, Optional


class GHSensor:
    """GitHub 情报传感器"""

    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}

    def fetch_repos(self, repos: List[str], events: List[str] = None, limit: int = 15) -> List[Dict]:
        """
        抓取多个仓库的最新动态
        - repos: ["owner/repo", ...]
        - events: ["issues", "pulls", "releases", "commits"]
        - limit: 每个仓库的结果数
        """
        if events is None:
            events = ["issues", "pulls"]

        results = []
        for repo in repos[:10]:  # 最多10个仓库
            for event in events:
                items = self._fetch_repo_events(repo, event, limit)
                for item in items:
                    item["source"] = "gh"
                    item["repo"] = repo
                    results.append(item)
        return results

    def search_issues(self, query: str, limit: int = 20) -> List[Dict]:
        """搜索 GitHub Issues/PRs"""
        raw = self._run_gh([
            "search", "issue",
            query,
            "--limit", str(limit),
            "--json", "title,body,url,createdAt,state,author,labels,comments,repositoryUrl"
        ])
        for item in raw:
            item["source"] = "gh"
            item["html_url"] = item.get("url")
        return raw

    def _fetch_repo_events(self, repo: str, event_type: str, limit: int) -> List[Dict]:
        """抓取单个仓库的指定类型事件"""
        if event_type == "issues":
            return self._run_gh([
                "api", f"repos/{repo}/issues",
                "--jq", ".[] | {title, body, url, created_at, state, author: .user.login, labels: [.labels[].name], comments}",
                "--limit", str(limit),
                "--method", "GET"
            ])
        elif event_type == "pulls":
            return self._run_gh([
                "api", f"repos/{repo}/pulls",
                "--jq", ".[] | {title, body, url, created_at, state, author: .user.login, comments: .review_comments}",
                "--limit", str(limit),
                "--method", "GET"
            ])
        elif event_type == "releases":
            return self._run_gh([
                "release", "list", "--repo", repo,
                "--limit", str(limit),
                "--json", "name,tag,publishedAt,url,body"
            ])
        elif event_type == "commits":
            return self._run_gh([
                "api", f"repos/{repo}/commits",
                "--jq", ".[] | {title: .commit.message | split(\"\\n\")[0], sha: .sha, url: .html_url, created_at: .commit.author.date, author: .author.login}",
                "--limit", str(limit),
                "--method", "GET"
            ])
        return []

    def _run_gh(self, args: List[str]) -> List[Dict]:
        """执行 gh CLI"""
        try:
            result = subprocess.run(
                ["gh"] + args,
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode == 0 and result.stdout.strip():
                try:
                    return json.loads(result.stdout)
                except json.JSONDecodeError:
                    # jq 输出可能是纯文本，逐行处理
                    lines = result.stdout.strip().split("\n")
                    return [{"title": line[:200], "source": "gh"} for line in lines if line.strip()]
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        return []
