"""Preflop range tables (pure strategy, no mixed frequencies).

Baseline: GTO Wizard cash 6-max 100bb, simplified to the majority action.
Edit the RANGES dict below to correct any table after checking GTO Wizard.
Notation: "66+" pairs, "A2s+" suited kicker-up, "KJo+" offsuit, single
combos like "T9s" allowed. Lists expand to 169-grid hand classes.
"""

RANKS = "AKQJT98765432"


def _expand_token(token):
    token = token.strip()
    plus = token.endswith("+")
    if plus:
        token = token[:-1]
    out = []
    if len(token) == 2 and token[0] == token[1]:  # pair
        i = RANKS.index(token[0])
        idxs = range(i + 1) if plus else [i]
        return [RANKS[j] * 2 for j in idxs]
    hi, lo, suit = token[0], token[1], token[2]
    i, j = RANKS.index(hi), RANKS.index(lo)
    if plus:  # kicker goes up toward hi
        return [hi + RANKS[k] + suit for k in range(j, i, -1)]
    return [hi + lo + suit]


def expand(tokens):
    combos = set()
    for t in tokens:
        combos.update(_expand_token(t))
    return combos


def classify(card1, card2):
    """('Ah','5c') -> 'A5o'; returns 169-grid class."""
    r1, s1 = card1[0], card1[1]
    r2, s2 = card2[0], card2[1]
    if RANKS.index(r1) > RANKS.index(r2):
        r1, r2 = r2, r1
    if r1 == r2:
        return r1 + r2
    return r1 + r2 + ("s" if s1 == s2 else "o")


# ---------------------------------------------------------------------------
# RFI (open-raise) ranges, first-in
# ---------------------------------------------------------------------------
# Calibrated to user's GTO Wizard 6max NL25 100bb screenshots (2026-07),
# mixed-frequency hands rounded to the majority action.
RFI = {
    "UTG": expand([
        "66+", "A2s+", "K5s+", "Q9s+", "JTs", "T9s", "ATo+", "KTo+",
    ]),
    "HJ": expand([
        "55+", "A2s+", "K4s+", "Q8s+", "J9s+", "T9s", "98s", "76s", "65s",
        "A9o+", "KTo+", "QTo+",
    ]),
    "CO": expand([
        "44+", "A2s+", "K3s+", "Q8s+", "J8s+", "T8s+", "98s", "87s", "76s",
        "65s", "54s", "A8o+", "A5o", "KTo+", "QTo+", "JTo",
    ]),
    "BTN": expand([
        "22+", "A2s+", "K2s+", "Q3s+", "J5s+", "T6s+", "97s+", "86s+",
        "75s+", "64s+", "54s", "43s", "A3o+", "K8o+", "Q9o+", "J9o+", "T9o",
    ]),
    # SB: raise + limp combined into one "playable" range; both raising and
    # limping these hands count as correct, folding them is flagged.
    # Calibrated to user's GTO Wizard SB screenshot (2026-07-19).
    "SB": expand([
        "22+", "A2s+", "K2s+", "Q2s+", "J3s+", "T5s+", "95s+", "85s+",
        "74s+", "64s+", "53s+", "43s", "A2o+", "K8o+", "Q8o+", "J8o+",
        "T8o+", "98o",
    ]),
}

# SB first-in split for display: majority-raise hands vs majority-limp hands.
# From the same screenshot; mixed cells rounded to the dominant action.
SB_RAISE = expand([
    "22+", "A2s+", "K2s+", "Q2s+", "J4s+", "T6s+", "96s+", "86s+",
    "75s+", "65s", "54s", "A2o+", "K9o+", "Q9o+", "J9o+", "T9o",
])
SB_LIMP = RFI["SB"] - SB_RAISE

