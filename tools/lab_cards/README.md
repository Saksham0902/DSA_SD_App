# Lab cards

Every step-through lab gets a card above its picture that says what the problem is, gives a worked example with the answer, states the idea, and explains what each colour, pointer and number on screen means. The card follows the selected tab.

- `dsa.txt`: cards for the 13 DSA pages (problem cards, plus "What this measures" cards for the cost labs).
- `sd.txt`: cards for the system design pages ("The scenario" cards).
- `card.css`, `card.js`: the card's look and the small script that keeps it in sync with the tabs.
- `build.py`: injects all of the above into the pages. Safe to run again; it replaces what it injected before.

To change a card, edit the `.txt` file and run from the repo root:

```
python3 tools/lab_cards/build.py --bump-sw
```

`--check` parses the files and lists which labs have cards without writing anything. The line format is described at the top of `build.py`. Every example answer should match the lab's own last step.
