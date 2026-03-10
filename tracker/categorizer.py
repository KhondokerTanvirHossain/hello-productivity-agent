DIRECT_APP_MAP: dict[str, str] = {
    # meeting
    "Zoom": "meeting",
    "zoom.us": "meeting",
    "Google Meet": "meeting",
    "Microsoft Teams": "meeting",
    "Whereby": "meeting",
    "Around": "meeting",
    "Loom": "meeting",
    # coding
    "Code": "coding",
    "VS Code": "coding",
    "Visual Studio Code": "coding",
    "Cursor": "coding",
    "Xcode": "coding",
    "IntelliJ IDEA": "coding",
    "IntelliJ": "coding",
    "PyCharm": "coding",
    "WebStorm": "coding",
    "Rider": "coding",
    "GoLand": "coding",
    "GitHub Desktop": "coding",
    # infra
    "Docker Desktop": "infra",
    "Datadog": "infra",
    "Grafana": "infra",
    "PagerDuty": "infra",
    # planning
    "Notion": "planning",
    "Miro": "planning",
    "FigJam": "planning",
    "Whimsical": "planning",
    "Lucidchart": "planning",
    "Linear": "planning",
    "Jira": "planning",
    "Asana": "planning",
    "ClickUp": "planning",
    "Obsidian": "planning",
    # admin
    "Slack": "admin",
    "Mail": "admin",
    "Apple Mail": "admin",
    "Spark": "admin",
    "Superhuman": "admin",
    "Telegram": "admin",
    "WhatsApp": "admin",
    # bizdev
    "LinkedIn": "bizdev",
    "Hunter": "bizdev",
    "Apollo": "bizdev",
    "Salesforce": "bizdev",
    "HubSpot": "bizdev",
}

TERMINAL_APPS: set[str] = {"Terminal", "iTerm", "iTerm2", "Warp"}

INFRA_TITLE_KEYWORDS: list[str] = [
    "ssh", "kubectl", "k9s", "terraform", "ansible", "docker", "aws", "gcp", "az ",
]

BROWSER_APPS: set[str] = {
    "Google Chrome", "Safari", "Firefox", "Arc", "Microsoft Edge", "Brave Browser",
}

BROWSER_TITLE_RULES: list[tuple[str, list[str]]] = [
    ("meeting", ["meet.google.com", "teams.microsoft.com", "zoom.us"]),
    ("coding", ["github.com", "github"]),
    ("infra", ["console.aws", "console.cloud.google", "portal.azure", "datadog", "grafana", "pagerduty"]),
    ("research", ["- medium", "arxiv", "wikipedia", "stack overflow", "stackoverflow.com", "hacker news", "news.ycombinator", "reddit"]),
    ("bizdev", ["linkedin", "proposal", "contract", "pitch"]),
    ("planning", ["google docs", "docs.google.com"]),
    ("admin", ["gmail", "google calendar"]),
]


def categorize(app_name: str, window_title: str | None) -> str:
    if app_name in DIRECT_APP_MAP:
        return DIRECT_APP_MAP[app_name]

    if app_name in TERMINAL_APPS:
        if window_title:
            title_lower = window_title.lower()
            for keyword in INFRA_TITLE_KEYWORDS:
                if keyword in title_lower:
                    return "infra"
        return "coding"

    if app_name in BROWSER_APPS:
        if window_title:
            title_lower = window_title.lower()
            for category, keywords in BROWSER_TITLE_RULES:
                for keyword in keywords:
                    if keyword in title_lower:
                        return category
        return "?"

    return "?"