# ---------------------------------------------------------------------------
# Facing an open raise: 3-bet / call ranges by (hero_pos, opener_pos)
# ---------------------------------------------------------------------------
VS_OPEN = {
    # --- calibrated to user's GTO Wizard NL25 100bb screenshots (2026-07) ---
    ("HJ", "UTG"): {
        "3bet": expand(["JJ+", "AQs+", "AQo+", "KQs", "KJs", "KTs", "K9s", "A5s", "A4s", "KQo"]),
        "call": expand(["TT", "99", "AJs", "ATs"]),
    },
    ("CO", "UTG"): {
        "3bet": expand(["JJ+", "AQs+", "AQo+", "KQs", "KJs", "K9s", "A5s", "A4s", "KQo"]),
        "call": expand(["TT", "99", "AJs", "ATs", "KTs"]),
    },
    ("CO", "HJ"): {
        "3bet": expand(["JJ+", "AQs+", "AQo+", "KQs", "KJs", "K9s", "A8s", "A5s", "A4s", "KQo"]),
        "call": expand(["TT", "99", "88", "AJs", "ATs", "KTs", "QJs", "JTs"]),
    },
    ("BTN", "UTG"): {
        "3bet": expand(["QQ+", "AKs", "AKo", "AQo", "A5s", "A4s", "KQo"]),
        "call": expand(["JJ", "TT", "99", "88", "77", "66", "AQs", "AJs", "ATs", "KQs", "KJs", "KTs", "QJs", "JTs"]),
    },
    ("BTN", "HJ"): {
        "3bet": expand(["QQ+", "AKs", "AKo", "AQo", "QJs", "A5s", "A4s", "KQo"]),
        "call": expand(["JJ", "TT", "99", "88", "77", "66", "AQs", "AJs", "ATs", "KQs", "KJs", "KTs", "QTs", "JTs", "T9s"]),
    },
    ("BTN", "CO"): {
        "3bet": expand(["JJ+", "AQs+", "AQo+", "AJo", "KQo", "KJo", "KQs", "KJs", "K9s", "QJs", "A8s", "A5s", "A4s"]),
        "call": expand(["TT", "99", "88", "77", "66", "55", "AJs", "ATs", "A9s", "KTs", "QTs", "JTs", "T9s", "98s", "87s", "76s"]),
    },
    ("SB", "UTG"): {
        "3bet": expand(["QQ+", "AKs", "AKo", "AQo", "KQs", "KJs", "KTs", "QJs", "T9s", "A5s", "A4s"]),
        "call": expand(["JJ", "TT", "99", "AQs", "AJs"]),
    },
    ("SB", "HJ"): {
        "3bet": expand(["TT+", "AQs+", "AQo+", "KQs", "KJs", "KTs", "QJs", "QTs", "T9s", "A5s", "A4s"]),
        "call": expand(["99", "AJs"]),
    },
    ("SB", "CO"): {
        "3bet": expand(["99+", "ATs+", "AJo+", "KQo", "KJo", "KTs+", "QTs+", "JTs", "T9s", "K9s", "A5s", "A4s"]),
        "call": expand([]),
    },
    ("SB", "BTN"): {
        "3bet": expand(["88+", "AKs", "ATs", "A9s", "A8s", "A5s", "A4s", "KJs", "KTs", "QTs+", "JTs", "T9s", "AJo+", "KQo", "KJo"]),
        "call": expand(["AQs", "AJs", "KQs", "77", "66", "55"]),
    },
    ("BB", "UTG"): {
        "3bet": expand(["KK+", "AKs", "AKo", "A6s", "K5s", "Q9s"]),
        "call": expand(["22+", "A2s+", "K6s+", "QTs+", "J9s+", "T8s+", "97s+", "86s+", "75s+", "64s+", "53s+", "43s", "ATo+", "KJo+", "KQo"]),
    },
    ("BB", "HJ"): {
        "3bet": expand(["QQ+", "AKs", "AKo", "A5s", "A4s", "A3s", "K6s", "K5s", "Q8s"]),
        "call": expand(["22+", "A2s+", "K2s+", "Q4s+", "J7s+", "T6s+", "96s+", "86s+", "75s+", "64s+", "54s", "43s", "ATo+", "KTo+", "QJo", "JTo"]),
    },
    ("BB", "CO"): {
        "3bet": expand(["JJ+", "AKs", "AKo", "A5s", "A4s", "A3s", "76s", "65s"]),
        "call": expand(["22+", "A2s+", "K2s+", "Q4s+", "J6s+", "T6s+", "96s+", "85s+", "75s+", "64s+", "53s+", "43s", "A9o+", "KTo+", "QTo+", "JTo", "T9o"]),
    },
    ("BB", "BTN"): {
        "3bet": expand(["99+", "ATs+", "AJo+", "KJs+", "QJs", "JTs", "T9s", "A5s", "A4s", "A3s", "A2s", "KQo", "87s", "76s"]),
        "call": expand(["22+", "A2s+", "K2s+", "Q2s+", "J4s+", "T5s+", "95s+", "84s+", "74s+", "63s+", "53s+", "43s", "A2o+", "K8o+", "Q9o+", "J8o+", "T8o+", "98o", "87o"]),
    },
    ("BB", "SB"): {
        "3bet": expand(["88+", "A9s+", "A5s", "A4s", "ATo+", "KTs+", "K9s", "QTs+", "JTs", "T9s", "98s", "KQo", "KJo", "KTo"]),
        "call": expand(["22+", "A2s+", "K2s+", "Q2s+", "J2s+", "T2s+", "92s+", "82s+", "72s+", "62s+", "52s+", "42s+", "32s", "A2o+", "K4o+", "Q5o+", "J7o+", "T7o+", "97o+", "86o+", "76o", "65o"]),
    },
}


