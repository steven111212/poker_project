// ---------- goal ----------
const goalStake = document.getElementById("goalStake");
const goalTarget = document.getElementById("goalTarget");
document.getElementById("goalSave").onclick = () => {
  localStorage.setItem(GOAL_KEY, JSON.stringify(
    { bb: +goalStake.value, target: +goalTarget.value }));
  renderAll();
};
