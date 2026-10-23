# Use VVV in WorkBuddy

WorkBuddy uses the same portable `skills/vvv` skill as Claude Code and Codex. This guide covers WorkBuddy desktop tasks with a local workspace and terminal; remote tasks need their own files, runtimes and image tools.

## Import the skill ZIP (recommended)

Download `vvv-skill.zip` from [GitHub Releases](https://github.com/actionow-ai/vvv/releases), or build it from a Git checkout:

```sh
python3 scripts/package-skill.py --output .work/dist/vvv-skill.zip
```

The ZIP has `SKILL.md` at its root with the references, scripts, image bridge and license notices. It excludes the templates, demo media and local configuration. The command prints the checksum and refuses to overwrite an existing file. It also refuses uncommitted skill changes; add `--allow-dirty` for a local test build.

In WorkBuddy, open **技能 → 添加技能 → 上传技能** (Skills → Add skill → Upload skill; see the [skill guide](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market)) and choose the ZIP. Vibe Vision Video is not listed in the WorkBuddy marketplace.

Keep the repository checkout for its `kits/remotion` templates; the skill alone does not include them. Tell WorkBuddy where they are (as in the prompt below), or set `VVV_KIT=/absolute/path/to/vvv/kits/remotion` in its terminal environment.

## Alternative: a code-development project

WorkBuddy reads project skills from `.codebuddy/skills/` during code development ([project guide](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Project)). Copy the complete skill, keeping any existing installation:

```sh
VVV_ROOT=/absolute/path/to/vvv
VVV_PROJECT=/absolute/path/to/your-video-project
if [ -e "$VVV_PROJECT/.codebuddy/skills/vvv" ]; then
  echo "Existing skill kept"
else
  mkdir -p "$VVV_PROJECT/.codebuddy/skills"
  cp -R "$VVV_ROOT/skills/vvv" "$VVV_PROJECT/.codebuddy/skills/vvv"
fi
```

Open that directory as the workspace and ask WorkBuddy to use the **vvv** skill. The CodeBuddy IDE and CLI read the same `.codebuddy/skills/` folder (and `~/.codebuddy/skills/` for every project). A copied installation is a snapshot; update it when the source changes.

## Make a film

WorkBuddy sets up the environment itself: the skill tells it to run `vvv doctor` first and follow its steps, asking you only before installing system software such as Node.js. Your computer needs Python 3.9+, Node.js and npm for rendering. A first prompt using only local photos, without image generation:

> 使用 vvv 技能和 `/absolute/path/to/vvv/kits/remotion` 里的模板，用 album 模板做一条 9:16 的照片短片，照片在 ./photos。先给我看检查过的样片，再交付成片和工程。当前不要调用生图服务。

## Image generation in WorkBuddy

WorkBuddy is a host, not an image provider; VVV chooses a route by capability:

- **Native:** check whether this task exposes an image generation or editing tool, whether it accepts the supplied references, and whether its output can meet the transparency requirement and be saved locally. Image understanding or a model name is not enough. `vvv_image.py plan` returns arguments in Codex's naming (`prompt`, `transparent_background`, `referenced_image_paths`); translate them to the actual tool's schema instead of sending them unchanged. Follow the tool's own cost and authorization steps.
- **c2c:** works only if Codex is installed and signed in, with image access, in the same execution environment. A remote task cannot use the desktop's Codex login.
- **API:** an explicitly selected Images API with its own credential. WorkBuddy's chat model or API key is never reused as a VVV image credential.

See the [image workflow](../skills/vvv/references/image-generation.md) for `doctor`, `plan`, `generate` and `adopt`.

## Verification scope

The skill package, a copied installation and the helpers have been checked offline against WorkBuddy's documented layout (desktop 5.5.2, October 2026). A complete WorkBuddy creation session, the UI import itself and WorkBuddy-account image generation have not been verified.
