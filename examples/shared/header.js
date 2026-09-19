/**
 * Loads the shared header (header.html) via fetch and injects it at the top of
 * the <body> of the page that included it.
 *
 * Usage in each example (all live under examples/<name>/):
 *   <script src="../shared/header.js" defer></script>
 *
 * The header path is resolved relative to THIS script (script.src), so keeping
 * header.js and header.html in the same folder works regardless of how deep the
 * loading page is.
 */
(() => {
	const script = document.currentScript;
	if (!script || !script.src) return;

	const headerUrl = new URL("header.html", script.src);

	fetch(headerUrl, { cache: "no-cache" })
		.then((response) => {
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return response.text();
		})
		.then((html) => {
			const template = document.createElement("template");
			template.innerHTML = html.trim();
			document.body.prepend(...template.content.childNodes);
		})
		.catch((error) => {
			console.error("Failed to load the shared header:", error);
		});
})();