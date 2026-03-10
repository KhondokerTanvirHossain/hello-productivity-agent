from tracker.categorizer import categorize


class TestDirectAppMapping:
    def test_zoom_is_meeting(self):
        assert categorize("Zoom", None) == "meeting"

    def test_google_meet_is_meeting(self):
        assert categorize("Google Meet", None) == "meeting"

    def test_microsoft_teams_is_meeting(self):
        assert categorize("Microsoft Teams", None) == "meeting"

    def test_whereby_is_meeting(self):
        assert categorize("Whereby", None) == "meeting"

    def test_loom_is_meeting(self):
        assert categorize("Loom", None) == "meeting"

    def test_vscode_is_coding(self):
        assert categorize("VS Code", "main.py") == "coding"

    def test_code_is_coding(self):
        assert categorize("Code", "main.py") == "coding"

    def test_cursor_is_coding(self):
        assert categorize("Cursor", "app.tsx") == "coding"

    def test_xcode_is_coding(self):
        assert categorize("Xcode", None) == "coding"

    def test_intellij_is_coding(self):
        assert categorize("IntelliJ IDEA", None) == "coding"

    def test_pycharm_is_coding(self):
        assert categorize("PyCharm", None) == "coding"

    def test_webstorm_is_coding(self):
        assert categorize("WebStorm", None) == "coding"

    def test_goland_is_coding(self):
        assert categorize("GoLand", None) == "coding"

    def test_docker_desktop_is_infra(self):
        assert categorize("Docker Desktop", None) == "infra"

    def test_datadog_is_infra(self):
        assert categorize("Datadog", None) == "infra"

    def test_grafana_is_infra(self):
        assert categorize("Grafana", None) == "infra"

    def test_pagerduty_is_infra(self):
        assert categorize("PagerDuty", None) == "infra"

    def test_notion_is_planning(self):
        assert categorize("Notion", None) == "planning"

    def test_linear_is_planning(self):
        assert categorize("Linear", None) == "planning"

    def test_jira_is_planning(self):
        assert categorize("Jira", None) == "planning"

    def test_obsidian_is_planning(self):
        assert categorize("Obsidian", None) == "planning"

    def test_miro_is_planning(self):
        assert categorize("Miro", None) == "planning"

    def test_slack_is_admin(self):
        assert categorize("Slack", None) == "admin"

    def test_mail_is_admin(self):
        assert categorize("Mail", None) == "admin"

    def test_apple_mail_is_admin(self):
        assert categorize("Apple Mail", None) == "admin"

    def test_superhuman_is_admin(self):
        assert categorize("Superhuman", None) == "admin"

    def test_telegram_is_admin(self):
        assert categorize("Telegram", None) == "admin"

    def test_whatsapp_is_admin(self):
        assert categorize("WhatsApp", None) == "admin"

    def test_linkedin_is_bizdev(self):
        assert categorize("LinkedIn", None) == "bizdev"

    def test_hubspot_is_bizdev(self):
        assert categorize("HubSpot", None) == "bizdev"

    def test_salesforce_is_bizdev(self):
        assert categorize("Salesforce", None) == "bizdev"

    def test_hunter_is_bizdev(self):
        assert categorize("Hunter", None) == "bizdev"

    def test_apollo_is_bizdev(self):
        assert categorize("Apollo", None) == "bizdev"


class TestTerminalSpecialCase:
    def test_terminal_default_is_coding(self):
        assert categorize("Terminal", "~/projects") == "coding"

    def test_terminal_ssh_is_infra(self):
        assert categorize("Terminal", "ssh user@prod-server") == "infra"

    def test_iterm_kubectl_is_infra(self):
        assert categorize("iTerm2", "kubectl get pods") == "infra"

    def test_warp_terraform_is_infra(self):
        assert categorize("Warp", "terraform plan") == "infra"

    def test_terminal_docker_is_infra(self):
        assert categorize("Terminal", "docker compose up") == "infra"

    def test_terminal_aws_is_infra(self):
        assert categorize("Terminal", "aws s3 ls") == "infra"

    def test_terminal_no_title_is_coding(self):
        assert categorize("Terminal", None) == "coding"

    def test_iterm_regular_is_coding(self):
        assert categorize("iTerm", "vim main.py") == "coding"


