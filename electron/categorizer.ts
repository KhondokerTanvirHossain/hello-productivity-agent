// electron/categorizer.ts

const DIRECT_APP_MAP: Record<string, string> = {
  // meeting
  Zoom: "meeting",
  "zoom.us": "meeting",
  "Google Meet": "meeting",
  "Microsoft Teams": "meeting",
  Whereby: "meeting",
  Around: "meeting",
  Loom: "meeting",
  // coding
  Code: "coding",
  "VS Code": "coding",
  "Visual Studio Code": "coding",
  Cursor: "coding",
  Xcode: "coding",
  "IntelliJ IDEA": "coding",
  IntelliJ: "coding",
  PyCharm: "coding",
  WebStorm: "coding",
  Rider: "coding",
  GoLand: "coding",
  "GitHub Desktop": "coding",
  // infra
  "Docker Desktop": "infra",
  Datadog: "infra",
  Grafana: "infra",
  PagerDuty: "infra",
  // planning
  Notion: "planning",
  Miro: "planning",
  FigJam: "planning",
  Whimsical: "planning",
  Lucidchart: "planning",
  Linear: "planning",
  Jira: "planning",
  Asana: "planning",
  ClickUp: "planning",
  Obsidian: "planning",
  // admin
  Slack: "admin",
  Mail: "admin",
  "Apple Mail": "admin",
  Spark: "admin",
  Superhuman: "admin",
  Telegram: "admin",
  WhatsApp: "admin",
  // bizdev
  LinkedIn: "bizdev",
  Hunter: "bizdev",
  Apollo: "bizdev",
  Salesforce: "bizdev",
  HubSpot: "bizdev",
};

const TERMINAL_APPS = new Set(["Terminal", "iTerm", "iTerm2", "Warp"]);

const INFRA_TITLE_KEYWORDS = [
  "ssh",
  "kubectl",
  "k9s",
  "terraform",
  "ansible",
  "docker",
  "aws",
  "gcp",
  "az ",
];

const BROWSER_APPS = new Set([
  "Google Chrome",
  "Safari",
  "Firefox",
  "Arc",
  "Microsoft Edge",
  "Brave Browser",
]);

const BROWSER_TITLE_RULES: [string, string[]][] = [
  ["meeting", ["meet.google.com", "teams.microsoft.com", "zoom.us"]],
  ["coding", ["github.com", "github"]],
  [
    "infra",
    [
      "console.aws",
      "console.cloud.google",
      "portal.azure",
      "datadog",
      "grafana",
      "pagerduty",
    ],
  ],
  [
    "research",
    [
      "- medium",
      "arxiv",
      "wikipedia",
      "stack overflow",
      "stackoverflow.com",
      "hacker news",
      "news.ycombinator",
      "reddit",
    ],
  ],
  ["bizdev", ["linkedin", "proposal", "contract", "pitch"]],
  ["planning", ["google docs", "docs.google.com"]],
  ["admin", ["gmail", "google calendar"]],
];

export function categorize(appName: string, windowTitle: string | null): string {
  if (appName in DIRECT_APP_MAP) {
    return DIRECT_APP_MAP[appName];
  }

  if (TERMINAL_APPS.has(appName)) {
    if (windowTitle) {
      const titleLower = windowTitle.toLowerCase();
      for (const keyword of INFRA_TITLE_KEYWORDS) {
        if (titleLower.includes(keyword)) {
          return "infra";
        }
      }
    }
    return "coding";
  }

  if (BROWSER_APPS.has(appName)) {
    if (windowTitle) {
      const titleLower = windowTitle.toLowerCase();
      for (const [category, keywords] of BROWSER_TITLE_RULES) {
        for (const keyword of keywords) {
          if (titleLower.includes(keyword)) {
            return category;
          }
        }
      }
    }
    return "?";
  }

  return "?";
}
