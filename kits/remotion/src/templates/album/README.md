# Album

Album has a 197.5-second landscape story and a dedicated portrait gallery
(1494 frames, 49.8 s at 30 fps, with the demo gallery; its length follows the
number of gallery shots, and the closing card holds for 8 beats). The portrait version uses phone-sized photo layouts;
it is not a crop of the landscape film.

White text over photographs needs a shaded background as well as a text shadow.
The landscape opening and ending shade the side selected by the photo's
`textSpace` metadata; an untagged photo puts the text opposite its detected
faces, and a photo with neither gets a centred lower third over a bottom
gradient. Portrait gallery titles over a full-bleed photo or a blurred backdrop
shade the top of the frame while their title and subtitle are visible. Captions
on paper keep dark ink without this overlay. Untagged project photos form one
gallery set without a `set_<id>` caption; the short then opens their run with
`gallery_title` / `gallery_subtitle` instead. In the short, a landscape photo
without faces is shown whole as a moving card (or an inset on its blurred copy)
rather than cropped to fill the phone frame.

Couple names and user lines are fitted to their column with `core/text-fit.ts`
(an estimate from measured glyph widths, no DOM measurement): short CJK names
keep their designed size; long Latin names break once at " & " and shrink. When changing photographs, inspect both the names/date
and the smallest caption at the intended preview size.

The default Skyline track has a quiet introduction. The template's authored
beat grid starts at 2.86 seconds. Keep the original music offset
when rendering the full film; moving only the music changes synchronization.
Public excerpts can start after that introduction without changing the film:
the landscape selection starts on the complete wedding title and ends before
the next page transition; the portrait selection starts on the interior photo
layouts and preserves the original wedding closing card and fade. Exact render
ranges are recorded in the public preview metadata.
