"""Analyze GG hand histories: stats, preflop range check, leak-hand filter.

Usage: python src/analyze.py <hands_dir> [-o report.md]
"""
import argparse
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from hand_parser import parse_dir
from ranges import classify, rfi_action, vs_open_action, vs_3bet_action

BIG_LOSS_BB = 30
POS_ORDER = ["UTG", "HJ", "CO", "BTN", "SB", "BB"]


def hero_preflop_spot(hand):
    """Return (spot, facing, hero_action) for hero's first voluntary decision.

    spot: 'rfi' (nobody raised, no limpers ahead), 'vs_open' (exactly one
    raise, no callers of it), or None (limped pots, multiway, squeezes...).
    """
    raises = []
    limpers = 0
    callers_of_raise = 0
    for a in hand.preflop_actions():
        if a.player == "Hero" and a.kind in ("fold", "call", "raise", "check"):
            if not raises and limpers == 0:
                return "rfi", None, a.kind
            if len(raises) == 1 and callers_of_raise == 0 and limpers == 0:
                return "vs_open", raises[0], a.kind
            return None, None, a.kind
        if a.kind == "raise":
            raises.append(a.player)
        elif a.kind == "call":
            if raises:
                callers_of_raise += 1
            else:
                limpers += 1
    return None, None, None


def hero_vs_3bet_spot(hand):
    """If hero open-raised and got 3-bet by exactly one player, return
    (threebettor, hero_response_kind); else (None, None)."""
    raises = []
    for a in hand.preflop_actions():
        if a.kind == "raise":
            raises.append(a.player)
            continue
        if (a.player == "Hero" and a.kind in ("fold", "call")
                and len(raises) == 2 and raises[0] == "Hero"):
            return raises[1], a.kind
    if len(raises) >= 3 and raises[0] == "Hero" and raises[2] == "Hero":
        return raises[1], "raise"
    return None, None


def _categorize(spot, actual, correct):
    if spot == "rfi":
        if actual == "fold":
            return "RFI 太緊(該 open 沒 open)"
        if actual == "limp/call":
            return "RFI 用 limp"
        return "RFI 太鬆(open 過寬)"
    if actual == "fold":
        return "太緊(該防守沒防守)"
    if correct == "3bet" and actual == "call":
        return "該 3bet 卻 call"
    if correct == "fold" and actual == "3bet":
        return "3bet 選牌錯"
    if correct == "fold" and actual == "call":
        return "call 過鬆"
    if correct == "call" and actual == "3bet":
        return "該 call 卻 3bet"
    return "vs 3bet 應對錯"


def preflop_decisions(h, hc):
    """Evaluate all of hero's judgeable preflop decisions in this hand.

    Returns a list of dicts: {spot, actual, correct, ok, category}.
    """
    out = []
    spot, opener, action = hero_preflop_spot(h)
    if spot == "rfi" and h.hero_position != "BB":
        correct = rfi_action(h.hero_position, hc)
        actual = "raise" if action == "raise" else (
            "fold" if action == "fold" else "limp/call")
        if correct:
            if h.hero_position == "SB" and correct == "raise":
                ok = actual != "fold"
                correct = "raise/limp"
            else:
                ok = actual == correct
            out.append({"spot": "RFI", "kind": "rfi",
                        "key": f"RFI {h.hero_position}",
                        "actual": actual, "correct": correct, "ok": ok,
                        "category": None if ok else _categorize("rfi", actual, correct)})
    elif spot == "vs_open" and opener:
        opener_pos = h.positions.get(opener, "")
        correct = vs_open_action(h.hero_position, opener_pos, hc)
        actual = {"raise": "3bet", "call": "call", "fold": "fold"}.get(action)
        if correct and actual:
            ok = actual == correct
            out.append({"spot": f"vs {opener_pos} open", "kind": "vs_open",
                        "key": f"{h.hero_position} vs {opener_pos} open",
                        "actual": actual, "correct": correct, "ok": ok,
                        "category": None if ok else _categorize("vs_open", actual, correct)})

    threebettor, response = hero_vs_3bet_spot(h)
    if threebettor:
        tb_pos = h.positions.get(threebettor, "")
        correct = vs_3bet_action(h.hero_position, tb_pos, hc)
        actual = {"raise": "4bet", "call": "call", "fold": "fold"}.get(response)
        if correct and actual:
            ok = actual == correct
            out.append({"spot": f"open 被 {tb_pos} 3bet", "kind": "vs_3bet",
                        "key": f"{h.hero_position} open 被 {tb_pos} 3bet",
                        "actual": actual, "correct": correct, "ok": ok,
                        "category": None if ok else _categorize("vs_3bet", actual, correct)})
    return out


def hero_vpip_pfr_3bet(hand):
    vpip = pfr = False
    threebet_opp = threebet = False
    raises_before = 0
    for a in hand.preflop_actions():
        if a.player == "Hero":
            if a.kind in ("call", "raise"):
                vpip = True
            if a.kind == "raise":
                pfr = True
                if raises_before == 1:
                    threebet = True
            if raises_before == 1 and a.kind in ("fold", "call", "raise"):
                threebet_opp = True
        if a.kind == "raise":
            raises_before += 1
    return vpip, pfr, threebet_opp, threebet


