# OpenClaw Surge Extension (openclaw-surge)

This is an [OpenClaw](https://github.com/openclaw/openclaw) extension for managing [Surge](https://nssurge.com/) proxy client directly from your chat (e.g., Telegram).

It provides both a command-line interface (`/surge`) with an interactive button panel and a natural language skill (`surge-control`) for the AI agent to control Surge for you.

## Features

- **Interactive Panel**: Manage policy groups and outbound modes via Telegram inline buttons.
- **Policy Group Management**: Switch nodes for any policy group.
- **Outbound Mode Control**: Switch between Direct, Rule, and Global Proxy modes.
- **Natural Language Control**: Ask your agent to "switch to a US node" or "turn on global proxy".
- **Diagnostics**: Test policy groups, flush DNS, and reload profiles.

## Installation

Install this extension into your OpenClaw instance:

```bash
openclaw install /path/to/openclaw-surge
# OR if published to a registry
# openclaw install openclaw-surge
```

## Configuration

Add the following to your OpenClaw `config.yaml` under `plugins`:

```yaml
plugins:
  openclaw-surge:
    enabled: true
    config:
      # Surge HTTP API URL (default: https://127.0.0.1:6171)
      apiUrl: "https://127.0.0.1:6171"
      # Surge API Key (X-Key header)
      apiKey: "your-surge-api-key"
      # Optional: Specific groups to show on the main dashboard
      # coreGroups: ["Proxy", "Streaming", "OpenAI"]
```

> **Note**: You must enable HTTP API in Surge settings (Preferences > General > HTTP API). Ensure you set a strong password (API Key) and allow access from the machine running OpenClaw.

## Usage

### Interactive Command

Simply type `/surge` in your chat to open the interactive dashboard.
- **Mode**: Toggle between Direct, Rule, and Proxy.
- **Groups**: Click a policy group to see available nodes and select one.

### Subcommands

You can also use specific subcommands for quick actions:

- `/surge status` - Show current outbound mode.
- `/surge mode [direct|rule|proxy]` - Get or set outbound mode.
- `/surge select <Group Name> <Node Name>` - Switch a policy group to a specific node.
- `/surge groups` - List visible policy groups.
- `/surge test <Group Name>` - Test connectivity for a group.
- `/surge flush` - Flush DNS cache.
- `/surge reload` - Reload Surge profile.

### Natural Language (Agent Skill)

This extension includes the `surge-control` skill. You can ask your agent:

- "Switch the Proxy group to a Hong Kong node."
- "Turn on global proxy mode."
- "Test the OpenAI policy group."
- "Flush DNS."

The agent will understand your intent and use the Surge API to execute the command.

## Requirements

- OpenClaw >= 2026.1.0
- Surge for Mac (with HTTP API enabled)
- Network access from OpenClaw to Surge (default localhost:6171)

## License

MIT