# ---------------------------------------------------------------------------
# Facing a 3-bet after we opened: 4-bet / call ranges by (hero_pos, 3bettor_pos)
# ---------------------------------------------------------------------------
VS_3BET = {
    # UTG opened 2.5x, HJ 3-bet to 8 (GTO Wizard screenshot 2026-07)
    ("UTG", "HJ"): {
        "4bet": expand(["KK+", "AKs", "AKo", "KJs", "KTs", "A5s"]),
        "call": expand(["QQ", "JJ", "TT", "99", "AQs", "KQs", "AJs"]),
    },
    # UTG opened 2.5x, CO 3-bet to 8 -- grid nearly identical to vs HJ
    ("UTG", "CO"): {
        "4bet": expand(["KK+", "AKs", "AKo", "KJs", "KTs", "A5s"]),
        "call": expand(["QQ", "JJ", "TT", "99", "AQs", "KQs", "AJs"]),
    },
    # ------------------------------------------------------------------
    # Below: standard simplified 100bb defaults, NOT yet screenshot-
    # calibrated. Spot-check against GTO Wizard / grindgto and correct
    # either here or via the in-app range editor (custom overrides win).
    # ------------------------------------------------------------------
    ("UTG", "BTN"): {
        "4bet": expand(["KK+", "AKs", "AKo", "A5s"]),
        "call": expand(["QQ", "JJ", "TT", "99", "AQs", "AJs", "KQs"]),
    },
    ("UTG", "SB"): {
        "4bet": expand(["KK+", "AKs", "AKo", "A5s"]),
        "call": expand(["QQ", "JJ", "TT", "99", "AQs", "AJs", "KQs"]),
    },
    ("UTG", "BB"): {
        "4bet": expand(["KK+", "AKs", "AKo", "A5s"]),
        "call": expand(["QQ", "JJ", "TT", "99", "88", "AQs", "AJs", "KQs"]),
    },
    ("HJ", "CO"): {
        "4bet": expand(["KK+", "AKs", "AKo", "A5s", "KJs"]),
        "call": expand(["QQ", "JJ", "TT", "99", "88", "AQs", "AJs", "ATs", "KQs"]),
    },
    ("HJ", "BTN"): {
        "4bet": expand(["KK+", "AKs", "AKo", "A5s"]),
        "call": expand(["QQ", "JJ", "TT", "99", "88", "AQs", "AJs", "KQs"]),
    },
    ("HJ", "SB"): {
        "4bet": expand(["KK+", "AKs", "AKo", "A5s"]),
        "call": expand(["QQ", "JJ", "TT", "99", "88", "AQs", "AJs", "KQs"]),
    },
    ("HJ", "BB"): {
        "4bet": expand(["QQ+", "AKs", "AKo", "A5s"]),
        "call": expand(["JJ", "TT", "99", "88", "77", "AQs", "AJs", "ATs", "KQs"]),
    },
    ("CO", "BTN"): {
        "4bet": expand(["QQ+", "AKs", "AKo", "AQo", "A5s", "A4s"]),
        "call": expand(["JJ", "TT", "99", "88", "77",
                        "AQs", "AJs", "ATs", "KQs", "KJs"]),
    },
    ("CO", "SB"): {
        "4bet": expand(["QQ+", "AKs", "AKo", "A5s", "A4s"]),
        "call": expand(["JJ", "TT", "99", "88", "AQs", "AJs", "KQs", "KJs"]),
    },
    ("CO", "BB"): {
        "4bet": expand(["QQ+", "AKs", "AKo", "A5s", "A4s"]),
        "call": expand(["JJ", "TT", "99", "88", "77", "AQs", "AJs", "ATs", "KQs"]),
    },
    ("BTN", "SB"): {
        "4bet": expand(["QQ+", "AKs", "AKo", "AQo", "A5s", "A4s"]),
        "call": expand(["JJ", "TT", "99", "88", "77", "66",
                        "AQs", "AJs", "ATs", "KQs", "KJs", "KTs",
                        "QJs", "JTs", "T9s"]),
    },
    ("BTN", "BB"): {
        "4bet": expand(["QQ+", "AKs", "AKo", "AQo", "A5s", "A4s"]),
        "call": expand(["JJ", "TT", "99", "88", "77", "66",
                        "AQs", "AJs", "ATs", "A9s", "KQs", "KJs", "KTs",
                        "QJs", "JTs"]),
    },
    # SB opened 3.5x, BB 3-bet to 10.5 (GTO Wizard screenshot 2026-07)
    ("SB", "BB"): {
        "4bet": expand(["TT+", "AKs", "AQs", "AKo", "AQo", "AJo", "ATo",
                        "KQo", "KJo", "A5s", "A4s", "A3s"]),
        "call": expand(["99", "88", "77", "66", "55", "44", "33", "22",
                        "AJs", "ATs", "A9s", "A8s", "A7s", "A6s",
                        "KQs", "KJs", "KTs", "K9s", "QJs", "QTs", "JTs", "T9s"]),
    },
}


def rfi_action(position, hand_class):
    """Correct first-in action for hero: 'raise' or 'fold'."""
    if position == "BB":
        return None  # BB can't open
    table = RFI.get(position)
    if table is None:
        return None
    return "raise" if hand_class in table else "fold"


def vs_open_action(hero_pos, opener_pos, hand_class):
    """Correct action facing a single open: '3bet' / 'call' / 'fold'."""
    table = VS_OPEN.get((hero_pos, opener_pos))
    if table is None:
        return None
    if hand_class in table["3bet"]:
        return "3bet"
    if hand_class in table["call"]:
        return "call"
    return "fold"


def vs_3bet_action(hero_pos, threebettor_pos, hand_class):
    """Correct action after our open gets 3-bet: '4bet' / 'call' / 'fold'."""
    table = VS_3BET.get((hero_pos, threebettor_pos))
    if table is None:
        return None
    if hand_class in table["4bet"]:
        return "4bet"
    if hand_class in table["call"]:
        return "call"
    return "fold"
