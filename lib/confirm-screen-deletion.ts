export function confirmPermanentScreenDeletion(name: string): boolean {
  return window.confirm(`Permanently delete “${name}”? Its saved design and recovery history will be removed. This cannot be undone.`);
}
