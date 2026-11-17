// The keys that move a highlight down the list and open the highlighted problem. Read
// the first time one of them is pressed with a list on screen (see script.js).
export const createKeys = ({ drawn, highlight, setHighlight }) => {
  // The row j and k move through, and that o or Enter opens. Its highlight is a
  // class, so focus stays where it was.
  const moveHighlight = (step) => {
    const shown = drawn().filter(([tr]) => !tr.hidden);
    if (!shown.length) return;
    const at = shown.findIndex(([, row]) => row === highlight());
    const next = at === -1 ? (step > 0 ? 0 : shown.length - 1) : Math.min(shown.length - 1, Math.max(0, at + step));
    setHighlight(shown[next][1]);
    for (const [tr, row] of drawn()) tr.classList.toggle("highlight", row === highlight());
    shown[next][0].scrollIntoView({ block: "nearest" });
  };

  const openHighlighted = () => {
    const entry = drawn().find(([tr, row]) => row === highlight() && !tr.hidden);
    if (entry) entry[0].querySelector(".problemName").click();
  };

  // Enter is left to a button or a link that has the focus, since it already acts on it.
  // Holding o opens one problem, not a run of tabs.
  const press = (action, event) => {
    const native = event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement;
    if (action === "open" && (event.repeat || (event.key === "Enter" && native))) return;
    event.preventDefault();
    if (action === "open") openHighlighted();
    else moveHighlight(action === "next" ? 1 : -1);
  };

  return { press };
};
