"""Parser for GG/Natural8 hand history text files."""
import re
from dataclasses import dataclass, field
from pathlib import Path

POSITIONS_6MAX = ["SB", "BB", "UTG", "HJ", "CO", "BTN"]

HAND_HEADER_RE = re.compile(
    r"Poker Hand #(\S+): Hold'em No Limit \(\$([\d.]+)/\$([\d.]+)\) - (.+)"
)
SEAT_RE = re.compile(r"Seat (\d+): (\S+) \(\$([\d.]+) in chips\)")
BUTTON_RE = re.compile(r"Seat #(\d+) is the button")
ACTION_RE = re.compile(
    r"^(\S+): (folds|checks|calls \$[\d.]+|bets \$[\d.]+"
    r"|raises \$[\d.]+ to \$[\d.]+|posts small blind \$[\d.]+"
    r"|posts big blind \$[\d.]+)(?: and is all-in)?$"
)
DEALT_RE = re.compile(r"Dealt to Hero \[(\w\w) (\w\w)\]")
COLLECTED_RE = re.compile(r"^(\S+) collected \$([\d.]+) from pot")
UNCALLED_RE = re.compile(r"Uncalled bet \(\$([\d.]+)\) returned to (\S+)")
BOARD_RE = re.compile(r"Board \[([^\]]+)\]")
STREET_MARKERS = {
    "*** FLOP ***": "flop",
    "*** TURN ***": "turn",
    "*** RIVER ***": "river",
    "*** SHOWDOWN ***": "showdown",
    "*** SUMMARY ***": "summary",
}


@dataclass
class Action:
    street: str
    player: str
    kind: str          # fold/check/call/bet/raise/post_sb/post_bb
    amount: float = 0.0  # total committed this street after the action


@dataclass
class Hand:
    hand_id: str = ""
    sb: float = 0.0
    bb: float = 0.0
    timestamp: str = ""
    source_file: str = ""
    hero_cards: tuple = ()
    hero_position: str = ""
    positions: dict = field(default_factory=dict)  # player -> position
    board: list = field(default_factory=list)
    actions: list = field(default_factory=list)
    hero_net: float = 0.0
    went_to_showdown: bool = False
    players: int = 0

    @property
    def hero_net_bb(self):
        return self.hero_net / self.bb if self.bb else 0.0

    def preflop_actions(self):
        return [a for a in self.actions if a.street == "preflop"]


def _parse_action(m):
    text = m.group(2)
    if text == "folds":
        return "fold", None
    if text == "checks":
        return "check", None
    for kind, pat in (
        ("call", r"calls \$([\d.]+)"),
        ("bet", r"bets \$([\d.]+)"),
        ("post_sb", r"posts small blind \$([\d.]+)"),
        ("post_bb", r"posts big blind \$([\d.]+)"),
    ):
        m2 = re.fullmatch(pat, text)
        if m2:
            return kind, float(m2.group(1))
    m2 = re.fullmatch(r"raises \$[\d.]+ to \$([\d.]+)", text)
    if m2:
        return "raise", float(m2.group(1))
    return None, None


def parse_hand(text, source_file=""):
    lines = [ln.strip() for ln in text.strip().splitlines() if ln.strip()]
    if not lines:
        return None
    header = HAND_HEADER_RE.match(lines[0])
    if not header:
        return None

    hand = Hand(
        hand_id=header.group(1),
        sb=float(header.group(2)),
        bb=float(header.group(3)),
        timestamp=header.group(4),
        source_file=source_file,
    )

    seats = {}
    button_seat = None
    street = "preflop"
    street_committed = {}
    invested = {}
    collected = {}
    uncalled = {}

    saw_streets = set()
    for line in lines[1:]:
        marker = next((v for k, v in STREET_MARKERS.items() if line.startswith(k)), None)
        if marker:
            street = marker
            saw_streets.add(marker)
            street_committed = {}
            continue
        if street == "summary":
            continue

        m = BUTTON_RE.search(line)
        if m:
            button_seat = int(m.group(1))
            continue
        m = SEAT_RE.match(line)
        if m:
            seats[int(m.group(1))] = m.group(2)
            continue
        m = DEALT_RE.match(line)
        if m:
            hand.hero_cards = (m.group(1), m.group(2))
            continue
        m = COLLECTED_RE.match(line)
        if m:
            collected[m.group(1)] = collected.get(m.group(1), 0.0) + float(m.group(2))
            continue
        m = UNCALLED_RE.search(line)
        if m:
            uncalled[m.group(2)] = uncalled.get(m.group(2), 0.0) + float(m.group(1))
            continue
        m = BOARD_RE.search(line)
        if m:
            hand.board = m.group(1).split()
            continue
        m = ACTION_RE.match(line)
        if m and street in ("preflop", "flop", "turn", "river"):
            player = m.group(1)
            kind, amount = _parse_action(m)
            if kind is None:
                continue
            prev = street_committed.get(player, 0.0)
            if kind in ("call", "bet", "post_sb", "post_bb"):
                new_total = prev + amount
            elif kind == "raise":
                new_total = amount  # "raises to X" = total this street
            else:
                new_total = prev
            delta = new_total - prev
            street_committed[player] = new_total
            invested[player] = invested.get(player, 0.0) + delta
            hand.actions.append(Action(street, player, kind, new_total))

    hand.players = len(seats)
    hand.went_to_showdown = "showdown" in saw_streets and "river" in saw_streets

    # positions: seats ordered from SB around
    if button_seat is not None and seats:
        seat_nums = sorted(seats)
        if button_seat in seat_nums:
            idx = seat_nums.index(button_seat)
            ordered = seat_nums[idx + 1:] + seat_nums[:idx + 1]  # SB first, BTN last
            n = len(ordered)
            names_by_count = {
                2: ["BB", "SB"],  # heads-up: button posts SB
                3: ["SB", "BB", "BTN"],
                4: ["SB", "BB", "CO", "BTN"],
                5: ["SB", "BB", "HJ", "CO", "BTN"],
                6: POSITIONS_6MAX,
            }
            pos_names = names_by_count.get(n, POSITIONS_6MAX)
            for seat, pos in zip(ordered, pos_names):
                hand.positions[seats[seat]] = pos
                if seats[seat] == "Hero":
                    hand.hero_position = pos

    hand.hero_net = (
        collected.get("Hero", 0.0)
        - invested.get("Hero", 0.0)
        + uncalled.get("Hero", 0.0)
    )
    return hand


def parse_file(path):
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    hands = []
    for chunk in re.split(r"\n\s*\n(?=Poker Hand #)", text):
        h = parse_hand(chunk, source_file=Path(path).name)
        if h:
            hands.append(h)
    return hands


def parse_dir(directory):
    hands = []
    for p in sorted(Path(directory).rglob("*.txt")):
        hands.extend(parse_file(p))
    return hands
