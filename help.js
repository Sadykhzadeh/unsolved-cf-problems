import { isHelpKey } from "./lib.js";

// The list of keyboard shortcuts, shown in the dialog in the markup. Filled the first
// time ? is pressed (see script.js). Keys pressed inside the dialog stop there, so the
// shortcuts behind it do not act, and ? closes it.
export const fillHelp = ({ byId, text }) => {
  const dialog = byId("keysHelp");
  const title = document.createElement("h2");
  title.id = "keysHelpTitle";
  title.textContent = text.keysHelpTitle;

  const list = document.createElement("dl");
  for (const { keys, meaning } of text.keysHelpRows) {
    const term = document.createElement("dt");
    keys.forEach((key, index) => {
      if (index > 0) term.append(" / ");
      const kbd = document.createElement("kbd");
      kbd.textContent = key;
      term.append(kbd);
    });
    const description = document.createElement("dd");
    description.textContent = meaning;
    list.append(term, description);
  }

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = text.keysHelpClose;
  close.addEventListener("click", () => dialog.close());

  dialog.append(title, list, close);
  dialog.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (isHelpKey(event.key)) dialog.close();
  });
};
