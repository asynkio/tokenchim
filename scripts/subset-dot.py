"""Regenerate the embedded dot font: python subset-dot.py LiberationMono-Regular.ttf.
Requires fonttools[woff]. Source font is licensed under SIL OFL 1.1.
"""
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

font = TTFont(sys.argv[1])
options = subset.Options()
options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
options.name_legacy = True
options.name_languages = [0x409]
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=[0x00B7])
subsetter.subset(font)
# Rename the derivative to respect the source's reserved font names.
names = {1: 'TokenChimDot', 2: 'Regular', 3: 'TokenChimDot-Regular-1',
         4: 'TokenChimDot Regular', 6: 'TokenChimDot-Regular',
         16: 'TokenChimDot', 17: 'Regular'}
for record in font['name'].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
font.flavor = 'woff2'
target = Path(__file__).resolve().parent.parent / 'src/assets/tokenchim-dot.woff2'
font.save(target)
print(f'{target.name}: {target.stat().st_size} bytes')
