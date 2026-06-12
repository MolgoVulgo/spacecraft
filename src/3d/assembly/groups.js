export function getConnectedAssemblyInstanceIds(instances, { instancesHaveCompatibleAnchors }) {
  if (!instances.length) return new Set();

  const selectedIds = new Set(instances.map((instance) => instance.id));
  const adjacency = new Map(instances.map((instance) => [instance.id, new Set()]));

  for (let i = 0; i < instances.length; i += 1) {
    for (let j = i + 1; j < instances.length; j += 1) {
      const a = instances[i];
      const b = instances[j];
      if (!instancesHaveCompatibleAnchors(a, b)) continue;
      adjacency.get(a.id)?.add(b.id);
      adjacency.get(b.id)?.add(a.id);
    }
  }

  const connected = new Set();
  const queue = [instances[0].id];
  while (queue.length) {
    const current = queue.shift();
    if (connected.has(current) || !selectedIds.has(current)) continue;
    connected.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!connected.has(next)) queue.push(next);
    }
  }

  return connected;
}

export function validateAssemblyGroupConnectivity(instances, deps) {
  if (instances.length < 2) return { valid: false, message: 'Groupe refusé : sélectionne au moins 2 pièces libres.' };
  const connectedIds = getConnectedAssemblyInstanceIds(instances, deps);
  if (connectedIds.size === instances.length) return { valid: true, message: '' };
  return {
    valid: false,
    message: 'Groupe refusé : toutes les pièces du groupe doivent être reliées entre elles par des ancres compatibles.',
  };
}
