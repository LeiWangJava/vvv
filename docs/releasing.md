# Preparing a release

A checklist for maintainers, using 0.1.0 as the example. Run every step from the repository root.

1. **Review and stage the whole tree.** Read `git status`, confirm deletions are intended and that no private or generated material is present, then stage everything:

   ```sh
   git status
   git add -A
   ```

2. **Run the checks.** All three must pass:

   ```sh
   .venv/bin/python -m unittest discover -s tests
   .venv/bin/python scripts/check-repository.py --portable
   npm --prefix kits/remotion run check
   ```

3. **Bump versions to `0.1.0`** in `.claude-plugin/plugin.json`, `kits/remotion/package.json` (and the root entry of `kits/remotion/package-lock.json`, for example with `npm --prefix kits/remotion version 0.1.0 --no-git-tag-version`), and any version in the skill metadata. Date the CHANGELOG entry (`## 0.1.0 — YYYY-MM-DD`). Rerun step 2 and `git add -A`.

4. **Create a squashed orphan `main`.** The development history contains large media that was later removed and must not be published, so the public branch starts with one reviewed commit:

   ```sh
   git checkout --orphan release-main   # keeps the staged tree; history is not carried over
   git add -A
   git commit -m "Vibe Vision Video 0.1.0"
   git branch -M release-main main
   ```

   Inspect the commit (`git show --stat HEAD`) before pushing. Push only this branch to `https://github.com/actionow-ai/vvv`, never the development branches.

5. **Tag the release:**

   ```sh
   git tag -a v0.1.0 -m "Vibe Vision Video 0.1.0"
   git remote add public https://github.com/actionow-ai/vvv.git   # once
   git push public main v0.1.0
   ```

6. **Build the skill ZIP** from the clean, tagged tree and record its SHA-256 from the printed JSON:

   ```sh
   python3 scripts/package-skill.py --output .work/dist/vvv-skill.zip
   ```

   The packager refuses uncommitted skill changes, so the ZIP matches the tag.

7. **Optionally build template packages:**

   ```sh
   python3 skills/vvv/scripts/vvv.py pack --kit kits/remotion --template album \
     --preview docs/assets/album.mp4 --poster docs/assets/album.jpg --output .work/dist/album.vvv
   python3 skills/vvv/scripts/vvv.py verify --package .work/dist/album.vvv
   ```

   Repeat for each template ID and for `--effect papercut-frame`.

8. **Create the GitHub release** on `actionow-ai/vvv` for `v0.1.0`, with the CHANGELOG entry as notes (saved to `.work/dist/notes.md`), the SHA-256 of each file, and the assets attached:

   ```sh
   gh release create v0.1.0 --repo actionow-ai/vvv --title "Vibe Vision Video 0.1.0" \
     --notes-file .work/dist/notes.md .work/dist/vvv-skill.zip .work/dist/*.vvv
   ```

9. **Deploy the website** [vibevision.video](https://vibevision.video) from its separate repository, linking the new release.

Live image-generation checks consume account resources; run them manually if needed, never in CI.
