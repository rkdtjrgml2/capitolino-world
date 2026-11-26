# catalog

Game data the client reads at start. Edit these instead of index.html.

| file | what |
|---|---|
| buildings.json | build menu cards: id, tab (house, prod, farm, deco, sign), name per language, cost, open (true = buildable now), req |
| items.json | items and tools: id, category, name per language, icon id, slot, stack. Read by the UI layer as it grows |
| icons.json | list of icon ids that exist as real art in assets/icons/<id>.webp or assets/cards/<id>.webp. An id not listed keeps its placeholder, so a missing file never shows a broken image |

Adding a new picture: put the PNG from ChatGPT in the project folder 03_아트/받은그림, Claude converts it to webp in assets/icons or assets/cards, then adds its id to icons.json.
