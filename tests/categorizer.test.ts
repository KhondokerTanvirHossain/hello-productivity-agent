// tests/categorizer.test.ts
import { describe, it, expect } from "vitest";
import { categorize } from "../electron/categorizer";

describe("Direct app mapping", () => {
  it("Zoom → meeting", () => expect(categorize("Zoom", null)).toBe("meeting"));
  it("Google Meet → meeting", () => expect(categorize("Google Meet", null)).toBe("meeting"));
  it("Microsoft Teams → meeting", () => expect(categorize("Microsoft Teams", null)).toBe("meeting"));
  it("Whereby → meeting", () => expect(categorize("Whereby", null)).toBe("meeting"));
  it("Loom → meeting", () => expect(categorize("Loom", null)).toBe("meeting"));

  it("VS Code → coding", () => expect(categorize("VS Code", "main.py")).toBe("coding"));
  it("Code → coding", () => expect(categorize("Code", "main.py")).toBe("coding"));
  it("Cursor → coding", () => expect(categorize("Cursor", "app.tsx")).toBe("coding"));
  it("Xcode → coding", () => expect(categorize("Xcode", null)).toBe("coding"));
  it("IntelliJ IDEA → coding", () => expect(categorize("IntelliJ IDEA", null)).toBe("coding"));
  it("PyCharm → coding", () => expect(categorize("PyCharm", null)).toBe("coding"));
  it("WebStorm → coding", () => expect(categorize("WebStorm", null)).toBe("coding"));
  it("GoLand → coding", () => expect(categorize("GoLand", null)).toBe("coding"));

  it("Docker Desktop → infra", () => expect(categorize("Docker Desktop", null)).toBe("infra"));
  it("Datadog → infra", () => expect(categorize("Datadog", null)).toBe("infra"));
  it("Grafana → infra", () => expect(categorize("Grafana", null)).toBe("infra"));
  it("PagerDuty → infra", () => expect(categorize("PagerDuty", null)).toBe("infra"));

  it("Notion → planning", () => expect(categorize("Notion", null)).toBe("planning"));
  it("Linear → planning", () => expect(categorize("Linear", null)).toBe("planning"));
  it("Jira → planning", () => expect(categorize("Jira", null)).toBe("planning"));
  it("Obsidian → planning", () => expect(categorize("Obsidian", null)).toBe("planning"));
  it("Miro → planning", () => expect(categorize("Miro", null)).toBe("planning"));

  it("Slack → admin", () => expect(categorize("Slack", null)).toBe("admin"));
  it("Mail → admin", () => expect(categorize("Mail", null)).toBe("admin"));
  it("Apple Mail → admin", () => expect(categorize("Apple Mail", null)).toBe("admin"));
  it("Superhuman → admin", () => expect(categorize("Superhuman", null)).toBe("admin"));
  it("Telegram → admin", () => expect(categorize("Telegram", null)).toBe("admin"));
  it("WhatsApp → admin", () => expect(categorize("WhatsApp", null)).toBe("admin"));

  it("LinkedIn → bizdev", () => expect(categorize("LinkedIn", null)).toBe("bizdev"));
  it("HubSpot → bizdev", () => expect(categorize("HubSpot", null)).toBe("bizdev"));
  it("Salesforce → bizdev", () => expect(categorize("Salesforce", null)).toBe("bizdev"));
  it("Hunter → bizdev", () => expect(categorize("Hunter", null)).toBe("bizdev"));
  it("Apollo → bizdev", () => expect(categorize("Apollo", null)).toBe("bizdev"));
});

describe("Terminal special case", () => {
  it("Terminal default → coding", () => expect(categorize("Terminal", "~/projects")).toBe("coding"));
  it("Terminal ssh → infra", () => expect(categorize("Terminal", "ssh user@prod-server")).toBe("infra"));
  it("iTerm2 kubectl → infra", () => expect(categorize("iTerm2", "kubectl get pods")).toBe("infra"));
  it("Warp terraform → infra", () => expect(categorize("Warp", "terraform plan")).toBe("infra"));
  it("Terminal docker → infra", () => expect(categorize("Terminal", "docker compose up")).toBe("infra"));
  it("Terminal aws → infra", () => expect(categorize("Terminal", "aws s3 ls")).toBe("infra"));
  it("Terminal no title → coding", () => expect(categorize("Terminal", null)).toBe("coding"));
  it("iTerm regular → coding", () => expect(categorize("iTerm", "vim main.py")).toBe("coding"));
});

