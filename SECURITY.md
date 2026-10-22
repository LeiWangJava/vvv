# Security

Report a suspected vulnerability privately, either with GitHub's **Security → Report a vulnerability** on [actionow-ai/vvv](https://github.com/actionow-ai/vvv/security) or by email to [contact@vibevision.video](mailto:contact@vibevision.video). Do not open a public issue with vulnerability details, exploit code, credentials or private media.

Include the affected commit or version, platform and runtime versions, the impact and a minimal reproduction with synthetic inputs. Redact tokens, account identifiers, personal paths and source media.

Fixes are made against the current development code. There is no published response-time commitment or support for older releases.

VVV runs locally and can invoke installed renderers, a separately configured image API or the bundled Codex bridge. Review unfamiliar project code and provider configuration before running them, and keep credentials out of project inputs and reports. The automated checks use local fixtures and need no generation credentials.
