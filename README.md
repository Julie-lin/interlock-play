# 环环相扣 · Interlock

A Chinese homophone word-chain game. Say a two- or three-character word whose first
character matches the previous word's last character — the same character, or one that
sounds alike. The board steps right and down; close the loop back to your first
character to win.

**Play: https://julie-lin.github.io/interlock-play/**

Available in **simplified and traditional characters** — switch with the 字體 toggle. Static page, no backend. Hover a suggestion to hear it read aloud; the 说一个词 button
takes voice input in Chrome and Edge.

## Data sources

| File | Contents | Source and licence |
| --- | --- | --- |
| `sounds.js` | homophone table, 411 syllables | generated with [pinyin-pro](https://github.com/zh-lx/pinyin-pro) (MIT) |
| `words.js` / `words-t.js` | 27,983 / 28,144 words, frequency-ordered | entries [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) (CC BY-SA 4.0), frequencies [jieba](https://github.com/fxsjy/jieba) (MIT) |
| `glosses.js` / `glosses-t.js` | pinyin and English definitions | [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) (CC BY-SA 4.0) |
| `hsk.js` / `hsk-t.js` | HSK 3.0 levels | [Pleco's HSK 3.0 list](https://github.com/elkmovie/hsk30) (MIT) |

Because the definitions derive from CC-CEDICT, this repository is distributed under
**CC BY-SA 4.0**.

This is a published build. The source, generators and earlier prototypes live in a
separate repository.
