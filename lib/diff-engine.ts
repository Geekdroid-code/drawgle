export function applyEdits(originalCode: string, editsText: string): string {
  let newCode = originalCode;
  
  // Regex to match <edit> blocks
  const editRegex = /<edit>\s*<search>([\s\S]*?)<\/search>\s*<replace>([\s\S]*?)<\/replace>\s*<\/edit>/g;
  
  let match;
  let hasEdits = false;
  
  while ((match = editRegex.exec(editsText)) !== null) {
    hasEdits = true;
    const searchBlock = match[1];
    const replaceBlock = match[2];
    
    // We need to handle potential whitespace trimming issues.
    // The AI might output slightly different indentation.
    // For a robust implementation, we try exact match first.
    if (newCode.includes(searchBlock)) {
      newCode = newCode.replace(searchBlock, replaceBlock);
    } else {
      // If exact match fails, try a more flexible match (ignoring leading/trailing whitespace on each line)
      const flexibleSearch = searchBlock.split('\n').map(l => l.trim()).filter(l => l).join('\\s*\\n\\s*');
      if (flexibleSearch) {
        try {
          const flexRegex = new RegExp(flexibleSearch, 'g');
          newCode = newCode.replace(flexRegex, replaceBlock);
        } catch (e) {
          console.error("Failed to apply flexible regex for block:", searchBlock);
        }
      }
    }
  }
  
  // If no <edit> blocks were found, but the text contains HTML, the AI might have just returned the full code.
  if (!hasEdits && (editsText.includes('<div') || editsText.includes('<html'))) {
    // Extract code block if it exists
    const codeMatch = editsText.match(/```(?:html)?\n([\s\S]*?)\n```/);
    if (codeMatch) {
      return codeMatch[1].trim();
    }
    // Or just return the text if it looks like raw HTML
    if (editsText.trim().startsWith('<')) {
      return editsText.trim();
    }
  }
  
  return newCode;
}