describe("Browser title matching", () => {
  it("GitHub → coding", () => expect(categorize("Google Chrome", "my-repo - GitHub")).toBe("coding"));
  it("Stack Overflow → research", () => expect(categorize("Safari", "python sqlite3 - Stack Overflow")).toBe("research"));
  it("Medium → research", () => expect(categorize("Google Chrome", "Understanding React Hooks - Medium")).toBe("research"));
  it("Hacker News → research", () => expect(categorize("Firefox", "Hacker News")).toBe("research"));
  it("Reddit → research", () => expect(categorize("Arc", "r/programming - Reddit")).toBe("research"));
  it("arxiv → research", () => expect(categorize("Google Chrome", "arxiv.org - Attention Is All You Need")).toBe("research"));
  it("Wikipedia → research", () => expect(categorize("Safari", "Python (programming language) - Wikipedia")).toBe("research"));
  it("Gmail → admin", () => expect(categorize("Google Chrome", "Inbox - Gmail")).toBe("admin"));
  it("Google Calendar → admin", () => expect(categorize("Google Chrome", "Google Calendar - Week of March 10")).toBe("admin"));
  it("meet.google.com → meeting", () => expect(categorize("Google Chrome", "Meeting - meet.google.com")).toBe("meeting"));
  it("teams.microsoft.com → meeting", () => expect(categorize("Safari", "teams.microsoft.com - Call")).toBe("meeting"));
  it("AWS Console → infra", () => expect(categorize("Google Chrome", "EC2 - console.aws.amazon.com")).toBe("infra"));
  it("GCP Console → infra", () => expect(categorize("Google Chrome", "Compute Engine - console.cloud.google.com")).toBe("infra"));
  it("Azure Portal → infra", () => expect(categorize("Microsoft Edge", "portal.azure.com - Resources")).toBe("infra"));
  it("LinkedIn browser → bizdev", () => expect(categorize("Google Chrome", "Feed | LinkedIn")).toBe("bizdev"));
  it("proposal → bizdev", () => expect(categorize("Google Chrome", "Q4 Proposal - Google Docs")).toBe("bizdev"));
  it("contract → bizdev", () => expect(categorize("Safari", "Service Contract Draft")).toBe("bizdev"));
  it("Google Docs → planning", () => expect(categorize("Google Chrome", "Sprint Plan - Google Docs")).toBe("planning"));
  it("generic browser → ?", () => expect(categorize("Google Chrome", "Some Random Website")).toBe("?"));
  it("browser no title → ?", () => expect(categorize("Safari", null)).toBe("?"));
});

describe("Browser title with URL format", () => {
  it("Gmail with URL", () => expect(categorize("Google Chrome", "Inbox (3) - Gmail | https://mail.google.com/mail/u/0/#inbox")).toBe("admin"));
  it("Google Meet with URL", () => expect(categorize("Google Chrome", "Meeting Room | https://meet.google.com/abc-defg-hij")).toBe("meeting"));
  it("GitHub with URL", () => expect(categorize("Google Chrome", "Pull requests · my-org/my-repo | https://github.com/my-org/my-repo/pulls")).toBe("coding"));
  it("Stack Overflow with URL", () => expect(categorize("Safari", "python - How to parse JSON | https://stackoverflow.com/questions/123")).toBe("research"));
  it("LinkedIn with URL", () => expect(categorize("Google Chrome", "Feed | LinkedIn | https://www.linkedin.com/feed/")).toBe("bizdev"));
  it("Google Docs with URL", () => expect(categorize("Google Chrome", "Sprint Planning Doc | https://docs.google.com/document/d/abc")).toBe("planning"));
  it("AWS Console with URL", () => expect(categorize("Google Chrome", "EC2 Management Console | https://console.aws.amazon.com/ec2")).toBe("infra"));
  it("Hacker News with URL", () => expect(categorize("Firefox", "Hacker News | https://news.ycombinator.com")).toBe("research"));
  it("Unknown site with URL → ?", () => expect(categorize("Google Chrome", "Some Blog Post | https://example.com/blog")).toBe("?"));
});

describe("Fallback", () => {
  it("unknown app → ?", () => expect(categorize("SomeRandomApp", null)).toBe("?"));
  it("null title handled", () => expect(categorize("UnknownApp", null)).toBe("?"));
});
