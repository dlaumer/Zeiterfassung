// Never retry mutations automatically: an interrupted email response may still
// mean that the provider accepted the message.
export async function runGroupActions(items, perform, onProgress, pause = () => Promise.resolve()) {
  const results = [];
  for (const [index, item] of items.entries()) {
    onProgress({ completed: index, current: item, results: [...results] });
    try {
      await perform(item);
      results.push({ id: item.id, name: item.name || item.id, ok: true });
    } catch (error) {
      results.push({ id: item.id, name: item.name || item.id, ok: false, reason: error?.groupMessage });
    }
    onProgress({ completed: index + 1, current: null, results: [...results] });
    if (index + 1 < items.length) await pause();
  }
  return results;
}