class TestBrowserTitleMatching:
    def test_github_is_coding(self):
        assert categorize("Google Chrome", "my-repo - GitHub") == "coding"

    def test_stackoverflow_is_research(self):
        assert categorize("Safari", "python sqlite3 - Stack Overflow") == "research"

    def test_medium_is_research(self):
        assert categorize("Google Chrome", "Understanding React Hooks - Medium") == "research"

    def test_hackernews_is_research(self):
        assert categorize("Firefox", "Hacker News") == "research"

    def test_reddit_is_research(self):
        assert categorize("Arc", "r/programming - Reddit") == "research"

    def test_arxiv_is_research(self):
        assert categorize("Google Chrome", "arxiv.org - Attention Is All You Need") == "research"

    def test_wikipedia_is_research(self):
        assert categorize("Safari", "Python (programming language) - Wikipedia") == "research"

    def test_gmail_is_admin(self):
        assert categorize("Google Chrome", "Inbox - Gmail") == "admin"

    def test_google_calendar_is_admin(self):
        assert categorize("Google Chrome", "Google Calendar - Week of March 10") == "admin"

    def test_google_meet_browser_is_meeting(self):
        assert categorize("Google Chrome", "Meeting - meet.google.com") == "meeting"

    def test_teams_browser_is_meeting(self):
        assert categorize("Safari", "teams.microsoft.com - Call") == "meeting"

    def test_aws_console_is_infra(self):
        assert categorize("Google Chrome", "EC2 - console.aws.amazon.com") == "infra"

    def test_gcp_console_is_infra(self):
        assert categorize("Google Chrome", "Compute Engine - console.cloud.google.com") == "infra"

    def test_azure_portal_is_infra(self):
        assert categorize("Microsoft Edge", "portal.azure.com - Resources") == "infra"

    def test_linkedin_browser_is_bizdev(self):
        assert categorize("Google Chrome", "Feed | LinkedIn") == "bizdev"

    def test_proposal_is_bizdev(self):
        assert categorize("Google Chrome", "Q4 Proposal - Google Docs") == "bizdev"

    def test_contract_is_bizdev(self):
        assert categorize("Safari", "Service Contract Draft") == "bizdev"

    def test_google_docs_is_planning(self):
        assert categorize("Google Chrome", "Sprint Plan - Google Docs") == "planning"

    def test_generic_browser_is_ambiguous(self):
        assert categorize("Google Chrome", "Some Random Website") == "?"

    def test_browser_no_title_is_ambiguous(self):
        assert categorize("Safari", None) == "?"


class TestFallback:
    def test_unknown_app_is_ambiguous(self):
        assert categorize("SomeRandomApp", None) == "?"

    def test_none_title_handled(self):
        assert categorize("UnknownApp", None) == "?"


class TestBrowserTitleWithUrl:
    """Tests for categorizer with title | url format from AppleScript browsers."""

    def test_gmail_with_url(self):
        assert categorize("Google Chrome", "Inbox (3) - Gmail | https://mail.google.com/mail/u/0/#inbox") == "admin"

    def test_google_meet_with_url(self):
        assert categorize("Google Chrome", "Meeting Room | https://meet.google.com/abc-defg-hij") == "meeting"

    def test_github_with_url(self):
        assert categorize("Google Chrome", "Pull requests · my-org/my-repo | https://github.com/my-org/my-repo/pulls") == "coding"

    def test_stackoverflow_with_url(self):
        assert categorize("Safari", "python - How to parse JSON | https://stackoverflow.com/questions/123") == "research"

    def test_linkedin_with_url(self):
        assert categorize("Google Chrome", "Feed | LinkedIn | https://www.linkedin.com/feed/") == "bizdev"

    def test_google_docs_with_url(self):
        assert categorize("Google Chrome", "Sprint Planning Doc | https://docs.google.com/document/d/abc") == "planning"

    def test_aws_console_with_url(self):
        assert categorize("Google Chrome", "EC2 Management Console | https://console.aws.amazon.com/ec2") == "infra"

    def test_hacker_news_with_url(self):
        assert categorize("Firefox", "Hacker News | https://news.ycombinator.com") == "research"

    def test_unknown_site_with_url(self):
        assert categorize("Google Chrome", "Some Blog Post | https://example.com/blog") == "?"
