Put your icon images directly in this folder (assets/icons/) using EXACTLY these file names:

  youtube.png     - YouTube icon (used in header/footer social row)
  discord.png     - Discord icon
  telegram.png    - Telegram icon
  wishlist.png    - Generic "wishlist" icon (bookmark/star works well) — used for the disabled wishlist button until you have a real Steam link

Recommended format: PNG with transparent background, roughly 64x64 or 128x128 px (square). SVG also works if you rename the files to .svg AND update the <img src="..."> paths in index.html / privacy.html / terms.html (and the ru/ copies) accordingly — currently they all point to .png files.

If a file is missing, the site automatically falls back to a small two-letter text label (YT / DS / TG / WL) instead of a broken image, so nothing looks broken while you add the real icons.
