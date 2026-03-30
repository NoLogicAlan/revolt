export const categories = [{ // TODO: improve this text
  reaction: "🏠",
  content: [`# Home\n\nWelcome to the Remix help page.\n\nRemix is Stoat's first open-source music bot. It supports a variety of streaming services and has many features, with one of the newest being the [Web Dashboard](https://remix.fairuse.org/).\n\nWe hope you enjoy using Remix!\n\nTo get started, just click on the reactions below to find out more about the commands. In the case that reactions don't work for you, there's also the possibility to look through them by using \`$prefixhelp <page number>\` :)`],
  form: "$content\n\n###### Page $currentPage/$maxPage",
  title: "Home Page"
}, {
  reaction: "🎵",
  category: "default",
  form: `# Music\n\n$content\n\nTo learn more about a command, run \`$prefixhelp <command name>\`!\n\nTip: You can use the arrows beneath this message to turn pages, or use \`$prefixhelp <page number>\` to access a certain page.\n\n###### Page $currentPage/$maxPage`,
  title: "Music Commands"
}, { // TODO: add more info here
  reaction: "📝",
  category: "util",
  form: `# Utilities\n\n$content\n\nTo learn more about a command, run \`$prefixhelp <command name>\`!\n\nTip: You can use the arrows beneath this message to turn pages, or use \`$prefixhelp <page number>\` to access a certain page.\n\n###### Page $currentPage/$maxPage`,
  title: "Utility Commands"
}, {
  reaction: "💻",
  content: ["If you need help with anything or encounter any issues, hop over to our support server [Remix HQ](https://stt.gg/Remix)!\nAlternatively, you can write a dm to any of the following people:\n\n- <@01FZ5P08W36B05M18FP3HF4PT1> (Community Manager)\n- <@01G9MCW5KZFKT2CRAD3G3B9JN5> (Lead Developer)\n- <@01FVB1ZGCPS8TJ4PD4P7NAFDZA> (Junior Developer)"],
  form: "# Support\n\n$content\n\n###### Page $currentPage/$maxPage",
  title: "Support Info"
}];
