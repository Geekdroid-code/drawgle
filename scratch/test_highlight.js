const fs = require('fs');

function highlightHTML(code) {
  let escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const comments = [];
  escaped = escaped.replace(/&lt;!--[\s\S]*?--&gt;/g, (match) => {
    comments.push(match);
    return `___COMMENT_PLACEHOLDER_${comments.length - 1}___`;
  });

  escaped = escaped.replace(/(&lt;\/?[a-zA-Z0-9:-]+)([\s\S]*?)(&gt;)/g, (match, p1, p2, p3) => {
    let tagHtml = `<span class="text-sky-400 font-semibold">${p1}</span>`;
    let attrs = p2;
    if (attrs) {
      attrs = attrs.replace(/([a-zA-Z0-9:-]+)(=(?:"[^"]*"|'[^']*'|[^\s"'>]+))?/g, (attrMatch, attrName, attrVal) => {
        let highlightedAttr = `<span class="text-purple-300">${attrName}</span>`;
        if (attrVal) {
          const equalsIdx = attrVal.indexOf('=');
          const eq = attrVal.slice(0, equalsIdx + 1);
          const val = attrVal.slice(equalsIdx + 1);
          highlightedAttr += `<span class="text-slate-400">${eq}</span><span class="text-emerald-300">${val}</span>`;
        }
        return highlightedAttr;
      });
    }
    return tagHtml + attrs + `<span class="text-sky-400 font-semibold">${p3}</span>`;
  });

  escaped = escaped.replace(/___COMMENT_PLACEHOLDER_(\d+)___/g, (match, index) => {
    return `<span class="text-slate-500 italic font-normal">${comments[parseInt(index, 10)]}</span>`;
  });

  return escaped;
}

// Generate 500KB HTML with huge SVG paths and base64
const svgPath = "M " + Array.from({ length: 5000 }, (_, i) => `${i} ${i * 2}`).join(" L ");
const base64Data = "data:image/png;base64," + "A".repeat(100000);
const hugeHTML = `<!DOCTYPE html>
<html>
  <body>
    <!-- SVG and images -->
    <svg width="500" height="500" viewBox="0 0 500 500">
      <path d="${svgPath}" fill="red" stroke="blue" stroke-width="2" />
    </svg>
    <img src="${base64Data}" alt="Huge Image" />
  </body>
</html>`;

console.log("Input size:", (hugeHTML.length / 1024).toFixed(2), "KB");
console.time("Highlight Time");
const result = highlightHTML(hugeHTML);
console.timeEnd("Highlight Time");
console.log("Output size:", (result.length / 1024).toFixed(2), "KB");