def analyze(hands):
    stats = {
        "hands": 0, "vpip": 0, "pfr": 0, "3bet_opp": 0, "3bet": 0,
        "wtsd": 0, "saw_flop": 0, "net_bb": 0.0,
    }
    by_pos = defaultdict(lambda: {"hands": 0, "net_bb": 0.0})
    by_stake = defaultdict(lambda: {"hands": 0, "net_bb": 0.0})
    pf_mistakes = []
    leak_hands = []

    for h in hands:
        if not h.hero_cards or not h.hero_position:
            continue
        stats["hands"] += 1
        stats["net_bb"] += h.hero_net_bb
        by_pos[h.hero_position]["hands"] += 1
        by_pos[h.hero_position]["net_bb"] += h.hero_net_bb
        stake = f"NL{int(h.bb * 100)}"
        by_stake[stake]["hands"] += 1
        by_stake[stake]["net_bb"] += h.hero_net_bb

        vpip, pfr, tb_opp, tb = hero_vpip_pfr_3bet(h)
        stats["vpip"] += vpip
        stats["pfr"] += pfr
        stats["3bet_opp"] += tb_opp
        stats["3bet"] += tb

        hero_streets = {a.street for a in h.actions if a.player == "Hero"}
        hero_folded = any(
            a.player == "Hero" and a.kind == "fold" for a in h.actions
        )
        if "flop" in hero_streets or (vpip and not hero_folded and h.board):
            stats["saw_flop"] += 1
            if h.went_to_showdown and not hero_folded:
                stats["wtsd"] += 1

        # preflop range check
        hc = classify(*h.hero_cards)
        for d in preflop_decisions(h, hc):
            if not d["ok"]:
                pf_mistakes.append(
                    (h, d["spot"], h.hero_position, hc, d["actual"], d["correct"]))

        # leak-hand filter
        reasons = []
        if h.hero_net_bb <= -BIG_LOSS_BB:
            reasons.append(f"輸 {-h.hero_net_bb:.0f}bb 大底池")
        if h.went_to_showdown and not hero_folded and h.hero_net < 0:
            reasons.append("攤牌輸")
        if tb and h.hero_net_bb <= -15:
            reasons.append("3-bet 底池虧損")
        if reasons:
            leak_hands.append((h, reasons))

    leak_hands.sort(key=lambda x: x[0].hero_net_bb)
    return stats, by_pos, by_stake, pf_mistakes, leak_hands


def pct(n, d):
    return f"{100 * n / d:.1f}%" if d else "-"


def render_report(stats, by_pos, by_stake, pf_mistakes, leak_hands):
    L = []
    n = stats["hands"]
    L.append("# 手牌檢討報告\n")
    L.append("## 整體數據\n")
    L.append(f"| 指標 | 數值 |\n|---|---|")
    L.append(f"| 總手數 | {n} |")
    L.append(f"| 總盈虧 | {stats['net_bb']:+.1f} bb |")
    L.append(f"| bb/100 | {100 * stats['net_bb'] / n:+.1f} |" if n else "")
    L.append(f"| VPIP | {pct(stats['vpip'], n)} |")
    L.append(f"| PFR | {pct(stats['pfr'], n)} |")
    L.append(f"| 3-bet | {pct(stats['3bet'], stats['3bet_opp'])} |")
    L.append(f"| WTSD (看到翻牌後) | {pct(stats['wtsd'], stats['saw_flop'])} |")

    L.append("\n## 各位置盈虧\n\n| 位置 | 手數 | 盈虧(bb) | bb/100 |\n|---|---|---|---|")
    for pos in POS_ORDER:
        d = by_pos.get(pos)
        if d and d["hands"]:
            L.append(f"| {pos} | {d['hands']} | {d['net_bb']:+.1f} | "
                     f"{100 * d['net_bb'] / d['hands']:+.1f} |")

    L.append("\n## 各級別盈虧\n\n| 級別 | 手數 | 盈虧(bb) | bb/100 |\n|---|---|---|---|")
    for stake, d in sorted(by_stake.items()):
        L.append(f"| {stake} | {d['hands']} | {d['net_bb']:+.1f} | "
                 f"{100 * d['net_bb'] / d['hands']:+.1f} |")

    L.append(f"\n## 翻前範圍偏差 ({len(pf_mistakes)} 手)\n")
    L.append("與基準表(GTO Wizard 100bb 簡化純策略)不一致的翻前決策:\n")
    L.append("| 手牌 | 位置 | 情境 | 你的動作 | 基準動作 | 結果(bb) | Hand ID |")
    L.append("|---|---|---|---|---|---|---|")
    for h, spot, pos, hc, actual, correct in pf_mistakes:
        L.append(f"| {hc} | {pos} | {spot} | {actual} | {correct} | "
                 f"{h.hero_net_bb:+.1f} | {h.hand_id} |")

    L.append(f"\n## 值得檢討的手牌 (前 {min(len(leak_hands), 25)} 手)\n")
    L.append("| 手牌 | 位置 | 盈虧(bb) | 原因 | Hand ID | 檔案 |")
    L.append("|---|---|---|---|---|---|")
    for h, reasons in leak_hands[:25]:
        hc = classify(*h.hero_cards)
        L.append(f"| {hc} | {h.hero_position} | {h.hero_net_bb:+.1f} | "
                 f"{'、'.join(reasons)} | {h.hand_id} | {h.source_file} |")
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("hands_dir")
    ap.add_argument("-o", "--output", default="report.md")
    args = ap.parse_args()

    hands = parse_dir(args.hands_dir)
    print(f"parsed {len(hands)} hands")
    result = analyze(hands)
    report = render_report(*result)
    Path(args.output).write_text(report, encoding="utf-8")
    print(f"report written to {args.output}")


if __name__ == "__main__":
    main()
